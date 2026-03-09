import { Trash2 } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Badge } from '@renderer/components/ui/badge'
import { formatBytes, formatRelativeTime } from '@renderer/lib/utils'
import { useTranslation } from 'react-i18next'
import type { OllamaModel, ModelUsageStats } from '../../../shared/types'

interface ModelItemProps {
  model: OllamaModel
  stats?: ModelUsageStats
  onDelete: (model: OllamaModel) => void
  onSelect: (model: OllamaModel) => void
}

export function ModelItem({ model, stats, onDelete, onSelect }: ModelItemProps): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <div
      className="group flex items-center justify-between px-4 py-2.5 hover:bg-accent/50 transition-colors cursor-pointer"
      onClick={() => onSelect(model)}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{model.name}</span>
          {model.details.quantization_level && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {model.details.quantization_level}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
          <span>{formatBytes(model.size)}</span>
          {model.details.parameter_size && (
            <>
              <span>·</span>
              <span>{model.details.parameter_size}</span>
            </>
          )}
          <span>·</span>
          <span>{formatRelativeTime(model.modified_at)}</span>
          {stats && (
            <>
              <span>·</span>
              <span>{t('models.used', { count: stats.useCount })}</span>
            </>
          )}
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
        onClick={(e) => {
          e.stopPropagation()
          onDelete(model)
        }}
        aria-label={`Delete ${model.name}`}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}
