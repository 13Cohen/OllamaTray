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

  SHOW_MODEL: 'ollama:show-model',
  COPY_MODEL: 'ollama:copy-model',
  CREATE_FROM_MODEL: 'ollama:create-from-model',
  GET_USAGE_STATS: 'ollama:get-usage-stats',

  STATUS_CHANGED: 'ollama:status-changed',
  CREATE_PROGRESS: 'ollama:create-progress',
  CREATE_COMPLETE: 'ollama:create-complete',
  PULL_PROGRESS: 'ollama:pull-progress',
  PULL_COMPLETE: 'ollama:pull-complete',
  OPEN_URL: 'ollama:open-url',
  LIST_RUNNING: 'ollama:list-running',
  UNLOAD_MODEL: 'ollama:unload-model',
  GET_LOG_PATH: 'ollama:get-log-path',

  TOGGLE_PIN: 'window:toggle-pin',
  GET_PINNED: 'window:get-pinned',

  GET_LAUNCH_AT_LOGIN: 'app:get-launch-at-login',
  SET_LAUNCH_AT_LOGIN: 'app:set-launch-at-login',
  GET_THEME: 'app:get-theme',
  SET_THEME: 'app:set-theme',
  THEME_CHANGED: 'app:theme-changed',
  GET_NOTIFICATIONS_ENABLED: 'app:get-notifications-enabled',
  SET_NOTIFICATIONS_ENABLED: 'app:set-notifications-enabled'
} as const
