import { useState } from 'react'
import { Power, Loader2 } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@renderer/components/ui/dialog'
import { useOllamaStore } from '@renderer/stores/useOllamaStore'

export function ServiceStatus(): React.JSX.Element {
  const status = useOllamaStore((s) => s.status)
  const loading = useOllamaStore((s) => s.loading)
  const startService = useOllamaStore((s) => s.startService)
  const stopService = useOllamaStore((s) => s.stopService)
  const [showConfirm, setShowConfirm] = useState(false)

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
        return 'Started by Ollama Manager'
      case 'brew':
        return 'Started by Homebrew'
      case 'external':
        return 'Started externally'
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
              Ollama {status.running ? 'Running' : 'Stopped'}
            </div>
            {status.running && (
              <div className="text-[11px] text-muted-foreground">{sourceLabel()}</div>
            )}
          </div>
        </div>
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
          {status.running ? 'Stop' : 'Start'}
        </Button>
      </div>

      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogHeader>
          <DialogTitle>Stop Ollama?</DialogTitle>
          <DialogDescription>
            Ollama was not started by this app ({sourceLabel().toLowerCase()}). Stopping it may
            affect other applications using Ollama.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => setShowConfirm(false)}>
            Cancel
          </Button>
          <Button variant="destructive" size="sm" onClick={handleConfirmStop}>
            Stop Anyway
          </Button>
        </DialogFooter>
      </Dialog>
    </>
  )
}
