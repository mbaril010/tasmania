import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from '../shared/ipc-channels';
import type {
  AppSettings,
  BackendInfo,
  BackendType,
  DownloadProgress,
  ExoClusterState,
  ExoModel,
  HuggingFaceFile,
  HuggingFaceModel,
  ImageGenerationRequest,
  ImageGenerationResult,
  Img2ImgGenerationRequest,
  LocalModel,
  MemoryPreflightResult,
  ModelCategory,
  ModelResolution,
  ServerOptions,
  ServerState,
  UpdateCheckResult,
  UpdateInfo,
  VideoGenerationRequest,
  Img2VidGenerationRequest,
  VideoGenerationResult,
} from '../shared/types';

// Type-safe API exposed to the renderer
const api = {
  // ── Backend ──
  detectBackends: (): Promise<Record<BackendType, BackendInfo>> =>
    ipcRenderer.invoke(IPC.BACKEND_DETECT),

  startServer: (backend: BackendType, modelPath: string, options?: Partial<ServerOptions>): Promise<void> =>
    ipcRenderer.invoke(IPC.BACKEND_START, backend, modelPath, options),

  stopServer: (): Promise<void> =>
    ipcRenderer.invoke(IPC.BACKEND_STOP),

  getServerStatus: (): Promise<ServerState> =>
    ipcRenderer.invoke(IPC.BACKEND_STATUS),

  getServerLogs: (): Promise<string[]> =>
    ipcRenderer.invoke(IPC.BACKEND_LOGS),

  preflightCheck: (modelPath: string): Promise<MemoryPreflightResult> =>
    ipcRenderer.invoke(IPC.BACKEND_PREFLIGHT_CHECK, modelPath),

  onServerStatusChanged: (callback: (state: ServerState) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, state: ServerState) => callback(state);
    ipcRenderer.on(IPC.BACKEND_STATUS_CHANGED, handler);
    return () => ipcRenderer.removeListener(IPC.BACKEND_STATUS_CHANGED, handler);
  },

  onServerLogLine: (callback: (line: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, line: string) => callback(line);
    ipcRenderer.on(IPC.BACKEND_LOG_LINE, handler);
    return () => ipcRenderer.removeListener(IPC.BACKEND_LOG_LINE, handler);
  },

  // ── Models ──
  listLocalModels: (): Promise<LocalModel[]> =>
    ipcRenderer.invoke(IPC.MODEL_LIST_LOCAL),

  deleteModel: (modelPath: string): Promise<void> =>
    ipcRenderer.invoke(IPC.MODEL_DELETE, modelPath),

  searchHuggingFace: (query: string): Promise<HuggingFaceModel[]> =>
    ipcRenderer.invoke(IPC.MODEL_SEARCH_HF, query),

  listModelFiles: (repo: string): Promise<HuggingFaceFile[]> =>
    ipcRenderer.invoke(IPC.MODEL_LIST_FILES, repo),

  downloadModel: (repo: string, filename: string, category?: ModelCategory): Promise<string> =>
    ipcRenderer.invoke(IPC.MODEL_DOWNLOAD, repo, filename, category),

  cancelDownload: (downloadId: string): Promise<void> =>
    ipcRenderer.invoke(IPC.MODEL_CANCEL_DOWNLOAD, downloadId),

  onDownloadProgress: (callback: (progress: DownloadProgress) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, progress: DownloadProgress) => callback(progress);
    ipcRenderer.on(IPC.MODEL_DOWNLOAD_PROGRESS, handler);
    return () => ipcRenderer.removeListener(IPC.MODEL_DOWNLOAD_PROGRESS, handler);
  },

  // ── Settings ──
  getSettings: (): Promise<AppSettings> =>
    ipcRenderer.invoke(IPC.SETTINGS_GET),

  setSettings: (settings: Partial<AppSettings>): Promise<void> =>
    ipcRenderer.invoke(IPC.SETTINGS_SET, settings),

  // ── Update ──
  checkForUpdates: (): Promise<UpdateCheckResult> =>
    ipcRenderer.invoke(IPC.UPDATE_CHECK),

  getUpdateInfo: (): Promise<UpdateInfo | null> =>
    ipcRenderer.invoke(IPC.UPDATE_GET_INFO),

  onUpdateAvailable: (callback: (info: UpdateInfo) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, info: UpdateInfo) => callback(info);
    ipcRenderer.on(IPC.UPDATE_AVAILABLE, handler);
    return () => ipcRenderer.removeListener(IPC.UPDATE_AVAILABLE, handler);
  },

  // ── System ──
  getSystemInfo: (): Promise<{ platform: string; arch: string; memory: number; freeMemory: number }> =>
    ipcRenderer.invoke(IPC.SYSTEM_INFO),

  openPath: (path: string): Promise<void> =>
    ipcRenderer.invoke(IPC.SYSTEM_OPEN_PATH, path),

  openExternal: (url: string): Promise<void> =>
    ipcRenderer.invoke(IPC.SYSTEM_OPEN_EXTERNAL, url),

  selectDirectory: (): Promise<string | null> =>
    ipcRenderer.invoke(IPC.SYSTEM_SELECT_DIR),

  // ── Terminal ──
  terminal: {
    create: (sessionId: string, cols: number, rows: number, customEnv?: Record<string, string>): Promise<void> =>
      ipcRenderer.invoke(IPC.TERMINAL_CREATE, sessionId, cols, rows, customEnv),

    write: (sessionId: string, data: string): Promise<void> =>
      ipcRenderer.invoke(IPC.TERMINAL_WRITE, sessionId, data),

    resize: (sessionId: string, cols: number, rows: number): Promise<void> =>
      ipcRenderer.invoke(IPC.TERMINAL_RESIZE, sessionId, cols, rows),

    kill: (sessionId: string): Promise<void> =>
      ipcRenderer.invoke(IPC.TERMINAL_KILL, sessionId),

    killAll: (): Promise<void> =>
      ipcRenderer.invoke(IPC.TERMINAL_KILL_ALL),

    onData: (callback: (sessionId: string, data: string) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, sessionId: string, data: string) => callback(sessionId, data);
      ipcRenderer.on(IPC.TERMINAL_DATA, handler);
      return () => ipcRenderer.removeListener(IPC.TERMINAL_DATA, handler);
    },

    onExit: (callback: (sessionId: string) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, sessionId: string) => callback(sessionId);
      ipcRenderer.on(IPC.TERMINAL_EXIT, handler);
      return () => ipcRenderer.removeListener(IPC.TERMINAL_EXIT, handler);
    },
  },

  // ── Image Generation ──
  image: {
    resolveModel: (modelPath: string): Promise<ModelResolution> =>
      ipcRenderer.invoke(IPC.IMAGE_RESOLVE_MODEL, modelPath),

    start: (modelPath: string, options?: Partial<ServerOptions>): Promise<void> =>
      ipcRenderer.invoke(IPC.IMAGE_START, modelPath, options),

    stop: (): Promise<void> =>
      ipcRenderer.invoke(IPC.IMAGE_STOP),

    getStatus: (): Promise<ServerState> =>
      ipcRenderer.invoke(IPC.IMAGE_STATUS),

    getLogs: (): Promise<string[]> =>
      ipcRenderer.invoke(IPC.IMAGE_LOGS),

    generate: (params: ImageGenerationRequest): Promise<ImageGenerationResult> =>
      ipcRenderer.invoke(IPC.IMAGE_GENERATE, params),

    generateImg2Img: (params: Img2ImgGenerationRequest): Promise<ImageGenerationResult> =>
      ipcRenderer.invoke(IPC.IMAGE_GENERATE_IMG2IMG, params),

    onStatusChanged: (callback: (state: ServerState) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, state: ServerState) => callback(state);
      ipcRenderer.on(IPC.IMAGE_STATUS_CHANGED, handler);
      return () => ipcRenderer.removeListener(IPC.IMAGE_STATUS_CHANGED, handler);
    },

    onLogLine: (callback: (line: string) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, line: string) => callback(line);
      ipcRenderer.on(IPC.IMAGE_LOG_LINE, handler);
      return () => ipcRenderer.removeListener(IPC.IMAGE_LOG_LINE, handler);
    },
  },

  // ── Video Generation (ComfyUI) ──
  video: {
    start: (options?: Partial<ServerOptions>): Promise<void> =>
      ipcRenderer.invoke(IPC.VIDEO_START, options),

    stop: (): Promise<void> =>
      ipcRenderer.invoke(IPC.VIDEO_STOP),

    getStatus: (): Promise<ServerState> =>
      ipcRenderer.invoke(IPC.VIDEO_STATUS),

    getLogs: (): Promise<string[]> =>
      ipcRenderer.invoke(IPC.VIDEO_LOGS),

    generateTxt2Vid: (params: VideoGenerationRequest): Promise<VideoGenerationResult> =>
      ipcRenderer.invoke(IPC.VIDEO_GENERATE_TXT2VID, params),

    generateImg2Vid: (params: Img2VidGenerationRequest): Promise<VideoGenerationResult> =>
      ipcRenderer.invoke(IPC.VIDEO_GENERATE_IMG2VID, params),

    cancel: (): Promise<void> =>
      ipcRenderer.invoke(IPC.VIDEO_CANCEL),

    onStatusChanged: (callback: (state: ServerState) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, state: ServerState) => callback(state);
      ipcRenderer.on(IPC.VIDEO_STATUS_CHANGED, handler);
      return () => ipcRenderer.removeListener(IPC.VIDEO_STATUS_CHANGED, handler);
    },

    onLogLine: (callback: (line: string) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, line: string) => callback(line);
      ipcRenderer.on(IPC.VIDEO_LOG_LINE, handler);
      return () => ipcRenderer.removeListener(IPC.VIDEO_LOG_LINE, handler);
    },

    onProgress: (callback: (data: { value: number; max: number }) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: { value: number; max: number }) => callback(data);
      ipcRenderer.on(IPC.VIDEO_GENERATION_PROGRESS, handler);
      return () => ipcRenderer.removeListener(IPC.VIDEO_GENERATION_PROGRESS, handler);
    },
  },

  // ── Exo Cluster ──
  exo: {
    connect: (): Promise<void> =>
      ipcRenderer.invoke(IPC.EXO_CONNECT),

    disconnect: (): Promise<void> =>
      ipcRenderer.invoke(IPC.EXO_DISCONNECT),

    getStatus: (): Promise<ServerState> =>
      ipcRenderer.invoke(IPC.EXO_STATUS),

    getLogs: (): Promise<string[]> =>
      ipcRenderer.invoke(IPC.EXO_LOGS),

    getClusterState: (): Promise<ExoClusterState | null> =>
      ipcRenderer.invoke(IPC.EXO_CLUSTER_STATE),

    listModels: (): Promise<ExoModel[]> =>
      ipcRenderer.invoke(IPC.EXO_LIST_MODELS),

    searchModels: (query: string): Promise<ExoModel[]> =>
      ipcRenderer.invoke(IPC.EXO_SEARCH_MODELS, query),

    addModel: (repoId: string): Promise<void> =>
      ipcRenderer.invoke(IPC.EXO_ADD_MODEL, repoId),

    deleteModel: (modelId: string): Promise<void> =>
      ipcRenderer.invoke(IPC.EXO_DELETE_MODEL, modelId),

    previewInstance: (modelId: string): Promise<unknown> =>
      ipcRenderer.invoke(IPC.EXO_INSTANCE_PREVIEW, modelId),

    createInstance: (modelId: string): Promise<string> =>
      ipcRenderer.invoke(IPC.EXO_CREATE_INSTANCE, modelId),

    deleteInstance: (): Promise<void> =>
      ipcRenderer.invoke(IPC.EXO_DELETE_INSTANCE),

    startDownload: (modelId: string): Promise<void> =>
      ipcRenderer.invoke(IPC.EXO_START_DOWNLOAD, modelId),

    cancelDownload: (nodeId: string, modelId: string): Promise<void> =>
      ipcRenderer.invoke(IPC.EXO_CANCEL_DOWNLOAD, nodeId, modelId),

    onStatusChanged: (callback: (state: ServerState) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, state: ServerState) => callback(state);
      ipcRenderer.on(IPC.EXO_STATUS_CHANGED, handler);
      return () => ipcRenderer.removeListener(IPC.EXO_STATUS_CHANGED, handler);
    },

    onLogLine: (callback: (line: string) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, line: string) => callback(line);
      ipcRenderer.on(IPC.EXO_LOG_LINE, handler);
      return () => ipcRenderer.removeListener(IPC.EXO_LOG_LINE, handler);
    },

    onClusterChanged: (callback: (state: ExoClusterState) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, state: ExoClusterState) => callback(state);
      ipcRenderer.on(IPC.EXO_CLUSTER_CHANGED, handler);
      return () => ipcRenderer.removeListener(IPC.EXO_CLUSTER_CHANGED, handler);
    },

    onDownloadProgress: (callback: (data: unknown) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: unknown) => callback(data);
      ipcRenderer.on(IPC.EXO_DOWNLOAD_PROGRESS, handler);
      return () => ipcRenderer.removeListener(IPC.EXO_DOWNLOAD_PROGRESS, handler);
    },
  },

  // ── Utility ──
  ping: (): Promise<string> => ipcRenderer.invoke('ping'),
};

export type TasmaniaAPI = typeof api;

contextBridge.exposeInMainWorld('tasmania', api);
