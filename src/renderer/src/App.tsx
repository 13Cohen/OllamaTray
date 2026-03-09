import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import './i18n'
import { ServiceStatus } from './components/ServiceStatus'
import { RunningModels } from './components/RunningModels'
import { ResourceMonitor } from './components/ResourceMonitor'
import { ModelList } from './components/ModelList'
import { PullModelInput } from './components/PullModelInput'
import { PullProgress } from './components/PullProgress'
import { ErrorBanner } from './components/ErrorBanner'
import { VersionWarning } from './components/VersionWarning'
import { Settings } from './components/Settings'
import { ChatTest } from './components/ChatTest'
import { useOllamaStore } from './stores/useOllamaStore'

function applyThemeClass(shouldUseDark: boolean): void {
  document.documentElement.classList.toggle('dark', shouldUseDark)
}

type View = 'main' | 'settings' | 'chat'

function App(): React.JSX.Element {
  const { i18n } = useTranslation()
  const fetchStatus = useOllamaStore((s) => s.fetchStatus)
  const fetchModels = useOllamaStore((s) => s.fetchModels)
  const fetchUsageStats = useOllamaStore((s) => s.fetchUsageStats)
  const setStatus = useOllamaStore((s) => s.setStatus)
  const updatePullProgress = useOllamaStore((s) => s.updatePullProgress)
  const removePullProgress = useOllamaStore((s) => s.removePullProgress)
  const status = useOllamaStore((s) => s.status)
  const [view, setView] = useState<View>('main')
  const [chatModel, setChatModel] = useState<string | undefined>()

  useEffect(() => {
    fetchStatus()

    // Load saved language
    window.electronAPI.getLanguage().then((lang) => {
      i18n.changeLanguage(lang)
    })

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

    const unsubCreateProgress = window.electronAPI.onCreateProgress((progress) => {
      updatePullProgress(progress)
    })

    const unsubCreateComplete = window.electronAPI.onCreateComplete((result) => {
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
      unsubCreateProgress()
      unsubCreateComplete()
      unsubTheme()
    }
  }, [])

  useEffect(() => {
    if (status.running) {
      fetchModels()
      fetchUsageStats()
    }
  }, [status.running])

  const openChat = (modelName?: string): void => {
    setChatModel(modelName)
    setView('chat')
  }

  if (view === 'settings') {
    return (
      <div className="flex flex-col h-full rounded-lg overflow-hidden">
        <Settings onBack={() => setView('main')} />
      </div>
    )
  }

  if (view === 'chat') {
    return (
      <div className="flex flex-col h-full rounded-lg overflow-hidden">
        <ChatTest initialModel={chatModel} onBack={() => setView('main')} />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full rounded-lg overflow-hidden">
      <ErrorBanner />
      <VersionWarning />
      <ServiceStatus onOpenSettings={() => setView('settings')} />
      <RunningModels />
      <ResourceMonitor />
      <ModelList onOpenChat={openChat} />
      <PullProgress />
      <PullModelInput />
    </div>
  )
}

export default App
