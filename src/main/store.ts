import Store from 'electron-store'

interface StoreSchema {
  envVars: Record<string, string>
  windowBounds: { x: number; y: number } | null
}

const store = new Store<StoreSchema>({
  defaults: {
    envVars: {},
    windowBounds: null
  }
})

export default store
