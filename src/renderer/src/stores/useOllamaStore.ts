import { create } from 'zustand'
import type { OllamaModel, OllamaStatus, PullProgress } from '../../../shared/types'

export type SortBy = 'name' | 'size' | 'modified_at'
export type SortOrder = 'asc' | 'desc'

interface DownloadState {
  modelName: string
  status: string
  total: number
  completed: number
  startedAt: number
  speedSamples: number[]
}

interface OllamaState {
  status: OllamaStatus
  models: OllamaModel[]
  searchQuery: string
  sortBy: SortBy
  sortOrder: SortOrder
  loading: boolean
  error: string | null
  activeDownloads: Map<string, DownloadState>

  setStatus: (status: OllamaStatus) => void
  setModels: (models: OllamaModel[]) => void
  setSearchQuery: (query: string) => void
  setSortBy: (sortBy: SortBy) => void
  toggleSortOrder: () => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void

  updatePullProgress: (progress: PullProgress) => void
  removePullProgress: (modelName: string) => void

  fetchStatus: () => Promise<void>
  fetchModels: () => Promise<void>
  startService: () => Promise<void>
  stopService: () => Promise<void>
  deleteModel: (name: string) => Promise<void>
  pullModel: (name: string) => Promise<void>
  importModel: (name: string, filePaths: string[]) => Promise<void>
  cancelPull: (name: string) => Promise<void>
}

function getFilteredModels(
  models: OllamaModel[],
  searchQuery: string,
  sortBy: SortBy,
  sortOrder: SortOrder
): OllamaModel[] {
  let filtered = models
  if (searchQuery) {
    const q = searchQuery.toLowerCase()
    filtered = models.filter((m) => m.name.toLowerCase().includes(q))
  }
  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0
    switch (sortBy) {
      case 'name':
        cmp = a.name.localeCompare(b.name)
        break
      case 'size':
        cmp = a.size - b.size
        break
      case 'modified_at':
        cmp = new Date(a.modified_at).getTime() - new Date(b.modified_at).getTime()
        break
    }
    return sortOrder === 'asc' ? cmp : -cmp
  })
  return sorted
}

export const useOllamaStore = create<OllamaState>((set, get) => ({
  status: { running: false, source: 'unknown' },
  models: [],
  searchQuery: '',
  sortBy: 'modified_at',
  sortOrder: 'desc',
  loading: false,
  error: null,
  activeDownloads: new Map(),

  setStatus: (status) => set({ status }),
  setModels: (models) => set({ models }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setSortBy: (sortBy) => set({ sortBy }),
  toggleSortOrder: () => set((s) => ({ sortOrder: s.sortOrder === 'asc' ? 'desc' : 'asc' })),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),

  updatePullProgress: (progress) => {
    set((state) => {
      const downloads = new Map(state.activeDownloads)
      const existing = downloads.get(progress.modelName)
      const now = Date.now()

      let speedSamples = existing?.speedSamples ?? []
      if (existing && progress.completed && existing.completed) {
        const elapsed = (now - existing.startedAt) / 1000
        if (elapsed > 0) {
          const byteDiff = progress.completed - existing.completed
          if (byteDiff > 0) {
            speedSamples = [...speedSamples.slice(-4), byteDiff / ((now - existing.startedAt) / 1000 - (speedSamples.length > 0 ? speedSamples.length * 0.5 : 0))]
          }
        }
      }

      downloads.set(progress.modelName, {
        modelName: progress.modelName,
        status: progress.status,
        total: progress.total ?? existing?.total ?? 0,
        completed: progress.completed ?? existing?.completed ?? 0,
        startedAt: existing?.startedAt ?? now,
        speedSamples: progress.completed ? speedSamples : existing?.speedSamples ?? []
      })
      return { activeDownloads: downloads }
    })
  },

  removePullProgress: (modelName) => {
    set((state) => {
      const downloads = new Map(state.activeDownloads)
      downloads.delete(modelName)
      return { activeDownloads: downloads }
    })
  },

  fetchStatus: async () => {
    try {
      const status = await window.electronAPI.getStatus()
      set({ status })
    } catch {
      set({ status: { running: false, source: 'unknown' } })
    }
  },

  fetchModels: async () => {
    set({ loading: true, error: null })
    try {
      const models = await window.electronAPI.listModels()
      set({ models, loading: false })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to fetch models', loading: false })
    }
  },

  startService: async () => {
    set({ loading: true, error: null })
    try {
      await window.electronAPI.startService()
      await get().fetchStatus()
      set({ loading: false })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to start service', loading: false })
    }
  },

  stopService: async () => {
    set({ loading: true, error: null })
    try {
      await window.electronAPI.stopService()
      await get().fetchStatus()
      set({ loading: false, models: [] })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to stop service', loading: false })
    }
  },

  deleteModel: async (name) => {
    try {
      await window.electronAPI.deleteModel(name)
      await get().fetchModels()
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to delete model' })
    }
  },

  pullModel: async (name) => {
    try {
      set({ error: null })
      await window.electronAPI.pullModel(name)
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to pull model' })
    }
  },

  importModel: async (name, filePaths) => {
    try {
      set({ error: null })
      await window.electronAPI.importModel(name, filePaths)
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to import model' })
    }
  },

  cancelPull: async (name) => {
    try {
      await window.electronAPI.cancelPull(name)
      get().removePullProgress(name)
    } catch {
      // ignore
    }
  }
}))

export function useFilteredModels(): OllamaModel[] {
  const models = useOllamaStore((s) => s.models)
  const searchQuery = useOllamaStore((s) => s.searchQuery)
  const sortBy = useOllamaStore((s) => s.sortBy)
  const sortOrder = useOllamaStore((s) => s.sortOrder)
  return getFilteredModels(models, searchQuery, sortBy, sortOrder)
}
