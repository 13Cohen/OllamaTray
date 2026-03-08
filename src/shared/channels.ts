export const IPC = {
  GET_STATUS: 'ollama:get-status',
  START_SERVICE: 'ollama:start-service',
  STOP_SERVICE: 'ollama:stop-service',
  LIST_MODELS: 'ollama:list-models',
  DELETE_MODEL: 'ollama:delete-model',
  PULL_MODEL: 'ollama:pull-model',
  CANCEL_PULL: 'ollama:cancel-pull',

  GET_CONFIG: 'ollama:get-config',
  SET_CONFIG: 'ollama:set-config',
  SELECT_DIRECTORY: 'ollama:select-directory',
  SCAN_GGUF_MODELS: 'ollama:scan-gguf-models',
  IMPORT_MODEL: 'ollama:import-model',

  STATUS_CHANGED: 'ollama:status-changed',
  PULL_PROGRESS: 'ollama:pull-progress',
  PULL_COMPLETE: 'ollama:pull-complete',
  OPEN_URL: 'ollama:open-url',
  GET_LOG_PATH: 'ollama:get-log-path'
} as const
