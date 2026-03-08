import Store from 'electron-store'
import type { ModelUsageStats, ThemeMode } from '../shared/types'

interface StoreSchema {
  envVars: Record<string, string>
  ollamaHost: string
  ollamaModelsDir: string
  windowBounds: { x: number; y: number } | null
  modelUsageStats: Record<string, ModelUsageStats>
  launchAtLogin: boolean
  theme: ThemeMode
  notificationsEnabled: boolean
}

const store = new Store<StoreSchema>({
  defaults: {
    envVars: {},
    ollamaHost: '127.0.0.1:11434',
    ollamaModelsDir: '',
    windowBounds: null,
    modelUsageStats: {},
    launchAtLogin: false,
    theme: 'system',
    notificationsEnabled: true
  }
})

export default store
