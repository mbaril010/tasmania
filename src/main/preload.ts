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

  // ── System ──
  getSystemInfo: (): Promise<{ platform: string; arch: string; memory: number }> =>
    ipcRenderer.invoke(IPC.SYSTEM_INFO),

  openPath: (path: string): Promise<void> =>
    ipcRenderer.invoke(IPC.SYSTEM_OPEN_PATH, path),

  selectDirectory: (): Promise<string | null> =>
    ipcRenderer.invoke(IPC.SYSTEM_SELECT_DIR),

  // ── Utility ──
  ping: (): Promise<string> => ipcRenderer.invoke('ping'),
};

export type TasmaniaAPI = typeof api;

contextBridge.exposeInMainWorld('tasmania', api);
