import { BrowserWindow } from 'electron'
import { checkHealth, getVersion, listRunningModels } from './api'
import { detectStartupSource } from './service'
import { IPC } from '../../shared/channels'
import type { OllamaStatus } from '../../shared/types'
import store from '../store'
import { createLogger } from '../logger'

const log = createLogger('status-poller')

let pollInterval: ReturnType<typeof setInterval> | null = null
let lastStatus: OllamaStatus = { running: false, source: 'unknown' }
let onStatusChange: ((status: OllamaStatus) => void) | null = null
let lastSeenModels = new Set<string>()

export function getLastStatus(): OllamaStatus {
  return lastStatus
}

export function setOnStatusChange(callback: (status: OllamaStatus) => void): void {
  onStatusChange = callback
}

async function trackRunningModels(): Promise<void> {
  try {
    const runningModels = await listRunningModels()

    const newModels = runningModels.filter((name) => !lastSeenModels.has(name))
    if (newModels.length > 0) {
      const stats = store.get('modelUsageStats')
      const now = new Date().toISOString()
      for (const name of newModels) {
        const existing = stats[name]
        stats[name] = {
          useCount: (existing?.useCount ?? 0) + 1,
          lastUsedAt: now,
          firstUsedAt: existing?.firstUsedAt ?? now
        }
      }
      store.set('modelUsageStats', stats)
      log.debug(`Tracked model usage: ${newModels.join(', ')}`)
    }

    lastSeenModels = new Set(runningModels)
  } catch {
    // ignore - ps endpoint may not be available
  }
}

export function startPolling(getWindow: () => BrowserWindow | null): void {
  if (pollInterval) return

  const poll = async (): Promise<void> => {
    const running = await checkHealth()
    const source = running ? detectStartupSource() : 'unknown'
    const version = running ? await getVersion() : undefined
    const newStatus: OllamaStatus = { running, source, version }

    if (newStatus.running !== lastStatus.running || newStatus.source !== lastStatus.source || newStatus.version !== lastStatus.version) {
      lastStatus = newStatus
      onStatusChange?.(newStatus)
      const win = getWindow()
      if (win && !win.isDestroyed()) {
        win.webContents.send(IPC.STATUS_CHANGED, newStatus)
      }
    }

    if (running) {
      await trackRunningModels()
    } else {
      lastSeenModels.clear()
    }
  }

  poll()
  pollInterval = setInterval(poll, 5000)
}

export function stopPolling(): void {
  if (pollInterval) {
    clearInterval(pollInterval)
    pollInterval = null
  }
}
