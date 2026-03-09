import Store from 'electron-store'
import type { ModelUsageStats, ThemeMode, Language, ModelProfile } from '../shared/types'

interface StoreSchema {
  envVars: Record<string, string>
  ollamaHost: string
  ollamaModelsDir: string
  windowBounds: { x: number; y: number } | null
  modelUsageStats: Record<string, ModelUsageStats>
  modelProfiles: Record<string, ModelProfile>
  launchAtLogin: boolean
  theme: ThemeMode
  notificationsEnabled: boolean
  language: Language
}

const store = new Store<StoreSchema>({
  defaults: {
    envVars: {},
    ollamaHost: '127.0.0.1:11434',
    ollamaModelsDir: '',
    windowBounds: null,
    modelUsageStats: {},
    modelProfiles: {},
    launchAtLogin: false,
    theme: 'system',
    notificationsEnabled: true,
    language: 'en'
  }
})

export default store
