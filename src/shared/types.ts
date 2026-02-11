// ── Backend Types ──

export type BackendType = 'llama.cpp';

export type ServerStatus = 'stopped' | 'starting' | 'running' | 'error';

export interface BackendInfo {
  type: BackendType;
  installed: boolean;
  executablePath: string | null;
  version: string | null;
}

export interface ServerState {
  status: ServerStatus;
  backend: BackendType | null;
  port: number;
  modelPath: string | null;
  modelName: string | null;
  pid: number | null;
  error: string | null;
  startedAt: number | null;
}

export interface ServerOptions {
  port: number;
  contextSize: number;
  gpuLayers: number;
}

// ── Model Types ──

export interface LocalModel {
  name: string;
  filename: string;
  path: string;
  sizeBytes: number;
  repo: string | null;
  quantization: string | null;
  parameters: string | null;
  architecture: string | null;
  addedAt: number;
}

export interface HuggingFaceModel {
  id: string;
  name: string;
  author: string;
  downloads: number;
  likes: number;
  tags: string[];
  lastModified: string;
}

export interface HuggingFaceFile {
  filename: string;
  sizeBytes: number;
  repo: string;
}

export interface DownloadProgress {
  id: string;
  repo: string;
  filename: string;
  totalBytes: number;
  downloadedBytes: number;
  speedBps: number;
  status: 'queued' | 'downloading' | 'completed' | 'error' | 'cancelled';
  error: string | null;
}

// ── Settings Types ──

export interface AppSettings {
  modelsDir: string;
  autoStart: boolean;
  autoCheckUpdates: boolean;
  llamaCpp: {
    port: number;
    contextSize: number;
    gpuLayers: number;
  };
  theme: 'light' | 'dark' | 'system';
}

// ── Update Types ──

export interface UpdateInfo {
  currentVersion: string;
  latestVersion: string;
  releaseNotes: string;
  downloadUrl: string;
  releasedAt: string;
  isUpdateAvailable: boolean;
}

export interface UpdateCheckResult {
  updateAvailable: boolean;
  updateInfo: UpdateInfo | null;
  error: string | null;
}

// ── App State ──

export interface AppState {
  backends: Record<BackendType, BackendInfo>;
  server: ServerState;
  models: LocalModel[];
  downloads: DownloadProgress[];
  settings: AppSettings;
}
