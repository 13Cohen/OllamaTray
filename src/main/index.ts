import { app, BrowserWindow, Tray, nativeImage, screen } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { registerIpcHandlers } from './ipc/handlers'
import { startPolling, stopPolling, setOnStatusChange } from './ollama/status-poller'
import { cleanupManagedProcess } from './ollama/service'

const isMac = process.platform === 'darwin'
const isWin = process.platform === 'win32'

let tray: Tray | null = null
let window: BrowserWindow | null = null

function getWindow(): BrowserWindow | null {
  return window
}

function createTrayIcon(color: 'gray' | 'green'): Electron.NativeImage {
  const size = isWin ? 16 : 22
  const scaleFactor = 2
  const px = size * scaleFactor
  const r = (color === 'green') ? 0x34 : 0x9C
  const g = (color === 'green') ? 0xD3 : 0xA3
  const b = (color === 'green') ? 0x99 : 0xAF

  const buf = Buffer.alloc(px * px * 4)
  const cx = px / 2
  const cy = px / 2
  const radius = px / 2 - 2 * scaleFactor

  for (let y = 0; y < px; y++) {
    for (let x = 0; x < px; x++) {
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2)
      const i = (y * px + x) * 4
      if (dist <= radius) {
        buf[i] = r
        buf[i + 1] = g
        buf[i + 2] = b
        buf[i + 3] = 255
      }
    }
  }

  return nativeImage.createFromBuffer(buf, {
    width: px,
    height: px,
    scaleFactor
  })
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
    win.hide()
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

function updateTrayIcon(running: boolean): void {
  if (tray) {
    tray.setImage(createTrayIcon(running ? 'green' : 'gray'))
    tray.setToolTip(running ? 'Ollama: Running' : 'Ollama: Stopped')
  }
}

app.whenReady().then(() => {
  if (isMac) {
    app.dock?.hide()
  }

  tray = new Tray(createTrayIcon('gray'))
  tray.setToolTip('OllamaTray')
  tray.on('click', showWindow)

  window = createWindow()

  registerIpcHandlers(getWindow)

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
