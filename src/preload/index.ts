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
  openUrl: (url: string) => ipcRenderer.send(IPC.OPEN_URL, url),
  getLogPath: () => ipcRenderer.invoke(IPC.GET_LOG_PATH)
}

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('electronAPI', api)
} else {
  // @ts-expect-error fallback for non-isolated context
  window.electronAPI = api
}
