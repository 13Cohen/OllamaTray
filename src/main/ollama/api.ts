import { createReadStream, statSync } from 'fs'
import { createHash } from 'crypto'
import { basename } from 'path'
import http from 'http'
import https from 'https'
import type { OllamaModel, PullProgress, RunningModel, ModelShowResponse, CreateFromModelRequest, ChatMessage, ChatToken, ModelProfile } from '../../shared/types'
import store from '../store'
import { createLogger } from '../logger'
import {
  buildModelProfileFromGguf,
  ensureModelProfile,
  mergeProfileStopSequences,
  saveModelProfile,
  renderPromptFromProfile,
  shouldUseProfileGenerateFallback
} from './model-profile'

const log = createLogger('ollama:api')

function getBaseUrl(): string {
  const host = process.env.OLLAMA_HOST || store.get('ollamaHost') || '127.0.0.1:11434'
  return host.startsWith('http') ? host : `http://${host}`
}

function summarizeMessages(messages: ChatMessage[]): { count: number; roles: string[]; imageMessages: number } {
  return {
    count: messages.length,
    roles: messages.map((message) => message.role),
    imageMessages: messages.filter((message) => (message.images?.length ?? 0) > 0).length
  }
}

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(getBaseUrl(), { signal: AbortSignal.timeout(3000) })
    return res.ok
  } catch {
    return false
  }
}

export async function getVersion(): Promise<string | undefined> {
  try {
    const res = await fetch(`${getBaseUrl()}/api/version`, { signal: AbortSignal.timeout(3000) })
    if (!res.ok) return undefined
    const data = await res.json()
    return data.version
  } catch {
    return undefined
  }
}

export async function listModels(): Promise<OllamaModel[]> {
  const res = await fetch(`${getBaseUrl()}/api/tags`)
  if (!res.ok) throw new Error(`Failed to list models: ${res.statusText}`)
  const data = await res.json()
  return data.models ?? []
}

export async function listRunning(): Promise<RunningModel[]> {
  const res = await fetch(`${getBaseUrl()}/api/ps`)
  if (!res.ok) throw new Error(`Failed to list running models: ${res.statusText}`)
  const data = await res.json()
  return data.models ?? []
}

export async function unloadModel(name: string): Promise<void> {
  const res = await fetch(`${getBaseUrl()}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: name, keep_alive: 0 })
  })
  if (!res.ok) throw new Error(`Failed to unload model: ${res.statusText}`)
  // Consume the response body
  await res.text()
}

export async function deleteModel(name: string): Promise<void> {
  const res = await fetch(`${getBaseUrl()}/api/delete`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  })
  if (!res.ok) throw new Error(`Failed to delete model: ${res.statusText}`)
}

const activePulls = new Map<string, AbortController>()

export async function pullModel(
  name: string,
  onProgress: (progress: PullProgress) => void,
  onComplete: (success: boolean, error?: string) => void
): Promise<void> {
  const controller = new AbortController()
  activePulls.set(name, controller)

  try {
    const res = await fetch(`${getBaseUrl()}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, stream: true }),
      signal: controller.signal
    })

    if (!res.ok) {
      throw new Error(`Failed to pull model: ${res.statusText}`)
    }

    const reader = res.body?.getReader()
    if (!reader) throw new Error('No response body')

    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (!line.trim()) continue
        try {
          const data = JSON.parse(line)
          onProgress({
            modelName: name,
            status: data.status ?? '',
            digest: data.digest,
            total: data.total,
            completed: data.completed
          })
          if (data.error) {
            throw new Error(data.error)
          }
        } catch (e) {
          if (e instanceof SyntaxError) continue
          throw e
        }
      }
    }

    if (buffer.trim()) {
      try {
        const data = JSON.parse(buffer)
        if (data.error) throw new Error(data.error)
      } catch (e) {
        if (!(e instanceof SyntaxError)) throw e
      }
    }

    onComplete(true)
  } catch (err) {
    if (controller.signal.aborted) {
      onComplete(false, 'Download cancelled')
    } else {
      onComplete(false, err instanceof Error ? err.message : 'Unknown error')
    }
  } finally {
    activePulls.delete(name)
  }
}

