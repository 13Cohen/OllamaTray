import { BrowserWindow } from 'electron'
import { checkHealth } from './api'
import { detectStartupSource } from './service'
import { IPC } from '../../shared/channels'
import type { OllamaStatus } from '../../shared/types'

let pollInterval: ReturnType<typeof setInterval> | null = null
let lastStatus: OllamaStatus = { running: false, source: 'unknown' }
let onStatusChange: ((status: OllamaStatus) => void) | null = null

export function getLastStatus(): OllamaStatus {
  return lastStatus
}

export function setOnStatusChange(callback: (status: OllamaStatus) => void): void {
  onStatusChange = callback
}

export function startPolling(getWindow: () => BrowserWindow | null): void {
  if (pollInterval) return

  const poll = async (): Promise<void> => {
    const running = await checkHealth()
    const source = running ? detectStartupSource() : 'unknown'
    const newStatus: OllamaStatus = { running, source }

    if (newStatus.running !== lastStatus.running || newStatus.source !== lastStatus.source) {
      lastStatus = newStatus
      onStatusChange?.(newStatus)
      const win = getWindow()
      if (win && !win.isDestroyed()) {
        win.webContents.send(IPC.STATUS_CHANGED, newStatus)
      }
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
