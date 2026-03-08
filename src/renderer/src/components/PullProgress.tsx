import { X } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Progress } from '@renderer/components/ui/progress'
import { useOllamaStore } from '@renderer/stores/useOllamaStore'
import { formatBytes, formatSpeed, formatETA } from '@renderer/lib/utils'

export function PullProgress(): React.JSX.Element | null {
  const activeDownloads = useOllamaStore((s) => s.activeDownloads)
  const cancelPull = useOllamaStore((s) => s.cancelPull)

  if (activeDownloads.size === 0) return null

  return (
    <div className="border-t border-border/50">
      {Array.from(activeDownloads.values()).map((dl) => {
        const percent = dl.total > 0 ? (dl.completed / dl.total) * 100 : 0
        const elapsed = (Date.now() - dl.startedAt) / 1000
        const speed = elapsed > 0 && dl.completed > 0 ? dl.completed / elapsed : 0
        const remaining = speed > 0 && dl.total > 0 ? (dl.total - dl.completed) / speed : -1

        return (
          <div key={dl.modelName} className="px-3 py-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium truncate">{dl.modelName}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 text-muted-foreground hover:text-destructive"
                onClick={() => cancelPull(dl.modelName)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
            <Progress value={percent} className="mb-1" />
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>{dl.status}</span>
              {dl.total > 0 && (
                <span>
                  {formatBytes(dl.completed)} / {formatBytes(dl.total)}
                  {speed > 0 && ` · ${formatSpeed(speed)}`}
                  {remaining > 0 && ` · ${formatETA(remaining)}`}
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
