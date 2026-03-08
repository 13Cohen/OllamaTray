import { spawn, execFileSync, type ChildProcess } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'
import type { OllamaStartSource } from '../../shared/types'

const isWin = process.platform === 'win32'
const isMac = process.platform === 'darwin'

let managedProcess: ChildProcess | null = null

function getWindowsBinaryPaths(): string[] {
  const localAppData = process.env.LOCALAPPDATA ?? ''
  const programFiles = process.env.ProgramFiles ?? 'C:\\Program Files'
  return [
    join(localAppData, 'Programs', 'Ollama', 'ollama.exe'),
    join(programFiles, 'Ollama', 'ollama.exe'),
    join(localAppData, 'Ollama', 'ollama.exe')
  ]
}

function getMacBinaryPaths(): string[] {
  return ['/usr/local/bin/ollama', '/opt/homebrew/bin/ollama']
}

export function findOllamaBinary(): string | null {
  const paths = isWin ? getWindowsBinaryPaths() : getMacBinaryPaths()
  for (const p of paths) {
    if (existsSync(p)) return p
  }
  try {
    const cmd = isWin ? 'where' : 'which'
    return execFileSync(cmd, ['ollama'], { encoding: 'utf-8' }).trim().split('\n')[0]
  } catch {
    return null
  }
}

export function startOllama(envVars?: Record<string, string>): void {
  if (managedProcess && !managedProcess.killed) {
    return
  }

  const binary = findOllamaBinary()
  if (!binary) {
    throw new Error('Ollama binary not found. Please install Ollama first.')
  }

  managedProcess = spawn(binary, ['serve'], {
    env: { ...process.env, ...envVars },
    stdio: 'ignore',
    detached: false,
    ...(isWin ? { windowsHide: true } : {})
  })

  managedProcess.on('exit', () => {
    managedProcess = null
  })
}

export function stopOllama(): void {
  if (managedProcess && !managedProcess.killed) {
    if (isWin) {
      managedProcess.kill()
    } else {
      managedProcess.kill('SIGTERM')
    }
    managedProcess = null
    return
  }

  try {
    if (isWin) {
      execFileSync('taskkill', ['/F', '/IM', 'ollama.exe'], { stdio: 'ignore' })
    } else {
      execFileSync('pkill', ['-f', 'ollama serve'], { stdio: 'ignore' })
    }
  } catch {
    // process might not exist
  }
  managedProcess = null
}

export function detectStartupSource(): OllamaStartSource {
  if (managedProcess && !managedProcess.killed) {
    return 'managed'
  }

  if (isWin) {
    try {
      const tasklist = execFileSync('tasklist', ['/FI', 'IMAGENAME eq ollama.exe', '/NH'], {
        encoding: 'utf-8'
      })
      if (!tasklist.includes('ollama.exe')) return 'unknown'
    } catch {
      return 'unknown'
    }
    // On Windows, we can't easily distinguish brew vs external, so just return 'external'
    return 'external'
  }

  // macOS / Linux
  try {
    const pgrep = execFileSync('pgrep', ['-f', 'ollama serve'], { encoding: 'utf-8' }).trim()
    if (!pgrep) return 'unknown'
  } catch {
    return 'unknown'
  }

  if (isMac) {
    try {
      const launchctl = execFileSync('launchctl', ['list'], { encoding: 'utf-8' })
      if (launchctl.includes('ollama')) return 'brew'
    } catch {
      // not a brew service
    }
  }

  return 'external'
}

export function cleanupManagedProcess(): void {
  if (managedProcess && !managedProcess.killed) {
    if (isWin) {
      managedProcess.kill()
    } else {
      managedProcess.kill('SIGTERM')
    }
    managedProcess = null
  }
}
