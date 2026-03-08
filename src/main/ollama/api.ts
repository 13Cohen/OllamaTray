import { createReadStream, statSync } from 'fs'
import { createHash } from 'crypto'
import { basename } from 'path'
import http from 'http'
import https from 'https'
import type { OllamaModel, PullProgress } from '../../shared/types'
import store from '../store'
import { createLogger } from '../logger'

const log = createLogger('ollama:api')

function getBaseUrl(): string {
  const host = process.env.OLLAMA_HOST || store.get('ollamaHost') || '127.0.0.1:11434'
  return host.startsWith('http') ? host : `http://${host}`
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

    const requestBody = JSON.stringify({ model: name, files, stream: true })
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

    log.info(`=== Import complete: "${name}" SUCCESS ===`)
    onComplete(true)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    log.error(`=== Import failed: "${name}" - ${msg} ===`)
    onComplete(false, msg)
    throw err
  }
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
