// IPC channel names — single source of truth for main ↔ renderer communication

export const IPC = {
  // Backend operations
  BACKEND_DETECT: 'backend:detect',
  BACKEND_START: 'backend:start',
  BACKEND_STOP: 'backend:stop',
  BACKEND_STATUS: 'backend:status',
  BACKEND_LOGS: 'backend:logs',

  // Backend events (main → renderer)
  BACKEND_STATUS_CHANGED: 'backend:status-changed',
  BACKEND_LOG_LINE: 'backend:log-line',

  // Model operations
  MODEL_LIST_LOCAL: 'model:list-local',
  MODEL_DELETE: 'model:delete',
  MODEL_SEARCH_HF: 'model:search-hf',
  MODEL_LIST_FILES: 'model:list-files',
  MODEL_DOWNLOAD: 'model:download',
  MODEL_CANCEL_DOWNLOAD: 'model:cancel-download',

  // Model events (main → renderer)
  MODEL_DOWNLOAD_PROGRESS: 'model:download-progress',
  MODEL_DOWNLOAD_COMPLETE: 'model:download-complete',
  MODEL_DOWNLOAD_ERROR: 'model:download-error',

  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',

  // System
  SYSTEM_INFO: 'system:info',
  SYSTEM_OPEN_PATH: 'system:open-path',
  SYSTEM_OPEN_EXTERNAL: 'system:open-external',
  SYSTEM_SELECT_DIR: 'system:select-dir',

  // Update operations
  UPDATE_CHECK: 'update:check',
  UPDATE_GET_INFO: 'update:get-info',

  // Update events (main → renderer)
  UPDATE_AVAILABLE: 'update:available',
  UPDATE_NOT_AVAILABLE: 'update:not-available',
  UPDATE_ERROR: 'update:error',

  // Terminal operations
  TERMINAL_CREATE: 'terminal:create',
  TERMINAL_WRITE: 'terminal:write',
  TERMINAL_RESIZE: 'terminal:resize',
  TERMINAL_KILL: 'terminal:kill',

  TERMINAL_KILL_ALL: 'terminal:kill-all',

  // Terminal events (main → renderer)
  TERMINAL_DATA: 'terminal:data',
  TERMINAL_EXIT: 'terminal:exit',
} as const;