async function hashFile(
  filePath: string,
  onBytes?: (bytes: number) => void
): Promise<string> {
  const fileSize = statSync(filePath).size
  log.info(`Hashing file: ${basename(filePath)} (${(fileSize / 1024 / 1024).toFixed(0)} MB)`)
  const start = Date.now()
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    const stream = createReadStream(filePath)
    stream.on('data', (chunk: Buffer | string) => {
      hash.update(chunk)
      onBytes?.(chunk.length)
    })
    stream.on('end', () => {
      const digest = hash.digest('hex')
      const elapsed = ((Date.now() - start) / 1000).toFixed(1)
      log.info(`Hash complete: sha256:${digest.slice(0, 12)}... (${elapsed}s)`)
      resolve(digest)
    })
    stream.on('error', (err) => {
      log.error(`Hash failed: ${err.message}`)
      reject(err)
    })
  })
}

async function ensureBlob(
  filePath: string,
  digest: string,
  onProgress?: (completed: number, total: number) => void
): Promise<void> {
  const blobUrl = `${getBaseUrl()}/api/blobs/sha256:${digest}`

  // Check if blob already exists
  try {
    const head = await fetch(blobUrl, { method: 'HEAD' })
    if (head.ok) {
      log.info(`Blob already exists: sha256:${digest.slice(0, 12)}...`)
      return
    }
    log.debug(`Blob HEAD returned ${head.status}, will upload`)
  } catch {
    log.debug('Blob HEAD failed, will upload')
  }

  // Upload blob using http.request + pipe for proper backpressure
  const fileSize = statSync(filePath).size
  log.info(`Uploading blob: ${basename(filePath)} (${(fileSize / 1024 / 1024).toFixed(0)} MB) → ${blobUrl}`)
  const start = Date.now()
  const parsed = new URL(blobUrl)
  const transport = parsed.protocol === 'https:' ? https : http

  return new Promise((resolve, reject) => {
    const req = transport.request(
      {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname,
        method: 'POST',
        headers: { 'Content-Length': fileSize.toString() }
      },
      (res) => {
        let body = ''
        res.on('data', (chunk: Buffer | string) => {
          body += chunk
        })
        res.on('end', () => {
          const elapsed = ((Date.now() - start) / 1000).toFixed(1)
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            log.info(`Blob upload complete: HTTP ${res.statusCode} (${elapsed}s)`)
            resolve()
          } else {
            log.error(`Blob upload failed: HTTP ${res.statusCode} body=${body}`)
            reject(new Error(`Failed to upload blob: HTTP ${res.statusCode} ${body}`))
          }
        })
      }
    )

    req.on('error', (err) => {
      log.error(`Blob upload error: ${err.message}`)
      reject(err)
    })

    const fileStream = createReadStream(filePath)
    let uploaded = 0

    fileStream.on('data', (chunk: Buffer | string) => {
      uploaded += chunk.length
      onProgress?.(uploaded, fileSize)
    })

    fileStream.pipe(req)
  })
}

