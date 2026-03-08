import { useState } from 'react'
import { Download } from 'lucide-react'
import { Input } from '@renderer/components/ui/input'
import { Button } from '@renderer/components/ui/button'
import { useOllamaStore } from '@renderer/stores/useOllamaStore'

export function PullModelInput(): React.JSX.Element | null {
  const status = useOllamaStore((s) => s.status)
  const pullModel = useOllamaStore((s) => s.pullModel)
  const [modelName, setModelName] = useState('')

  if (!status.running) return null

  const handlePull = (): void => {
    const name = modelName.trim()
    if (!name) return
    pullModel(name)
    setModelName('')
  }

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter') handlePull()
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2.5 border-t border-border/50">
      <Input
        placeholder="Pull model (e.g. llama3.2:3b)"
        value={modelName}
        onChange={(e) => setModelName(e.target.value)}
        onKeyDown={handleKeyDown}
        className="h-8 text-xs"
      />
      <Button size="sm" className="h-8 shrink-0" onClick={handlePull} disabled={!modelName.trim()}>
        <Download className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}
