import { useEffect } from 'react'
import { ServiceStatus } from './components/ServiceStatus'
import { ModelList } from './components/ModelList'
import { PullModelInput } from './components/PullModelInput'
import { PullProgress } from './components/PullProgress'
import { ErrorBanner } from './components/ErrorBanner'
import { useOllamaStore } from './stores/useOllamaStore'

function App(): React.JSX.Element {
  const fetchStatus = useOllamaStore((s) => s.fetchStatus)
  const fetchModels = useOllamaStore((s) => s.fetchModels)
  const setStatus = useOllamaStore((s) => s.setStatus)
  const updatePullProgress = useOllamaStore((s) => s.updatePullProgress)
  const removePullProgress = useOllamaStore((s) => s.removePullProgress)
  const status = useOllamaStore((s) => s.status)

  useEffect(() => {
    fetchStatus()

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

    return () => {
      unsubStatus()
      unsubProgress()
      unsubComplete()
    }
  }, [])

  useEffect(() => {
    if (status.running) {
      fetchModels()
    }
  }, [status.running])

  return (
    <div className="flex flex-col h-full rounded-lg overflow-hidden">
      <ErrorBanner />
      <ServiceStatus />
      <ModelList />
      <PullProgress />
      <PullModelInput />
    </div>
  )
}

export default App
