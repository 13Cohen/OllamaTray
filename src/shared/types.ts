export type OllamaStartSource = 'managed' | 'brew' | 'external' | 'unknown'

export interface OllamaStatus {
  running: boolean
  source: OllamaStartSource
  version?: string
}

export const MIN_OLLAMA_VERSION = '0.5.0'

export interface OllamaModelDetails {
  parent_model: string
  format: string
  family: string
  families: string[] | null
  parameter_size: string
  quantization_level: string
}

export interface OllamaModel {
  name: string
  model: string
  modified_at: string
  size: number
  digest: string
  details: OllamaModelDetails
}

export interface PullProgress {
  modelName: string
  status: string
  digest?: string
  total?: number
  completed?: number
}

export interface PullComplete {
  modelName: string
  success: boolean
  error?: string
}

export interface OllamaConfig {
  ollamaHost: string
  ollamaModelsDir: string
  defaultModelsDir: string
}

export interface GgufFileInfo {
  filePaths: string[]
  fileName: string
  suggestedName: string
  sizeBytes: number
}

export interface ElectronAPI {
  getConfig: () => Promise<OllamaConfig>
  setConfig: (config: Partial<OllamaConfig>) => Promise<void>
  selectDirectory: () => Promise<string | null>
  scanGgufModels: () => Promise<GgufFileInfo[] | null>
  importModel: (name: string, filePaths: string[]) => Promise<void>
  getStatus: () => Promise<OllamaStatus>
  startService: () => Promise<void>
  stopService: () => Promise<void>
  listModels: () => Promise<OllamaModel[]>
  deleteModel: (name: string) => Promise<void>
  pullModel: (name: string) => Promise<void>
  cancelPull: (name: string) => Promise<void>
  onStatusChanged: (callback: (status: OllamaStatus) => void) => () => void
  onPullProgress: (callback: (progress: PullProgress) => void) => () => void
  onPullComplete: (callback: (result: PullComplete) => void) => () => void
  openUrl: (url: string) => void
  getLogPath: () => Promise<string>
}
