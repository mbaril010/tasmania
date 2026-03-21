// IPC channel names — single source of truth for main ↔ renderer communication

export const IPC = {
  // Backend operations
  BACKEND_DETECT: 'backend:detect',
  BACKEND_START: 'backend:start',
  BACKEND_STOP: 'backend:stop',
  BACKEND_STATUS: 'backend:status',
  BACKEND_LOGS: 'backend:logs',
  BACKEND_PREFLIGHT_CHECK: 'backend:preflight-check',

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
  SYSTEM_VIDEO_MODELS_DIR: 'system:video-models-dir',

  // Update operations
  UPDATE_CHECK: 'update:check',
  UPDATE_GET_INFO: 'update:get-info',

  // Update events (main → renderer)
  UPDATE_AVAILABLE: 'update:available',
  UPDATE_NOT_AVAILABLE: 'update:not-available',
  UPDATE_ERROR: 'update:error',

  // Image generation operations
  IMAGE_START: 'image:start',
  IMAGE_STOP: 'image:stop',
  IMAGE_STATUS: 'image:status',
  IMAGE_LOGS: 'image:logs',
  IMAGE_GENERATE: 'image:generate',
  IMAGE_GENERATE_IMG2IMG: 'image:generate-img2img',

  IMAGE_RESOLVE_MODEL: 'image:resolve-model',

  // Image events (main → renderer)
  IMAGE_STATUS_CHANGED: 'image:status-changed',
  IMAGE_LOG_LINE: 'image:log-line',

  // Video generation operations (ComfyUI)
  VIDEO_START: 'video:start',
  VIDEO_STOP: 'video:stop',
  VIDEO_STATUS: 'video:status',
  VIDEO_LOGS: 'video:logs',
  VIDEO_GENERATE_TXT2VID: 'video:generate-txt2vid',
  VIDEO_GENERATE_IMG2VID: 'video:generate-img2vid',
  VIDEO_CANCEL: 'video:cancel',
  VIDEO_GET_OUTPUT_DIR: 'video:get-output-dir',

  // Video events (main → renderer)
  VIDEO_STATUS_CHANGED: 'video:status-changed',
  VIDEO_LOG_LINE: 'video:log-line',
  VIDEO_GENERATION_PROGRESS: 'video:generation-progress',

  // Exo cluster operations
  EXO_CONNECT: 'exo:connect',
  EXO_DISCONNECT: 'exo:disconnect',
  EXO_STATUS: 'exo:status',
  EXO_LOGS: 'exo:logs',
  EXO_CLUSTER_STATE: 'exo:cluster-state',
  EXO_LIST_MODELS: 'exo:list-models',
  EXO_SEARCH_MODELS: 'exo:search-models',
  EXO_ADD_MODEL: 'exo:add-model',
  EXO_DELETE_MODEL: 'exo:delete-model',
  EXO_INSTANCE_PREVIEW: 'exo:instance-preview',
  EXO_CREATE_INSTANCE: 'exo:create-instance',
  EXO_DELETE_INSTANCE: 'exo:delete-instance',
  EXO_START_DOWNLOAD: 'exo:start-download',
  EXO_CANCEL_DOWNLOAD: 'exo:cancel-download',

  // Exo events (main → renderer)
  EXO_STATUS_CHANGED: 'exo:status-changed',
  EXO_LOG_LINE: 'exo:log-line',
  EXO_CLUSTER_CHANGED: 'exo:cluster-changed',
  EXO_DOWNLOAD_PROGRESS: 'exo:download-progress',

  // ComfyUI install operations
  COMFYUI_INSTALL_STATUS: 'comfyui:install-status',
  COMFYUI_INSTALL_START: 'comfyui:install-start',
  COMFYUI_INSTALL_CANCEL: 'comfyui:install-cancel',
  COMFYUI_UNINSTALL: 'comfyui:uninstall',
  COMFYUI_CHECK_PYTHON: 'comfyui:check-python',

  // ComfyUI install events (main → renderer)
  COMFYUI_INSTALL_PROGRESS: 'comfyui:install-progress',

  // Web operations
  WEB_SEARCH: 'web:search',
  WEB_FETCH: 'web:fetch',

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
