import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from '../shared/ipc-channels';
import type {
  AppSettings,
  BackendInfo,
  BackendType,
  DownloadProgress,
  HuggingFaceFile,
  HuggingFaceModel,
  LocalModel,
  ServerOptions,
  ServerState,
  UpdateCheckResult,
  UpdateInfo,
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

  downloadModel: (repo: string, filename: string): Promise<string> =>
    ipcRenderer.invoke(IPC.MODEL_DOWNLOAD, repo, filename),

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
  getSystemInfo: (): Promise<{ platform: string; arch: string; memory: number }> =>
    ipcRenderer.invoke(IPC.SYSTEM_INFO),

  openPath: (path: string): Promise<void> =>
    ipcRenderer.invoke(IPC.SYSTEM_OPEN_PATH, path),

  openExternal: (url: string): Promise<void> =>
    ipcRenderer.invoke(IPC.SYSTEM_OPEN_EXTERNAL, url),

  selectDirectory: (): Promise<string | null> =>
    ipcRenderer.invoke(IPC.SYSTEM_SELECT_DIR),

  // ── Terminal ──
  terminal: {
    create: (cols: number, rows: number, customEnv?: Record<string, string>): Promise<void> =>
      ipcRenderer.invoke(IPC.TERMINAL_CREATE, cols, rows, customEnv),

    write: (data: string): Promise<void> =>
      ipcRenderer.invoke(IPC.TERMINAL_WRITE, data),

    resize: (cols: number, rows: number): Promise<void> =>
      ipcRenderer.invoke(IPC.TERMINAL_RESIZE, cols, rows),

    kill: (): Promise<void> =>
      ipcRenderer.invoke(IPC.TERMINAL_KILL),

    onData: (callback: (data: string) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: string) => callback(data);
      ipcRenderer.on(IPC.TERMINAL_DATA, handler);
      return () => ipcRenderer.removeListener(IPC.TERMINAL_DATA, handler);
    },
  },

  // ── Utility ──
  ping: (): Promise<string> => ipcRenderer.invoke('ping'),
};

export type TasmaniaAPI = typeof api;

contextBridge.exposeInMainWorld('tasmania', api);
