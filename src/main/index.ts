import { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage, screen } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { registerIpcHandlers } from './ipc/handlers'
import { startPolling, stopPolling, setOnStatusChange } from './ollama/status-poller'
import { cleanupManagedProcess, startOllama, stopOllama } from './ollama/service'
import { createLogger, getLogPath } from './logger'
import { IPC } from '../shared/channels'

const log = createLogger('main')

const isMac = process.platform === 'darwin'
const isWin = process.platform === 'win32'

let tray: Tray | null = null
let window: BrowserWindow | null = null
let pinned = false

function getWindow(): BrowserWindow | null {
  return window
}

function trayIconPath(name: string): string {
  return join(__dirname, '../../resources', name)
}

function createTrayIcon(running: boolean): Electron.NativeImage {
  if (isWin) {
    const file = running ? 'tray-win-running.png' : 'tray-win-stopped.png'
    return nativeImage.createFromPath(trayIconPath(file))
  }
  const file = running ? 'tray-running.png' : 'tray-stopped.png'
  return nativeImage.createFromPath(trayIconPath(file))
}

function createWindow(): BrowserWindow {
  const windowOptions: Electron.BrowserWindowConstructorOptions = {
    width: 400,
    height: 600,
    show: false,
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  }

  if (isMac) {
    windowOptions.transparent = true
    windowOptions.vibrancy = 'under-window'
    windowOptions.visualEffectState = 'active'
  } else if (isWin) {
    windowOptions.transparent = true
    windowOptions.backgroundMaterial = 'mica'
  }

  const win = new BrowserWindow(windowOptions)

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  win.on('blur', () => {
    if (!pinned) {
      win.hide()
    }
  })

  return win
}

function showWindow(): void {
  if (!window || window.isDestroyed()) {
    window = createWindow()
  }

  if (!tray) return

  const trayBounds = tray.getBounds()
  const windowBounds = window.getBounds()
  const display = screen.getDisplayNearestPoint({ x: trayBounds.x, y: trayBounds.y })

  let x: number, y: number

  if (isWin) {
    // Windows: tray is at the bottom, position window above it
    x = Math.round(trayBounds.x + trayBounds.width / 2 - windowBounds.width / 2)
    y = Math.round(trayBounds.y - windowBounds.height - 4)
  } else {
    // macOS: tray is at the top, position window below it
    x = Math.round(trayBounds.x + trayBounds.width / 2 - windowBounds.width / 2)
    y = Math.round(trayBounds.y + trayBounds.height + 4)
  }

  // Keep window within screen bounds
  const workArea = display.workArea
  if (x + windowBounds.width > workArea.x + workArea.width) {
    x = workArea.x + workArea.width - windowBounds.width
  }
  if (x < workArea.x) x = workArea.x
  if (y + windowBounds.height > workArea.y + workArea.height) {
    y = workArea.y + workArea.height - windowBounds.height
  }
  if (y < workArea.y) y = workArea.y

  window.setPosition(x, y, false)

  if (window.isVisible()) {
    window.hide()
  } else {
    window.show()
  }
}

function buildTrayMenu(running: boolean): Menu {
  return Menu.buildFromTemplate([
    {
      label: '打开面板',
      click: showWindow
    },
    { type: 'separator' },
    {
      label: running ? '停止服务' : '启动服务',
      click: (): void => {
        if (running) {
          stopOllama()
        } else {
          startOllama()
        }
      }
    },
    { type: 'separator' },
    {
      label: '退出',
      click: (): void => {
        stopOllama()
        app.quit()
      }
    }
  ])
}

function updateTrayIcon(running: boolean): void {
  if (tray) {
    tray.setImage(createTrayIcon(running))
    tray.setToolTip(running ? 'Ollama: Running' : 'Ollama: Stopped')
    tray.setContextMenu(buildTrayMenu(running))
  }
}

app.whenReady().then(() => {
  log.info(`OllamaTray starting (${process.platform}, Electron ${process.versions.electron})`)
  log.info(`Log file: ${getLogPath()}`)

  if (isMac) {
    app.dock?.hide()
  }

  tray = new Tray(createTrayIcon(false))
  tray.setToolTip('OllamaTray')
  tray.setContextMenu(buildTrayMenu(false))
  tray.on('click', () => {
    tray?.popUpContextMenu()
  })

  window = createWindow()

  registerIpcHandlers(getWindow)

  ipcMain.handle(IPC.TOGGLE_PIN, () => {
    pinned = !pinned
    if (window && !window.isDestroyed()) {
      window.setAlwaysOnTop(pinned)
    }
    return pinned
  })

  ipcMain.handle(IPC.GET_PINNED, () => {
    return pinned
  })

  setOnStatusChange((status) => {
    updateTrayIcon(status.running)
  })

  startPolling(getWindow)
})

app.on('before-quit', () => {
  stopPolling()
  cleanupManagedProcess()
})

app.on('window-all-closed', () => {
  // Keep app running - it's a tray app
})
