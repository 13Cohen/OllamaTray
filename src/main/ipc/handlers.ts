import { ipcMain, type BrowserWindow } from 'electron'
import { IPC } from '../../shared/channels'
import { checkHealth, listModels, deleteModel, pullModel, cancelPull } from '../ollama/api'
import { startOllama, stopOllama, detectStartupSource } from '../ollama/service'
import type { OllamaStatus } from '../../shared/types'

export function registerIpcHandlers(getWindow: () => BrowserWindow | null): void {
  ipcMain.handle(IPC.GET_STATUS, async (): Promise<OllamaStatus> => {
    const running = await checkHealth()
    const source = running ? detectStartupSource() : 'unknown'
    return { running, source }
  })

  ipcMain.handle(IPC.START_SERVICE, async () => {
    startOllama()
    // wait briefly for service to start
    await new Promise((r) => setTimeout(r, 1500))
    const running = await checkHealth()
    if (!running) throw new Error('Service failed to start')
  })

  ipcMain.handle(IPC.STOP_SERVICE, async () => {
    stopOllama()
  })

  ipcMain.handle(IPC.LIST_MODELS, async () => {
    return listModels()
  })

  ipcMain.handle(IPC.DELETE_MODEL, async (_event, name: string) => {
    await deleteModel(name)
  })

  ipcMain.handle(IPC.PULL_MODEL, async (event, name: string) => {
    const win = getWindow()
    const sender = win?.webContents ?? event.sender

    await pullModel(
      name,
      (progress) => {
        if (!sender.isDestroyed()) {
          sender.send(IPC.PULL_PROGRESS, progress)
        }
      },
      (success, error) => {
        if (!sender.isDestroyed()) {
          sender.send(IPC.PULL_COMPLETE, { modelName: name, success, error })
        }
      }
    )
  })

  ipcMain.handle(IPC.CANCEL_PULL, async (_event, name: string) => {
    cancelPull(name)
  })
}