export async function createModel(
  name: string,
  filePaths: string[],
  onProgress: (progress: PullProgress) => void,
  onComplete: (success: boolean, error?: string) => void
): Promise<void> {
  log.info(`=== Import started: "${name}" (${filePaths.length} file(s)) ===`)
  try {
    const files: Record<string, string> = {}

    for (let i = 0; i < filePaths.length; i++) {
      const filePath = filePaths[i]
      const fileName = basename(filePath)

      // Hash the file
      onProgress({
        modelName: name,
        status: `Hashing ${fileName} (${i + 1}/${filePaths.length})...`
      })
      const digest = await hashFile(filePath)

      // Upload blob if not already present
      onProgress({
        modelName: name,
        status: `Uploading ${fileName} (${i + 1}/${filePaths.length})...`
      })
      await ensureBlob(filePath, digest, (completed, total) => {
        onProgress({
          modelName: name,
          status: `Uploading ${fileName} (${i + 1}/${filePaths.length})...`,
          completed,
          total
        })
      })

      files[fileName] = `sha256:${digest}`
    }

    // Create model with file references
    log.info(`Creating model "${name}" with files:`, files)
    onProgress({ modelName: name, status: 'Creating model...' })

    const profile = await buildModelProfileFromGguf(filePaths[0])
    const request: Record<string, unknown> = { model: name, files, stream: true }
    if (profile?.ollamaTemplate) {
      request.template = profile.ollamaTemplate
      if (profile.ollamaParameters && Object.keys(profile.ollamaParameters).length > 0) {
        request.parameters = profile.ollamaParameters
      }
      log.info(`Recovered chat template metadata for "${name}" from GGUF`)
    }

    const requestBody = JSON.stringify(request)
    log.debug(`POST /api/create body: ${requestBody}`)

    const res = await fetch(`${getBaseUrl()}/api/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: requestBody
    })

    log.info(`/api/create response: HTTP ${res.status}`)

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText)
      log.error(`/api/create failed: ${text}`)
      throw new Error(`Failed to create model: ${text}`)
    }

    const reader = res.body?.getReader()
    if (!reader) throw new Error('No response body')

    const decoder = new TextDecoder()
    let buffer = ''
    let hasSuccess = false

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (!line.trim()) continue
        log.debug(`/api/create stream: ${line}`)
        try {
          const data = JSON.parse(line)
          onProgress({
            modelName: name,
            status: data.status ?? '',
            digest: data.digest,
            total: data.total,
            completed: data.completed
          })
          if (data.status === 'success') hasSuccess = true
          if (data.error) {
            log.error(`/api/create error in stream: ${data.error}`)
            throw new Error(data.error)
          }
        } catch (e) {
          if (e instanceof SyntaxError) continue
          throw e
        }
      }
    }

    if (!hasSuccess) {
      log.error('Model creation stream ended without success status')
      throw new Error('Model creation did not report success')
    }

    if (profile) saveModelProfile(name, profile)

    log.info(`=== Import complete: "${name}" SUCCESS ===`)
    onComplete(true)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    log.error(`=== Import failed: "${name}" - ${msg} ===`)
    onComplete(false, msg)
    throw err
  }
}

export async function showModel(name: string): Promise<ModelShowResponse> {
  const res = await fetch(`${getBaseUrl()}/api/show`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: name })
  })
  if (!res.ok) throw new Error(`Failed to show model: ${res.statusText}`)
  return res.json()
}

function getPartialTagSuffix(buffer: string, tag: string): string {
  const maxLength = Math.min(buffer.length, tag.length - 1)
  for (let length = maxLength; length > 0; length -= 1) {
    if (tag.startsWith(buffer.slice(-length))) {
      return buffer.slice(-length)
    }
  }
  return ''
}

function emitTaggedText(
  chunk: string,
  state: { inThink: boolean; pending: string },
  onToken: (token: Omit<ChatToken, 'requestId'>) => void
): void {
  state.pending += chunk

  while (state.pending) {
    const tag = state.inThink ? '</think>' : '<think>'
    const index = state.pending.indexOf(tag)

    if (index === -1) {
      const partial = getPartialTagSuffix(state.pending, tag)
      const emitText = partial ? state.pending.slice(0, -partial.length) : state.pending
      if (emitText) {
        onToken(state.inThink ? { content: '', thinking: emitText, done: false } : { content: emitText, done: false })
      }
      state.pending = partial
      break
    }

    const emitText = state.pending.slice(0, index)
    if (emitText) {
      onToken(state.inThink ? { content: '', thinking: emitText, done: false } : { content: emitText, done: false })
    }

    state.pending = state.pending.slice(index + tag.length)
    state.inThink = !state.inThink
  }
}

function flushTaggedText(
  state: { inThink: boolean; pending: string },
  onToken: (token: Omit<ChatToken, 'requestId'>) => void
): void {
  if (!state.pending) return
  onToken(state.inThink ? { content: '', thinking: state.pending, done: true } : { content: state.pending, done: true })
  state.pending = ''
}

async function generateChatFallback(
  model: string,
  messages: ChatMessage[],
  profile: ModelProfile,
  controller: AbortController,
  onToken: (token: Omit<ChatToken, 'requestId'>) => void,
  onComplete: () => void,
  options?: { think?: boolean; modelOptions?: Record<string, unknown> }
): Promise<void> {
  const prompt = renderPromptFromProfile(profile, messages, { think: options?.think })
  if (!prompt) throw new Error('Model profile cannot render chat prompt')
  const startedAt = Date.now()

  const body = {
    model,
    prompt,
    raw: true,
    stream: true,
    options: mergeProfileStopSequences(options?.modelOptions, profile)
  }

  log.info(`Using profile generate fallback`, {
    model,
    runtimeFormat: profile.runtimeFormat,
    think: options?.think,
    promptLength: prompt.length,
    stopCount: profile.stop.length
  })
  log.debug(`POST /api/generate body: ${JSON.stringify(body)}`)

  const res = await fetch(`${getBaseUrl()}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: controller.signal
  })

  if (!res.ok) {
    const errorText = await res.text().catch(() => res.statusText)
    throw new Error(`Generate fallback failed: ${errorText}`)
  }

  const reader = res.body?.getReader()
  if (!reader) throw new Error('No response body')

  const decoder = new TextDecoder()
  const tagState = { inThink: false, pending: '' }
  let buffer = ''
  let chunkCount = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.trim()) continue
      try {
        const data = JSON.parse(line)
        if (data.error) throw new Error(data.error)
        chunkCount += 1
        emitTaggedText(data.response ?? '', tagState, onToken)
      } catch (e) {
        if (e instanceof SyntaxError) continue
        throw e
      }
    }
  }

  if (buffer.trim()) {
    const data = JSON.parse(buffer)
    if (data.error) throw new Error(data.error)
    chunkCount += 1
    emitTaggedText(data.response ?? '', tagState, onToken)
  }

  flushTaggedText(tagState, onToken)
  log.info(`Profile generate fallback complete`, {
    model,
    elapsedMs: Date.now() - startedAt,
    chunkCount
  })
  onComplete()
}

