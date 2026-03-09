import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@renderer/components/ui/dialog'
import { Button } from '@renderer/components/ui/button'
import { formatBytes } from '@renderer/lib/utils'
import { Trans, useTranslation } from 'react-i18next'
import type { OllamaModel } from '../../../shared/types'

interface ModelDeleteDialogProps {
  model: OllamaModel | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

export function ModelDeleteDialog({
  model,
  open,
  onOpenChange,
  onConfirm
}: ModelDeleteDialogProps): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>{t('models.deleteTitle')}</DialogTitle>
        <DialogDescription>
          <Trans
            i18nKey="models.deleteConfirm"
            values={{ name: model?.name ?? '', size: model ? formatBytes(model.size) : '' }}
            components={{ strong: <strong /> }}
          />
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
          {t('models.cancel')}
        </Button>
        <Button variant="destructive" size="sm" onClick={onConfirm}>
          {t('models.delete')}
        </Button>
      </DialogFooter>
    </Dialog>
  )
}
