import type { OllamaModel, PullProgress } from '../../shared/types'

const BASE_URL = process.env.OLLAMA_HOST
  ? process.env.OLLAMA_HOST.startsWith('http')
    ? process.env.OLLAMA_HOST
    : `http://${process.env.OLLAMA_HOST}`
  : 'http://127.0.0.1:11434'

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(BASE_URL, { signal: AbortSignal.timeout(3000) })
    return res.ok
  } catch {
    return false
  }
}

export async function listModels(): Promise<OllamaModel[]> {
  const res = await fetch(`${BASE_URL}/api/tags`)
  if (!res.ok) throw new Error(`Failed to list models: ${res.statusText}`)
  const data = await res.json()
  return data.models ?? []
}

export async function deleteModel(name: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/delete`, {
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
    const res = await fetch(`${BASE_URL}/api/pull`, {
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

export function cancelPull(name: string): boolean {
  const controller = activePulls.get(name)
  if (controller) {
    controller.abort()
    activePulls.delete(name)
    return true
  }
  return false
}
