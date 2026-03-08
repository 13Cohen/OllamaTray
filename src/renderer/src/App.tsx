import { useEffect, useState } from 'react'
import { ServiceStatus } from './components/ServiceStatus'
import { RunningModels } from './components/RunningModels'
import { ModelList } from './components/ModelList'
import { PullModelInput } from './components/PullModelInput'
import { PullProgress } from './components/PullProgress'
import { ErrorBanner } from './components/ErrorBanner'
import { VersionWarning } from './components/VersionWarning'
import { Settings } from './components/Settings'
import { useOllamaStore } from './stores/useOllamaStore'

function applyThemeClass(shouldUseDark: boolean): void {
  document.documentElement.classList.toggle('dark', shouldUseDark)
}

function App(): React.JSX.Element {
  const fetchStatus = useOllamaStore((s) => s.fetchStatus)
  const fetchModels = useOllamaStore((s) => s.fetchModels)
  const setStatus = useOllamaStore((s) => s.setStatus)
  const updatePullProgress = useOllamaStore((s) => s.updatePullProgress)
  const removePullProgress = useOllamaStore((s) => s.removePullProgress)
  const status = useOllamaStore((s) => s.status)
  const [view, setView] = useState<'main' | 'settings'>('main')

  useEffect(() => {
    fetchStatus()

    // Initialize theme from system preference, main process will send correct value
    applyThemeClass(window.matchMedia('(prefers-color-scheme: dark)').matches)

    const unsubStatus = window.electronAPI.onStatusChanged((newStatus) => {
      setStatus(newStatus)
    })

    const unsubProgress = window.electronAPI.onPullProgress((progress) => {
      updatePullProgress(progress)
    })

    const unsubComplete = window.electronAPI.onPullComplete((result) => {
      removePullProgress(result.modelName)
      if (result.success) {
        fetchModels()
      }
    })

    const unsubTheme = window.electronAPI.onThemeChanged((shouldUseDark) => {
      applyThemeClass(shouldUseDark)
    })

    return () => {
      unsubStatus()
      unsubProgress()
      unsubComplete()
      unsubTheme()
    }
  }, [])

  useEffect(() => {
    if (status.running) {
      fetchModels()
    }
  }, [status.running])

  if (view === 'settings') {
    return (
      <div className="flex flex-col h-full rounded-lg overflow-hidden">
        <Settings onBack={() => setView('main')} />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full rounded-lg overflow-hidden">
      <ErrorBanner />
      <VersionWarning />
      <ServiceStatus onOpenSettings={() => setView('settings')} />
      <RunningModels />
      <ModelList />
      <PullProgress />
      <PullModelInput />
    </div>
  )
}

export default App
