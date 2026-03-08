import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/channels'
import type { ElectronAPI } from '../shared/types'

const api: ElectronAPI = {
  getConfig: () => ipcRenderer.invoke(IPC.GET_CONFIG),
  setConfig: (config) => ipcRenderer.invoke(IPC.SET_CONFIG, config),
  selectDirectory: () => ipcRenderer.invoke(IPC.SELECT_DIRECTORY),
  scanGgufModels: () => ipcRenderer.invoke(IPC.SCAN_GGUF_MODELS),
  importModel: (name: string, filePaths: string[]) => ipcRenderer.invoke(IPC.IMPORT_MODEL, name, filePaths),
  getStatus: () => ipcRenderer.invoke(IPC.GET_STATUS),
  startService: () => ipcRenderer.invoke(IPC.START_SERVICE),
  stopService: () => ipcRenderer.invoke(IPC.STOP_SERVICE),
  listModels: () => ipcRenderer.invoke(IPC.LIST_MODELS),
  listRunning: () => ipcRenderer.invoke(IPC.LIST_RUNNING),
  unloadModel: (name: string) => ipcRenderer.invoke(IPC.UNLOAD_MODEL, name),
  deleteModel: (name: string) => ipcRenderer.invoke(IPC.DELETE_MODEL, name),
  pullModel: (name: string) => ipcRenderer.invoke(IPC.PULL_MODEL, name),
  cancelPull: (name: string) => ipcRenderer.invoke(IPC.CANCEL_PULL, name),

  onStatusChanged: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, ...args: unknown[]): void => {
      callback(args[0] as Parameters<typeof callback>[0])
    }
    ipcRenderer.on(IPC.STATUS_CHANGED, handler)
    return () => ipcRenderer.removeListener(IPC.STATUS_CHANGED, handler)
  },
  onPullProgress: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, ...args: unknown[]): void => {
      callback(args[0] as Parameters<typeof callback>[0])
    }
    ipcRenderer.on(IPC.PULL_PROGRESS, handler)
    return () => ipcRenderer.removeListener(IPC.PULL_PROGRESS, handler)
  },
  onPullComplete: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, ...args: unknown[]): void => {
      callback(args[0] as Parameters<typeof callback>[0])
    }
    ipcRenderer.on(IPC.PULL_COMPLETE, handler)
    return () => ipcRenderer.removeListener(IPC.PULL_COMPLETE, handler)
  },
  onThemeChanged: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, ...args: unknown[]): void => {
      callback(args[0] as boolean)
    }
    ipcRenderer.on(IPC.THEME_CHANGED, handler)
    return () => ipcRenderer.removeListener(IPC.THEME_CHANGED, handler)
  },
  openUrl: (url: string) => ipcRenderer.send(IPC.OPEN_URL, url),
  getLogPath: () => ipcRenderer.invoke(IPC.GET_LOG_PATH),
  togglePin: () => ipcRenderer.invoke(IPC.TOGGLE_PIN),
  getPinned: () => ipcRenderer.invoke(IPC.GET_PINNED),
  getLaunchAtLogin: () => ipcRenderer.invoke(IPC.GET_LAUNCH_AT_LOGIN),
  setLaunchAtLogin: (enabled: boolean) => ipcRenderer.invoke(IPC.SET_LAUNCH_AT_LOGIN, enabled),
  getTheme: () => ipcRenderer.invoke(IPC.GET_THEME),
  setTheme: (theme) => ipcRenderer.invoke(IPC.SET_THEME, theme),
  getNotificationsEnabled: () => ipcRenderer.invoke(IPC.GET_NOTIFICATIONS_ENABLED),
  setNotificationsEnabled: (enabled: boolean) => ipcRenderer.invoke(IPC.SET_NOTIFICATIONS_ENABLED, enabled)
}

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('electronAPI', api)
} else {
  // @ts-expect-error fallback for non-isolated context
  window.electronAPI = api
}
