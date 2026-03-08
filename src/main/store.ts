import Store from 'electron-store'
import type { ModelUsageStats } from '../shared/types'

interface StoreSchema {
  envVars: Record<string, string>
  ollamaHost: string
  ollamaModelsDir: string
  windowBounds: { x: number; y: number } | null
  modelUsageStats: Record<string, ModelUsageStats>
}

const store = new Store<StoreSchema>({
  defaults: {
    envVars: {},
    ollamaHost: '127.0.0.1:11434',
    ollamaModelsDir: '',
    windowBounds: null,
    modelUsageStats: {}
  }
})

export default store
