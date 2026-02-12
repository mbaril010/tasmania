// ── Backend Types ──

export type BackendType = 'llama.cpp' | 'stable-diffusion';

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

// ── Image Model Architecture Types ──

export type ImageModelArch = 'sd1' | 'sdxl' | 'flux' | 'sd3' | 'chroma';

export type CompanionRole = 'diffusion_model' | 't5xxl' | 'clip_l' | 'clip_g' | 'vae';

export interface CompanionFileStatus {
  role: CompanionRole;
  flag: string;
  required: boolean;
  found: boolean;
  path: string | null;
  patterns: string[];
}

export interface ModelResolution {
  arch: ImageModelArch;
  primaryPath: string;
  primaryFlag: string;
  companions: CompanionFileStatus[];
  ready: boolean;
  missingRequired: string[];
}

// ── Image Generation Types ──

export interface ImageGenerationRequest {
  prompt: string;
  negativePrompt?: string;
  width: number;
  height: number;
  steps: number;
  cfgScale: number;
  seed?: number;
  sampler?: string;
}

export interface ImageGenerationResult {
  b64: string;
  seed: number;
  timingMs: number;
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
  stableDiffusion: {
    port: number;
    defaultSteps: number;
    defaultCfgScale: number;
    defaultWidth: number;
    defaultHeight: number;
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

// ── Chat Types ──

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

// ── Terminal Types ──

export interface TerminalSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

// ── App State ──

export interface AppState {
  backends: Record<BackendType, BackendInfo>;
  server: ServerState;
  models: LocalModel[];
  downloads: DownloadProgress[];
  settings: AppSettings;
}
