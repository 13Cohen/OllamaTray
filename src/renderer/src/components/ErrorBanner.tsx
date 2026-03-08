import { AlertCircle, X } from 'lucide-react'
import { useOllamaStore } from '@renderer/stores/useOllamaStore'

export function ErrorBanner(): React.JSX.Element | null {
  const error = useOllamaStore((s) => s.error)
  const setError = useOllamaStore((s) => s.setError)

  if (!error) return null

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-destructive/10 text-destructive text-xs border-b border-destructive/20">
      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
      <span className="flex-1 truncate">{error}</span>
      <button onClick={() => setError(null)} className="shrink-0 hover:opacity-70">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
