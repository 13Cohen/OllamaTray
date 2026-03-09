import { useState } from 'react'
import { Search, ArrowUpDown, Package } from 'lucide-react'
import { Input } from '@renderer/components/ui/input'
import { Button } from '@renderer/components/ui/button'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { ModelItem } from './ModelItem'
import { ModelDeleteDialog } from './ModelDeleteDialog'
import { ModelDetailDialog } from './ModelDetailDialog'
import { ModelCopyDialog } from './ModelCopyDialog'
import { ModelCustomizeDialog } from './ModelCustomizeDialog'
import { useOllamaStore, useFilteredModels } from '@renderer/stores/useOllamaStore'
import { useTranslation } from 'react-i18next'
import type { OllamaModel } from '../../../shared/types'

interface ModelListProps {
  onOpenChat: (modelName: string) => void
}

export function ModelList({ onOpenChat }: ModelListProps): React.JSX.Element {
  const { t } = useTranslation()
  const status = useOllamaStore((s) => s.status)
  const searchQuery = useOllamaStore((s) => s.searchQuery)
  const setSearchQuery = useOllamaStore((s) => s.setSearchQuery)
  const sortBy = useOllamaStore((s) => s.sortBy)
  const setSortBy = useOllamaStore((s) => s.setSortBy)
  const toggleSortOrder = useOllamaStore((s) => s.toggleSortOrder)
  const deleteModel = useOllamaStore((s) => s.deleteModel)
  const usageStats = useOllamaStore((s) => s.usageStats)
  const filteredModels = useFilteredModels()

  const [deleteTarget, setDeleteTarget] = useState<OllamaModel | null>(null)
  const [detailTarget, setDetailTarget] = useState<OllamaModel | null>(null)
  const [copyTarget, setCopyTarget] = useState<OllamaModel | null>(null)
  const [customizeTarget, setCustomizeTarget] = useState<OllamaModel | null>(null)

  if (!status.running) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground py-12">
        <Package className="h-8 w-8 mb-2 opacity-40" />
        <p className="text-sm">{t('models.startToView')}</p>
      </div>
    )
  }

  const cycleSortBy = (): void => {
    const order = ['modified_at', 'name', 'size'] as const
    const idx = order.indexOf(sortBy as (typeof order)[number])
    const next = order[(idx + 1) % order.length]
    setSortBy(next)
    if (next !== sortBy) return
    toggleSortOrder()
  }

  const sortLabel = sortBy === 'name' ? t('models.sortName') : sortBy === 'size' ? t('models.sortSize') : t('models.sortRecent')

  return (
    <>
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder={t('models.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>
        <Button variant="ghost" size="sm" className="h-8 text-xs gap-1" onClick={cycleSortBy}>
          <ArrowUpDown className="h-3 w-3" />
          {sortLabel}
        </Button>
      </div>

      <ScrollArea className="flex-1">
        {filteredModels.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-muted-foreground py-12">
            <p className="text-sm">{searchQuery ? t('models.noMatching') : t('models.noInstalled')}</p>
          </div>
        ) : (
          <div className="divide-y divide-border/30">
            {filteredModels.map((model) => (
              <ModelItem
                key={model.digest}
                model={model}
                stats={usageStats[model.name]}
                onDelete={setDeleteTarget}
                onSelect={setDetailTarget}
              />
            ))}
          </div>
        )}
      </ScrollArea>

      <ModelDeleteDialog
        model={deleteTarget}
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            deleteModel(deleteTarget.name)
            setDeleteTarget(null)
          }
        }}
      />

      <ModelDetailDialog
        model={detailTarget}
        open={!!detailTarget}
        onOpenChange={(open) => !open && setDetailTarget(null)}
        onCopy={(m) => {
          setDetailTarget(null)
          setCopyTarget(m)
        }}
        onCustomize={(m) => {
          setDetailTarget(null)
          setCustomizeTarget(m)
        }}
        onChat={(m) => {
          setDetailTarget(null)
          onOpenChat(m.name)
        }}
      />

      <ModelCopyDialog
        model={copyTarget}
        open={!!copyTarget}
        onOpenChange={(open) => !open && setCopyTarget(null)}
      />

      <ModelCustomizeDialog
        model={customizeTarget}
        open={!!customizeTarget}
        onOpenChange={(open) => !open && setCustomizeTarget(null)}
      />
    </>
  )
}
