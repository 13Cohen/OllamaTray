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
import type { OllamaModel } from '../../../shared/types'

interface ModelCopyDialogProps {
  model: OllamaModel | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ModelCopyDialog({ model, open, onOpenChange }: ModelCopyDialogProps): React.JSX.Element {
  const copyModel = useOllamaStore((s) => s.copyModel)
  const [newName, setNewName] = useState('')
  const [copying, setCopying] = useState(false)

  useEffect(() => {
    if (open) setNewName('')
  }, [open, model])

  const handleCopy = async (): Promise<void> => {
    if (!model || !newName.trim()) return
    setCopying(true)
    try {
      await copyModel(model.name, newName.trim())
      setNewName('')
      onOpenChange(false)
    } catch {
      // error is set in store
    } finally {
      setCopying(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>Copy Model</DialogTitle>
        <DialogDescription>
          Create a copy of <strong>{model?.name}</strong> with a new name.
        </DialogDescription>
      </DialogHeader>
      <div className="mt-3">
        <Input
          placeholder="New model name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className="text-sm"
          onKeyDown={(e) => e.key === 'Enter' && handleCopy()}
          autoFocus
        />
      </div>
      <DialogFooter>
        <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={copying}>
          Cancel
        </Button>
        <Button size="sm" onClick={handleCopy} disabled={!newName.trim() || copying}>
          {copying ? 'Copying...' : 'Copy'}
        </Button>
      </DialogFooter>
    </Dialog>
  )
}
