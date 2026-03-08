import { dialog, ipcMain, shell, type BrowserWindow } from 'electron'
import { join, dirname } from 'path'
import { homedir } from 'os'
import { readdir, stat } from 'fs/promises'
import { IPC } from '../../shared/channels'
import type { GgufFileInfo } from '../../shared/types'
import { checkHealth, getVersion, listModels, deleteModel, pullModel, createModel, cancelPull } from '../ollama/api'
import { startOllama, stopOllama, detectStartupSource } from '../ollama/service'
import type { OllamaConfig, OllamaStatus } from '../../shared/types'
import store from '../store'
import { createLogger, getLogPath } from '../logger'

const log = createLogger('ipc')

function getDefaultModelsDir(): string {
  return join(homedir(), '.ollama', 'models')
}

function getServiceEnvVars(): Record<string, string> {
  const env: Record<string, string> = {}
  const host = store.get('ollamaHost')
  if (host && host !== '127.0.0.1:11434') {
    env.OLLAMA_HOST = host
  }
  const modelsDir = store.get('ollamaModelsDir')
  if (modelsDir) {
    env.OLLAMA_MODELS = modelsDir
  }
  return { ...env, ...store.get('envVars') }
}

export function registerIpcHandlers(getWindow: () => BrowserWindow | null): void {
  ipcMain.handle(IPC.GET_CONFIG, (): OllamaConfig => {
    return {
      ollamaHost: store.get('ollamaHost'),
      ollamaModelsDir: store.get('ollamaModelsDir'),
      defaultModelsDir: getDefaultModelsDir()
    }
  })

  ipcMain.handle(IPC.SET_CONFIG, (_event, config: Partial<OllamaConfig>) => {
    if (config.ollamaHost !== undefined) {
      store.set('ollamaHost', config.ollamaHost)
    }
    if (config.ollamaModelsDir !== undefined) {
      store.set('ollamaModelsDir', config.ollamaModelsDir)
    }
  })

  ipcMain.handle(IPC.SELECT_DIRECTORY, async (): Promise<string | null> => {
    const win = getWindow()
    const options: Electron.OpenDialogOptions = {
      properties: ['openDirectory', 'createDirectory']
    }
    const result = win
      ? await dialog.showOpenDialog(win, options)
      : await dialog.showOpenDialog(options)
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle(IPC.SCAN_GGUF_MODELS, async (): Promise<GgufFileInfo[] | null> => {
    const win = getWindow()
    const options: Electron.OpenDialogOptions = {
      properties: ['openDirectory']
    }
    const result = win
      ? await dialog.showOpenDialog(win, options)
      : await dialog.showOpenDialog(options)
    if (result.canceled || result.filePaths.length === 0) return null

    const dir = result.filePaths[0]
    const rawFiles: { filePath: string; fileName: string; sizeBytes: number }[] = []

    async function scan(dirPath: string): Promise<void> {
      const entries = await readdir(dirPath, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = join(dirPath, entry.name)
        if (entry.isDirectory()) {
          await scan(fullPath)
        } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.gguf')) {
          const info = await stat(fullPath)
          rawFiles.push({ filePath: fullPath, fileName: entry.name, sizeBytes: info.size })
        }
      }
    }

    await scan(dir)

    // Group split shards (e.g. model-00001-of-00004.gguf) into single entries
    const SPLIT_RE = /^(.+)-(\d{5})-of-(\d{5})\.gguf$/i
    const groups = new Map<string, { filePaths: string[]; totalSize: number; baseName: string }>()
    const models: GgufFileInfo[] = []

    for (const file of rawFiles) {
      const match = file.fileName.match(SPLIT_RE)
      if (match) {
        // Key by directory + base name to group shards from the same directory
        const dirPart = dirname(file.filePath)
        const key = join(dirPart, match[1])
        const group = groups.get(key) || { filePaths: [], totalSize: 0, baseName: match[1] }
        group.filePaths.push(file.filePath)
        group.totalSize += file.sizeBytes
        groups.set(key, group)
      } else {
        models.push({
          filePaths: [file.filePath],
          fileName: file.fileName,
          suggestedName: file.fileName.replace(/\.gguf$/i, '').toLowerCase().replace(/[^a-z0-9._:-]/g, '-'),
          sizeBytes: file.sizeBytes
        })
      }
    }

    for (const [, group] of groups) {
      group.filePaths.sort()
      models.push({
        filePaths: group.filePaths,
        fileName: `${group.baseName} (${group.filePaths.length} parts)`,
        suggestedName: group.baseName.toLowerCase().replace(/[^a-z0-9._:-]/g, '-'),
        sizeBytes: group.totalSize
      })
    }

    return models
  })

  ipcMain.handle(IPC.IMPORT_MODEL, async (event, name: string, filePaths: string[]) => {
    log.info(`IPC IMPORT_MODEL: name="${name}", files=${filePaths.length}`, filePaths)
    const win = getWindow()
    const sender = win?.webContents ?? event.sender

    await createModel(
      name,
      filePaths,
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

  ipcMain.handle(IPC.GET_STATUS, async (): Promise<OllamaStatus> => {
    const running = await checkHealth()
    const source = running ? detectStartupSource() : 'unknown'
    const version = running ? await getVersion() : undefined
    return { running, source, version }
  })

  ipcMain.on(IPC.OPEN_URL, (_event, url: string) => {
    shell.openExternal(url)
  })

  ipcMain.handle(IPC.START_SERVICE, async () => {
    startOllama(getServiceEnvVars())
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

  ipcMain.handle(IPC.GET_LOG_PATH, () => {
    return getLogPath()
  })
}