export async function copyModel(source: string, destination: string): Promise<void> {
  const res = await fetch(`${getBaseUrl()}/api/copy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source, destination })
  })
  if (!res.ok) throw new Error(`Failed to copy model: ${res.statusText}`)
}

export async function createFromModel(
  request: CreateFromModelRequest,
  onProgress: (progress: PullProgress) => void,
  onComplete: (success: boolean, error?: string) => void
): Promise<void> {
  try {
    const body: Record<string, unknown> = {
      model: request.model,
      from: request.from,
      stream: true
    }
    if (request.system) body.system = request.system
    if (request.template) body.template = request.template
    if (request.parameters) {
      for (const [key, value] of Object.entries(request.parameters)) {
        if (!body.parameters) body.parameters = {}
        ;(body.parameters as Record<string, unknown>)[key] = value
      }
    }

    const res = await fetch(`${getBaseUrl()}/api/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText)
      throw new Error(`Failed to create model: ${text}`)
    }

    const reader = res.body?.getReader()
    if (!reader) throw new Error('No response body')

    const decoder = new TextDecoder()
    let buffer = ''
    let hasSuccess = false

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (!line.trim()) continue
        try {
          const data = JSON.parse(line)
          onProgress({
            modelName: request.model,
            status: data.status ?? '',
            digest: data.digest,
            total: data.total,
            completed: data.completed
          })
          if (data.status === 'success') hasSuccess = true
          if (data.error) throw new Error(data.error)
        } catch (e) {
          if (e instanceof SyntaxError) continue
          throw e
        }
      }
    }

    if (!hasSuccess) throw new Error('Model creation did not report success')
    onComplete(true)
  } catch (err) {
    onComplete(false, err instanceof Error ? err.message : 'Unknown error')
  }
}

