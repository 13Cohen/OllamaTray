import { useState, useEffect } from 'react'
import { ArrowLeft, Copy, Check, FolderOpen, RotateCcw, FileText } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { useOllamaStore } from '@renderer/stores/useOllamaStore'
import type { OllamaConfig } from '../../../shared/types'

interface SettingsProps {
  onBack: () => void
}

export function Settings({ onBack }: SettingsProps): React.JSX.Element {
  const [config, setConfig] = useState<OllamaConfig>({ ollamaHost: '127.0.0.1:11434', ollamaModelsDir: '', defaultModelsDir: '' })
  const [copied, setCopied] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [needsRestart, setNeedsRestart] = useState(false)
  const [logPath, setLogPath] = useState('')
  const status = useOllamaStore((s) => s.status)
  const stopService = useOllamaStore((s) => s.stopService)
  const startService = useOllamaStore((s) => s.startService)
  const [restarting, setRestarting] = useState(false)

  useEffect(() => {
    window.electronAPI.getConfig().then(setConfig)
    window.electronAPI.getLogPath().then(setLogPath)
  }, [])

  const apiUrl = config.ollamaHost.startsWith('http')
    ? config.ollamaHost
    : `http://${config.ollamaHost}`

  const handleCopy = async (): Promise<void> => {
    await navigator.clipboard.writeText(apiUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const updateField = <K extends keyof OllamaConfig>(key: K, value: OllamaConfig[K]): void => {
    setConfig((prev) => ({ ...prev, [key]: value }))
    setDirty(true)
  }

  const handleSave = async (): Promise<void> => {
    await window.electronAPI.setConfig(config)
    setDirty(false)
    if (status.running) {
      setNeedsRestart(true)
    }
  }

  const handleSaveAndRestart = async (): Promise<void> => {
    setRestarting(true)
    await window.electronAPI.setConfig(config)
    setDirty(false)
    await stopService()
    await startService()
    setRestarting(false)
    setNeedsRestart(false)
  }

  const handleRestart = async (): Promise<void> => {
    setRestarting(true)
    await stopService()
    await startService()
    setRestarting(false)
    setNeedsRestart(false)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50">
        <Button variant="ghost" size="sm" onClick={onBack} className="h-7 w-7 p-0">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium">Settings</span>
      </div>

      {needsRestart && (
        <div className="flex items-center justify-between px-4 py-2 bg-amber-500/10 border-b border-amber-500/20">
          <span className="text-xs text-amber-600 dark:text-amber-400">
            Restart to apply changes
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRestart}
            disabled={restarting}
            className="h-6 text-xs px-2 gap-1"
          >
            <RotateCcw className={`h-3 w-3 ${restarting ? 'animate-spin' : ''}`} />
            {restarting ? 'Restarting...' : 'Restart Now'}
          </Button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-5">
        {/* Ollama Host & Port */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Host & Port</label>
          <div className="flex items-center gap-2">
            <Input
              value={config.ollamaHost}
              onChange={(e) => updateField('ollamaHost', e.target.value)}
              placeholder="127.0.0.1:11434"
              className="flex-1"
            />
            <Button variant="outline" size="sm" onClick={handleCopy} className="h-8 w-8 p-0 shrink-0" title={apiUrl}>
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Click copy for <span className="font-mono">{apiUrl}</span>
          </p>
        </div>

        {/* Models directory */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Models Directory</label>
          <div className="flex items-center gap-2">
            <Input
              value={config.ollamaModelsDir}
              onChange={(e) => updateField('ollamaModelsDir', e.target.value)}
              placeholder={config.defaultModelsDir || '~/.ollama/models'}
              className="flex-1"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                const result = await window.electronAPI.selectDirectory()
                if (result) updateField('ollamaModelsDir', result)
              }}
              className="h-8 w-8 p-0 shrink-0"
            >
              <FolderOpen className="h-3.5 w-3.5" />
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Ollama will read and store models from this directory. Leave empty for default.
          </p>
        </div>

        {/* Logs */}
        {logPath && (
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Logs</label>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const lastSep = Math.max(logPath.lastIndexOf('/'), logPath.lastIndexOf('\\'))
                const dir = lastSep > 0 ? logPath.substring(0, lastSep) : logPath
                window.electronAPI.openUrl(`file://${dir}`)
              }}
              className="w-full justify-start gap-2 h-8 text-xs font-normal"
            >
              <FileText className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{logPath}</span>
            </Button>
          </div>
        )}
      </div>

      {/* Action buttons */}
      {dirty && (
        <div className="px-4 py-3 border-t border-border/50 space-y-2">
          {status.running ? (
            <Button
              size="sm"
              onClick={handleSaveAndRestart}
              disabled={restarting}
              className="w-full gap-1.5"
            >
              <RotateCcw className={`h-3.5 w-3.5 ${restarting ? 'animate-spin' : ''}`} />
              {restarting ? 'Restarting...' : 'Save & Restart Service'}
            </Button>
          ) : (
            <Button size="sm" onClick={handleSave} className="w-full">
              Save
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
