import { useState, useEffect } from 'react'
import { Power, Loader2, Settings, Pin, PinOff } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@renderer/components/ui/dialog'
import { useOllamaStore } from '@renderer/stores/useOllamaStore'
import { useTranslation } from 'react-i18next'

interface ServiceStatusProps {
  onOpenSettings: () => void
}

export function ServiceStatus({ onOpenSettings }: ServiceStatusProps): React.JSX.Element {
  const { t } = useTranslation()
  const status = useOllamaStore((s) => s.status)
  const loading = useOllamaStore((s) => s.loading)
  const startService = useOllamaStore((s) => s.startService)
  const stopService = useOllamaStore((s) => s.stopService)
  const [showConfirm, setShowConfirm] = useState(false)
  const [pinned, setPinned] = useState(false)

  useEffect(() => {
    window.electronAPI.getPinned().then(setPinned)
  }, [])

  const handleTogglePin = async (): Promise<void> => {
    const newState = await window.electronAPI.togglePin()
    setPinned(newState)
  }

  const handleToggle = (): void => {
    if (status.running) {
      if (status.source !== 'managed') {
        setShowConfirm(true)
      } else {
        stopService()
      }
    } else {
      startService()
    }
  }

  const handleConfirmStop = (): void => {
    setShowConfirm(false)
    stopService()
  }

  const sourceLabel = (): string => {
    switch (status.source) {
      case 'managed':
        return t('service.startedByManager')
      case 'brew':
        return t('service.startedByBrew')
      case 'external':
        return t('service.startedExternally')
      default:
        return ''
    }
  }

  return (
    <>
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
        <div className="flex items-center gap-2.5">
          <div
            className={`h-2.5 w-2.5 rounded-full ${status.running ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]' : 'bg-gray-400'}`}
          />
          <div>
            <div className="text-sm font-medium">
              Ollama {status.running ? t('service.running') : t('service.stopped')}
            </div>
            {status.running && (
              <div className="text-[11px] text-muted-foreground">
                {sourceLabel()}
                {status.version && ` · v${status.version}`}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="sm" onClick={onOpenSettings} className="h-7 w-7 p-0">
            <Settings className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleTogglePin}
            title={pinned ? t('service.unpinPanel') : t('service.pinPanel')}
          >
            {pinned ? (
              <Pin className="h-3.5 w-3.5 text-primary" />
            ) : (
              <PinOff className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </Button>
          <Button
            variant={status.running ? 'outline' : 'default'}
            size="sm"
            onClick={handleToggle}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Power className="h-3.5 w-3.5" />
            )}
            {status.running ? t('service.stop') : t('service.start')}
          </Button>
        </div>
      </div>

      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogHeader>
          <DialogTitle>{t('service.stopConfirmTitle')}</DialogTitle>
          <DialogDescription>
            {t('service.stopConfirmDesc', { source: sourceLabel().toLowerCase() })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => setShowConfirm(false)}>
            {t('models.cancel')}
          </Button>
          <Button variant="destructive" size="sm" onClick={handleConfirmStop}>
            {t('service.stopAnyway')}
          </Button>
        </DialogFooter>
      </Dialog>
    </>
  )
}
