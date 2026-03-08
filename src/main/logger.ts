import { app } from 'electron'
import { appendFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 }

let logDir: string | null = null
let logFile: string | null = null
let minLevel: LogLevel = 'debug'

function ensureLogDir(): string {
  if (logDir) return logDir
  try {
    logDir = app.getPath('logs')
  } catch {
    // app not ready yet, use temp fallback
    logDir = join(process.env.HOME || '/tmp', '.ollama-tray', 'logs')
  }
  if (!existsSync(logDir)) {
    mkdirSync(logDir, { recursive: true })
  }
  return logDir
}

function getLogFile(): string {
  if (logFile) return logFile
  const dir = ensureLogDir()
  const date = new Date().toISOString().split('T')[0]
  logFile = join(dir, `main-${date}.log`)
  return logFile
}

function formatMessage(level: LogLevel, tag: string, message: string, data?: unknown): string {
  const ts = new Date().toISOString()
  const prefix = `${ts} [${level.toUpperCase().padEnd(5)}] [${tag}]`
  const dataStr = data !== undefined ? ` ${JSON.stringify(data)}` : ''
  return `${prefix} ${message}${dataStr}`
}

function write(level: LogLevel, tag: string, message: string, data?: unknown): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[minLevel]) return

  const formatted = formatMessage(level, tag, message, data)

  // Console output
  switch (level) {
    case 'error':
      console.error(formatted)
      break
    case 'warn':
      console.warn(formatted)
      break
    default:
      console.log(formatted)
  }

  // File output
  try {
    appendFileSync(getLogFile(), formatted + '\n')
  } catch {
    // ignore file write errors
  }
}

export interface Logger {
  debug: (message: string, data?: unknown) => void
  info: (message: string, data?: unknown) => void
  warn: (message: string, data?: unknown) => void
  error: (message: string, data?: unknown) => void
}

export function createLogger(tag: string): Logger {
  return {
    debug: (message, data?) => write('debug', tag, message, data),
    info: (message, data?) => write('info', tag, message, data),
    warn: (message, data?) => write('warn', tag, message, data),
    error: (message, data?) => write('error', tag, message, data)
  }
}

export function setLogLevel(level: LogLevel): void {
  minLevel = level
}

export function getLogPath(): string {
  return getLogFile()
}
