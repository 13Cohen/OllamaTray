export const IPC = {
  GET_STATUS: 'ollama:get-status',
  START_SERVICE: 'ollama:start-service',
  STOP_SERVICE: 'ollama:stop-service',
  LIST_MODELS: 'ollama:list-models',
  DELETE_MODEL: 'ollama:delete-model',
  PULL_MODEL: 'ollama:pull-model',
  CANCEL_PULL: 'ollama:cancel-pull',

  STATUS_CHANGED: 'ollama:status-changed',
  PULL_PROGRESS: 'ollama:pull-progress',
  PULL_COMPLETE: 'ollama:pull-complete',

  TOGGLE_PIN: 'window:toggle-pin',
  GET_PINNED: 'window:get-pinned'
} as const
