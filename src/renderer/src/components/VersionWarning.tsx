import { AlertTriangle, ExternalLink } from 'lucide-react'
import { useOllamaStore } from '@renderer/stores/useOllamaStore'
import { MIN_OLLAMA_VERSION } from '../../../shared/types'

function isVersionAtLeast(version: string, minimum: string): boolean {
  const v = version.split('.').map(Number)
  const m = minimum.split('.').map(Number)
  for (let i = 0; i < Math.max(v.length, m.length); i++) {
    const a = v[i] || 0
    const b = m[i] || 0
    if (a > b) return true
    if (a < b) return false
  }
  return true
}

export function VersionWarning(): React.JSX.Element | null {
  const status = useOllamaStore((s) => s.status)

  if (!status.running || !status.version) return null
  if (isVersionAtLeast(status.version, MIN_OLLAMA_VERSION)) return null

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 border-b border-amber-500/20 text-xs">
      <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
      <span className="flex-1">
        Ollama {status.version} is outdated. Version {MIN_OLLAMA_VERSION}+ is required for full
        functionality.
      </span>
      <button
        className="text-amber-500 hover:text-amber-400 underline underline-offset-2 shrink-0 flex items-center gap-1"
        onClick={() => window.electronAPI.openUrl('https://ollama.com/download')}
      >
        Update
        <ExternalLink className="h-3 w-3" />
      </button>
    </div>
  )
}
