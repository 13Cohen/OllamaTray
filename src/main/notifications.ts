import { Notification, BrowserWindow } from 'electron'
import store from './store'
import { createLogger } from './logger'

const log = createLogger('notifications')

function shouldNotify(getWindow: () => BrowserWindow | null): boolean {
  if (!store.get('notificationsEnabled')) return false
  const win = getWindow()
  if (win && !win.isDestroyed() && win.isVisible() && win.isFocused()) return false
  return true
}

export function notifyPullComplete(
  modelName: string,
  success: boolean,
  error: string | undefined,
  getWindow: () => BrowserWindow | null
): void {
  if (!shouldNotify(getWindow)) return

  const title = success ? 'Download Complete' : 'Download Failed'
  const body = success ? `${modelName} is ready to use` : `${modelName}: ${error || 'Unknown error'}`

  log.info(`Notification: ${title} - ${body}`)
  new Notification({ title, body }).show()
}

export function notifyImportComplete(
  modelName: string,
  success: boolean,
  error: string | undefined,
  getWindow: () => BrowserWindow | null
): void {
  if (!shouldNotify(getWindow)) return

  const title = success ? 'Import Complete' : 'Import Failed'
  const body = success ? `${modelName} imported successfully` : `${modelName}: ${error || 'Unknown error'}`

  log.info(`Notification: ${title} - ${body}`)
  new Notification({ title, body }).show()
}

export function notifyServiceStopped(getWindow: () => BrowserWindow | null): void {
  if (!shouldNotify(getWindow)) return

  log.info('Notification: Ollama service stopped unexpectedly')
  new Notification({
    title: 'Ollama Stopped',
    body: 'The Ollama service has stopped unexpectedly'
  }).show()
}
