import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@renderer/components/ui/dialog'
import { Button } from '@renderer/components/ui/button'
import { formatBytes } from '@renderer/lib/utils'
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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>Delete Model</DialogTitle>
        <DialogDescription>
          Are you sure you want to delete <strong>{model?.name}</strong>
          {model ? ` (${formatBytes(model.size)})` : ''}? This action cannot be undone.
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button variant="destructive" size="sm" onClick={onConfirm}>
          Delete
        </Button>
      </DialogFooter>
    </Dialog>
  )
}
