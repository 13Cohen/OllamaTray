import { useEffect } from 'react'
import { Cpu, Square } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Badge } from '@renderer/components/ui/badge'
import { useOllamaStore } from '@renderer/stores/useOllamaStore'
import { formatBytes } from '@renderer/lib/utils'

export function RunningModels(): React.JSX.Element | null {
  const status = useOllamaStore((s) => s.status)
  const runningModels = useOllamaStore((s) => s.runningModels)
  const fetchRunningModels = useOllamaStore((s) => s.fetchRunningModels)
  const unloadModel = useOllamaStore((s) => s.unloadModel)

  useEffect(() => {
    if (!status.running) return
    fetchRunningModels()
    const interval = setInterval(fetchRunningModels, 5000)
    return () => clearInterval(interval)
  }, [status.running])

  if (!status.running || runningModels.length === 0) return null

  return (
    <div className="border-b border-border/50">
      <div className="flex items-center gap-1.5 px-4 py-1.5">
        <Cpu className="h-3 w-3 text-emerald-500" />
        <span className="text-[11px] font-medium text-muted-foreground">Running</span>
        <Badge variant="secondary" className="text-[10px] px-1 py-0 ml-auto">
          {runningModels.length}
        </Badge>
      </div>
      <div className="divide-y divide-border/20">
        {runningModels.map((model) => (
          <div
            key={model.digest}
            className="group flex items-center justify-between px-4 py-2 hover:bg-accent/50 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <span className="text-xs font-medium truncate block">{model.name}</span>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                <span>{formatBytes(model.size)}</span>
                {model.size_vram > 0 && (
                  <>
                    <span>·</span>
                    <span>VRAM {formatBytes(model.size_vram)}</span>
                  </>
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
              onClick={() => unloadModel(model.name)}
              title="Unload model"
            >
              <Square className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}
