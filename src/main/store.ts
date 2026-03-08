import Store from 'electron-store'

interface StoreSchema {
  envVars: Record<string, string>
  ollamaHost: string
  ollamaModelsDir: string
  windowBounds: { x: number; y: number } | null
}

const store = new Store<StoreSchema>({
  defaults: {
    envVars: {},
    ollamaHost: '127.0.0.1:11434',
    ollamaModelsDir: '',
    windowBounds: null
  }
})

export default store
