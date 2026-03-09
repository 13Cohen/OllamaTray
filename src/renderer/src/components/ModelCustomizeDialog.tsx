import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@renderer/components/ui/dialog'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { useOllamaStore } from '@renderer/stores/useOllamaStore'
import { Trans, useTranslation } from 'react-i18next'
import type { OllamaModel } from '../../../shared/types'

interface ModelCustomizeDialogProps {
  model: OllamaModel | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ModelCustomizeDialog({
  model,
  open,
  onOpenChange
}: ModelCustomizeDialogProps): React.JSX.Element {
  const { t } = useTranslation()
  const createFromModel = useOllamaStore((s) => s.createFromModel)
  const [newName, setNewName] = useState('')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [temperature, setTemperature] = useState('')
  const [numCtx, setNumCtx] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (open) {
      setNewName('')
      setSystemPrompt('')
      setTemperature('')
      setNumCtx('')
    }
  }, [open, model])

  const handleCreate = async (): Promise<void> => {
    if (!model || !newName.trim()) return
    setCreating(true)
    try {
      const parameters: Record<string, unknown> = {}
      if (temperature) parameters.temperature = parseFloat(temperature)
      if (numCtx) parameters.num_ctx = parseInt(numCtx)

      await createFromModel({
        model: newName.trim(),
        from: model.name,
        system: systemPrompt || undefined,
        parameters: Object.keys(parameters).length > 0 ? parameters : undefined
      })
      resetForm()
      onOpenChange(false)
    } catch {
      // error is set in store
    } finally {
      setCreating(false)
    }
  }

  const resetForm = (): void => {
    setNewName('')
    setSystemPrompt('')
    setTemperature('')
    setNumCtx('')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>{t('customizeDialog.title')}</DialogTitle>
        <DialogDescription>
          <Trans
            i18nKey="customizeDialog.description"
            values={{ name: model?.name ?? '' }}
            components={{ strong: <strong /> }}
          />
        </DialogDescription>
      </DialogHeader>
      <div className="mt-3 space-y-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">
            {t('customizeDialog.nameLabel')}
          </label>
          <Input
            placeholder={t('customizeDialog.namePlaceholder')}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="text-sm"
            autoFocus
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">
            {t('customizeDialog.systemPromptLabel')}
          </label>
          <textarea
            placeholder={t('customizeDialog.systemPromptPlaceholder')}
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-h-[60px] resize-y"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              {t('customizeDialog.temperatureLabel')}
            </label>
            <Input
              type="number"
              step="0.1"
              min="0"
              max="2"
              placeholder="0.7"
              value={temperature}
              onChange={(e) => setTemperature(e.target.value)}
              className="text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              {t('customizeDialog.contextLengthLabel')}
            </label>
            <Input
              type="number"
              step="1024"
              min="512"
              placeholder="4096"
              value={numCtx}
              onChange={(e) => setNumCtx(e.target.value)}
              className="text-sm"
            />
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={creating}>
          {t('models.cancel')}
        </Button>
        <Button size="sm" onClick={handleCreate} disabled={!newName.trim() || creating}>
          {creating ? t('customizeDialog.creating') : t('customizeDialog.create')}
        </Button>
      </DialogFooter>
    </Dialog>
  )
}
