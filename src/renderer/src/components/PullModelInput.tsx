import { useState } from 'react'
import { Download, FolderSearch, X, Loader2 } from 'lucide-react'
import { Input } from '@renderer/components/ui/input'
import { Button } from '@renderer/components/ui/button'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { useOllamaStore } from '@renderer/stores/useOllamaStore'
import { useTranslation } from 'react-i18next'
import type { GgufFileInfo } from '../../../shared/types'

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

export function PullModelInput(): React.JSX.Element | null {
  const { t } = useTranslation()
  const status = useOllamaStore((s) => s.status)
  const pullModel = useOllamaStore((s) => s.pullModel)
  const [modelName, setModelName] = useState('')
  const [scannedFiles, setScannedFiles] = useState<GgufFileInfo[] | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 })
  const [importResult, setImportResult] = useState<{ success: number; failed: number } | null>(null)

  if (!status.running) return null

  const handlePull = (): void => {
    const name = modelName.trim()
    if (!name) return
    pullModel(name)
    setModelName('')
  }

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter') handlePull()
  }

  const handleScan = async (): Promise<void> => {
    const files = await window.electronAPI.scanGgufModels()
    if (files && files.length > 0) {
      setScannedFiles(files)
      setSelected(new Set(files.map((f) => f.filePaths[0])))
    } else if (files && files.length === 0) {
      setScannedFiles([])
    }
  }

  const toggleSelect = (key: string): void => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const handleImportAll = async (): Promise<void> => {
    if (!scannedFiles) return
    const toImport = scannedFiles.filter((f) => selected.has(f.filePaths[0]))
    if (toImport.length === 0) return

    setImporting(true)
    setImportProgress({ current: 0, total: toImport.length })
    setImportResult(null)

    let success = 0
    let failed = 0

    for (let i = 0; i < toImport.length; i++) {
      const file = toImport[i]
      setImportProgress({ current: i + 1, total: toImport.length })
      try {
        await window.electronAPI.importModel(file.suggestedName, file.filePaths)
        success++
      } catch (err) {
        failed++
        console.error(`Failed to import ${file.fileName}:`, err)
      }
    }

    setImporting(false)
    setImportResult({ success, failed })
    useOllamaStore.getState().fetchModels()

    if (failed === 0) {
      setTimeout(() => {
        setScannedFiles(null)
        setSelected(new Set())
        setImportResult(null)
      }, 2000)
    }
  }

  const handleClose = (): void => {
    if (importing) return
    setScannedFiles(null)
    setSelected(new Set())
    setImportResult(null)
  }

  if (scannedFiles !== null) {
    const statusText = importing
      ? t('pull.importing', { current: importProgress.current, total: importProgress.total })
      : importResult
        ? importResult.failed > 0
          ? t('pull.doneWithErrors', { success: importResult.success, failed: importResult.failed })
          : t('pull.doneSuccess', { count: importResult.success })
        : scannedFiles.length === 0
          ? t('pull.noGguf')
          : t('pull.foundGguf', { count: scannedFiles.length })

    return (
      <div className="border-t border-border/50 flex flex-col max-h-[50%]">
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-xs font-medium">{statusText}</span>
          <div className="flex items-center gap-1.5">
            {!importing && scannedFiles.length > 0 && (
              <Button
                size="sm"
                className="h-6 text-xs px-2"
                onClick={handleImportAll}
                disabled={selected.size === 0}
              >
                {t('pull.import')} {selected.size > 0 ? `(${selected.size})` : ''}
              </Button>
            )}
            {importing && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            {!importing && (
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={handleClose}>
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
        {scannedFiles.length > 0 && (
          <ScrollArea className="flex-1 px-3 pb-2">
            <div className="space-y-1">
              {scannedFiles.map((file) => (
                <label
                  key={file.filePaths[0]}
                  className={`flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50 cursor-pointer ${importing ? 'opacity-60 pointer-events-none' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(file.filePaths[0])}
                    onChange={() => toggleSelect(file.filePaths[0])}
                    className="rounded"
                    disabled={importing}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs truncate" title={file.filePaths[0]}>
                      {file.fileName}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {file.suggestedName} · {formatSize(file.sizeBytes)}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2.5 border-t border-border/50">
      <Input
        placeholder={t('pull.placeholder')}
        value={modelName}
        onChange={(e) => setModelName(e.target.value)}
        onKeyDown={handleKeyDown}
        className="h-8 text-xs"
      />
      <Button size="sm" className="h-8 shrink-0" onClick={handlePull} disabled={!modelName.trim()}>
        <Download className="h-3.5 w-3.5" />
      </Button>
      <Button variant="outline" size="sm" className="h-8 shrink-0" onClick={handleScan} title={t('pull.importTooltip')}>
        <FolderSearch className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}