export async function listRunningModels(): Promise<string[]> {
  const res = await fetch(`${getBaseUrl()}/api/ps`, { signal: AbortSignal.timeout(3000) })
  if (!res.ok) return []
  const data = await res.json()
  return (data.models ?? []).map((m: { name: string }) => m.name)
}

export function cancelPull(name: string): boolean {
  const controller = activePulls.get(name)
  if (controller) {
    controller.abort()
    activePulls.delete(name)
    return true
  }
  return false
}

// Phase 3: Chat

let activeChatController: AbortController | null = null

export async function chatWithModel(
  model: string,
  messages: ChatMessage[],
  onToken: (token: Omit<ChatToken, 'requestId'>) => void,
  onComplete: () => void,
  options?: { think?: boolean; modelOptions?: Record<string, unknown> }
): Promise<void> {
  activeChatController?.abort()
  const controller = new AbortController()
  activeChatController = controller
  const startedAt = Date.now()
  const messageSummary = summarizeMessages(messages)

  try {
    log.info(`Chat request started`, {
      model,
      think: options?.think,
      ...messageSummary
    })
    const modelInfo = await showModel(model)
    const profile = await ensureModelProfile(model, modelInfo)
    if (shouldUseProfileGenerateFallback(modelInfo, profile, messages)) {
      log.info(`Chat path selected`, {
        model,
        path: 'profile-generate',
        runtimeFormat: profile.runtimeFormat,
        hasOllamaTemplate: Boolean(profile.ollamaTemplate)
      })
      await generateChatFallback(model, messages, profile, controller, onToken, onComplete, options)
      return
    }

    const body: Record<string, unknown> = { model, messages, stream: true }
    // Always explicitly set think to control thinking mode when the model supports it.
    if (options?.think !== undefined) body.think = options.think
    if (options?.modelOptions && Object.keys(options.modelOptions).length > 0) {
      body.options = options.modelOptions
    }

    log.info(`Chat path selected`, {
      model,
      path: 'ollama-chat',
      templatePreview: modelInfo.template.slice(0, 40),
      capabilities: modelInfo.capabilities
    })
    log.debug(`POST /api/chat body: ${JSON.stringify(body)}`)

    const res = await fetch(`${getBaseUrl()}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal
    })

    if (!res.ok) {
      const errorText = await res.text().catch(() => res.statusText)
      throw new Error(`Chat failed: ${errorText}`)
    }

    const reader = res.body?.getReader()
    if (!reader) throw new Error('No response body')

    const decoder = new TextDecoder()
    let buffer = ''
    let chunkCount = 0

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (!line.trim()) continue
        try {
          const data = JSON.parse(line)
          if (data.error) throw new Error(data.error)
          chunkCount += 1
          onToken({
            content: data.message?.content ?? '',
            thinking: data.message?.thinking,
            done: data.done ?? false
          })
        } catch (e) {
          if (e instanceof SyntaxError) continue
          throw e
        }
      }
    }

    if (buffer.trim()) {
      try {
        const data = JSON.parse(buffer)
        if (data.error) throw new Error(data.error)
        chunkCount += 1
        onToken({
          content: data.message?.content ?? '',
          thinking: data.message?.thinking,
          done: data.done ?? true
        })
      } catch (e) {
        if (e instanceof SyntaxError) {
          // ignore trailing parse errors
        } else {
          throw e
        }
      }
    }

    log.info(`Ollama chat complete`, {
      model,
      elapsedMs: Date.now() - startedAt,
      chunkCount
    })
    onComplete()
  } catch (err) {
    if (!controller.signal.aborted) {
      log.error(`Chat request failed`, {
        model,
        elapsedMs: Date.now() - startedAt,
        error: err instanceof Error ? err.message : String(err)
      })
      throw err
    }
    log.info(`Chat request aborted`, {
      model,
      elapsedMs: Date.now() - startedAt
    })
  } finally {
    if (activeChatController === controller) {
      activeChatController = null
    }
  }
}

export function cancelChat(): void {
  if (activeChatController) {
    activeChatController.abort()
    activeChatController = null
  }
}
