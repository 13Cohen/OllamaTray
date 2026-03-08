import { app, dialog, ipcMain, nativeTheme, shell, type BrowserWindow } from 'electron'
import { join, dirname } from 'path'
import { homedir } from 'os'
import { readdir, stat } from 'fs/promises'
import { IPC } from '../../shared/channels'
import type { GgufFileInfo, CreateFromModelRequest, ThemeMode } from '../../shared/types'
import { checkHealth, getVersion, listModels, listRunning, unloadModel, deleteModel, pullModel, createModel, cancelPull, showModel, copyModel, createFromModel } from '../ollama/api'
import { startOllama, stopOllama, detectStartupSource } from '../ollama/service'
import type { OllamaConfig, OllamaStatus } from '../../shared/types'
import store from '../store'
import { createLogger, getLogPath } from '../logger'
import { notifyPullComplete, notifyImportComplete } from '../notifications'

const log = createLogger('ipc')

const isMac = process.platform === 'darwin'

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

export function registerIpcHandlers(getWindow: () => BrowserWindow | null, onBeforeStop?: () => void): void {
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
        notifyImportComplete(name, success, error, getWindow)
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
    onBeforeStop?.()
    stopOllama()
  })

  ipcMain.handle(IPC.LIST_MODELS, async () => {
    return listModels()
  })

  ipcMain.handle(IPC.LIST_RUNNING, async () => {
    return listRunning()
  })

  ipcMain.handle(IPC.UNLOAD_MODEL, async (_event, name: string) => {
    await unloadModel(name)
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
        notifyPullComplete(name, success, error, getWindow)
      }
    )
  })

  ipcMain.handle(IPC.CANCEL_PULL, async (_event, name: string) => {
    cancelPull(name)
  })

  ipcMain.handle(IPC.GET_LOG_PATH, () => {
    return getLogPath()
  })

  // Phase 2: Model Details
  ipcMain.handle(IPC.SHOW_MODEL, async (_event, name: string) => {
    return showModel(name)
  })

  // Phase 2: Model Copy
  ipcMain.handle(IPC.COPY_MODEL, async (_event, source: string, destination: string) => {
    await copyModel(source, destination)
  })

  // Phase 2: Model Customize (create variant from existing model)
  ipcMain.handle(IPC.CREATE_FROM_MODEL, async (event, request: CreateFromModelRequest) => {
    const win = getWindow()
    const sender = win?.webContents ?? event.sender

    await createFromModel(
      request,
      (progress) => {
        if (!sender.isDestroyed()) {
          sender.send(IPC.CREATE_PROGRESS, progress)
        }
      },
      (success, error) => {
        if (!sender.isDestroyed()) {
          sender.send(IPC.CREATE_COMPLETE, { modelName: request.model, success, error })
        }
      }
    )
  })

  // Phase 2: Usage Stats
  ipcMain.handle(IPC.GET_USAGE_STATS, () => {
    return store.get('modelUsageStats')
  })

  // Launch at Login
  ipcMain.handle(IPC.GET_LAUNCH_AT_LOGIN, () => {
    return store.get('launchAtLogin')
  })

  ipcMain.handle(IPC.SET_LAUNCH_AT_LOGIN, (_event, enabled: boolean) => {
    store.set('launchAtLogin', enabled)
    app.setLoginItemSettings({
      openAtLogin: enabled,
      ...(isMac ? { openAsHidden: true } : {})
    })
  })

  // Theme
  ipcMain.handle(IPC.GET_THEME, () => {
    return store.get('theme')
  })

  ipcMain.handle(IPC.SET_THEME, (_event, theme: ThemeMode) => {
    store.set('theme', theme)
    nativeTheme.themeSource = theme
    const win = getWindow()
    if (win && !win.isDestroyed()) {
      win.webContents.send(IPC.THEME_CHANGED, nativeTheme.shouldUseDarkColors)
    }
  })

  // Notifications
  ipcMain.handle(IPC.GET_NOTIFICATIONS_ENABLED, () => {
    return store.get('notificationsEnabled')
  })

  ipcMain.handle(IPC.SET_NOTIFICATIONS_ENABLED, (_event, enabled: boolean) => {
    store.set('notificationsEnabled', enabled)
  })
}
