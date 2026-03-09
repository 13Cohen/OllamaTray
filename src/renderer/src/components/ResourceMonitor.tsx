import { useOllamaStore } from '@renderer/stores/useOllamaStore'
import { formatBytes } from '@renderer/lib/utils'
import { useTranslation } from 'react-i18next'
import { Activity } from 'lucide-react'

export function ResourceMonitor(): React.JSX.Element | null {
  const { t } = useTranslation()
  const status = useOllamaStore((s) => s.status)
  const runningModels = useOllamaStore((s) => s.runningModels)

  if (!status.running || runningModels.length === 0) return null

  const totalSize = runningModels.reduce((sum, m) => sum + m.size, 0)
  const totalVram = runningModels.reduce((sum, m) => sum + m.size_vram, 0)
  const totalRam = totalSize - totalVram

  return (
    <div className="border-b border-border/50">
      <div className="flex items-center gap-1.5 px-4 py-1.5">
        <Activity className="h-3 w-3 text-blue-500" />
        <span className="text-[11px] font-medium text-muted-foreground">{t('resources.title')}</span>
      </div>
      <div className="px-4 pb-2 space-y-1.5">
        {/* Summary bar */}
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          {totalVram > 0 && (
            <span>{t('resources.vram')}: {formatBytes(totalVram)}</span>
          )}
          {totalRam > 0 && (
            <span>{t('resources.ram')}: {formatBytes(totalRam)}</span>
          )}
        </div>
        {/* Per-model bars */}
        {runningModels.map((model) => {
          const vramPercent = model.size > 0 ? (model.size_vram / model.size) * 100 : 0
          const ramPercent = 100 - vramPercent

          return (
            <div key={model.digest} className="space-y-0.5">
              <div className="flex items-center justify-between text-[10px]">
                <span className="truncate text-muted-foreground">{model.name}</span>
                <span className="text-muted-foreground shrink-0 ml-2">{formatBytes(model.size)}</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden flex">
                {model.size_vram > 0 && (
                  <div
                    className="h-full bg-blue-500 rounded-l-full"
                    style={{ width: `${vramPercent}%` }}
                  />
                )}
                {ramPercent > 0 && model.size_vram > 0 && (
                  <div
                    className="h-full bg-amber-500 rounded-r-full"
                    style={{ width: `${ramPercent}%` }}
                  />
                )}
                {model.size_vram === 0 && (
                  <div className="h-full bg-amber-500 rounded-full w-full" />
                )}
              </div>
            </div>
          )
        })}
        {/* Legend */}
        {totalVram > 0 && totalRam > 0 && (
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground pt-0.5">
            <span className="flex items-center gap-1">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-500" />
              {t('resources.vram')}
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />
              {t('resources.ram')}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
