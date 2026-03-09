import { useState, useEffect } from 'react'
import { Loader2, Copy, Wand2, MessageCircle } from 'lucide-react'
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@renderer/components/ui/dialog'
import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { formatBytes, formatRelativeTime } from '@renderer/lib/utils'
import { useOllamaStore } from '@renderer/stores/useOllamaStore'
import { useTranslation } from 'react-i18next'
import type { OllamaModel, ModelShowResponse } from '../../../shared/types'

interface ModelDetailDialogProps {
  model: OllamaModel | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onCopy: (model: OllamaModel) => void
  onCustomize: (model: OllamaModel) => void
  onChat: (model: OllamaModel) => void
}

export function ModelDetailDialog({
  model,
  open,
  onOpenChange,
  onCopy,
  onCustomize,
  onChat
}: ModelDetailDialogProps): React.JSX.Element {
  const { t } = useTranslation()
  const showModel = useOllamaStore((s) => s.showModel)
  const usageStats = useOllamaStore((s) => s.usageStats)
  const [detail, setDetail] = useState<ModelShowResponse | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open && model) {
      setLoading(true)
      setDetail(null)
      showModel(model.name)
        .then(setDetail)
        .catch(() => setDetail(null))
        .finally(() => setLoading(false))
    }
  }, [open, model?.name])

  const stats = model ? usageStats[model.name] : undefined

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          {model?.name}
          {model?.details.quantization_level && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {model.details.quantization_level}
            </Badge>
          )}
        </DialogTitle>
        <DialogDescription>
          {model && (
            <span className="flex items-center gap-2 text-xs">
              <span>{formatBytes(model.size)}</span>
              {model.details.parameter_size && (
                <>
                  <span>·</span>
                  <span>{model.details.parameter_size}</span>
                </>
              )}
              <span>·</span>
              <span>{formatRelativeTime(model.modified_at)}</span>
            </span>
          )}
        </DialogDescription>
      </DialogHeader>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : detail ? (
        <ScrollArea className="max-h-[300px] mt-3">
          <div className="space-y-3 text-sm">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <span className="text-muted-foreground">{t('detail.format')}</span>
              <span>{detail.details.format}</span>
              <span className="text-muted-foreground">{t('detail.family')}</span>
              <span>{detail.details.family}</span>
              {detail.details.parameter_size && (
                <>
                  <span className="text-muted-foreground">{t('detail.parameters')}</span>
                  <span>{detail.details.parameter_size}</span>
                </>
              )}
              {detail.details.parent_model && (
                <>
                  <span className="text-muted-foreground">{t('detail.parent')}</span>
                  <span className="truncate">{detail.details.parent_model}</span>
                </>
              )}
            </div>

            {/* System Prompt */}
            {detail.system && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">{t('detail.systemPrompt')}</p>
                <pre className="text-xs bg-muted/50 rounded p-2 whitespace-pre-wrap break-words max-h-[80px] overflow-auto">
                  {detail.system}
                </pre>
              </div>
            )}

            {/* Template */}
            {detail.template && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">{t('detail.template')}</p>
                <pre className="text-xs bg-muted/50 rounded p-2 whitespace-pre-wrap break-words max-h-[80px] overflow-auto">
                  {detail.template}
                </pre>
              </div>
            )}

            {/* Parameters */}
            {detail.parameters && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">{t('detail.parameters')}</p>
                <pre className="text-xs bg-muted/50 rounded p-2 whitespace-pre-wrap break-words max-h-[60px] overflow-auto">
                  {detail.parameters}
                </pre>
              </div>
            )}

            {/* License */}
            {detail.license && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">{t('detail.license')}</p>
                <pre className="text-xs bg-muted/50 rounded p-2 whitespace-pre-wrap break-words max-h-[60px] overflow-auto">
                  {detail.license}
                </pre>
              </div>
            )}

            {/* Usage Stats */}
            {stats && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">{t('detail.usage')}</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <span className="text-muted-foreground">{t('detail.timesUsed')}</span>
                  <span>{stats.useCount}</span>
                  <span className="text-muted-foreground">{t('detail.lastUsed')}</span>
                  <span>{formatRelativeTime(stats.lastUsedAt)}</span>
                  <span className="text-muted-foreground">{t('detail.firstUsed')}</span>
                  <span>{formatRelativeTime(stats.firstUsedAt)}</span>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      ) : null}

      {model && (
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" size="sm" className="gap-1" onClick={() => onChat(model)}>
            <MessageCircle className="h-3 w-3" />
            {t('detail.chat')}
          </Button>
          <Button variant="outline" size="sm" className="gap-1" onClick={() => onCopy(model)}>
            <Copy className="h-3 w-3" />
            {t('detail.copy')}
          </Button>
          <Button variant="outline" size="sm" className="gap-1" onClick={() => onCustomize(model)}>
            <Wand2 className="h-3 w-3" />
            {t('detail.customize')}
          </Button>
        </div>
      )}
    </Dialog>
  )
}
