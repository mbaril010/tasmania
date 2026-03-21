// ── Backend Types ──

export type BackendType = 'llama.cpp' | 'stable-diffusion' | 'comfyui' | 'exo';

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
  contextSize: number | null;
  gpuLayers: number | null;
}

export interface ServerOptions {
  port: number;
  contextSize: number;
  gpuLayers: number;
}

export interface MemoryPreflightResult {
  ok: boolean;
  modelSizeBytes: number;
  estimatedRamBytes: number;
  freeMemoryBytes: number;
  totalMemoryBytes: number;
  message: string | null;
}

// ── Model Types ──

export type ModelCategory = 'chat' | 'image' | 'video';

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
  category: ModelCategory;
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

export type ImageModelArch = 'sd1' | 'sdxl' | 'flux' | 'flux2' | 'sd3' | 'chroma' | 'z_image';

export type CompanionRole = 'diffusion_model' | 't5xxl' | 'clip_l' | 'clip_g' | 'vae' | 'text_encoder';

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

export interface Img2ImgGenerationRequest {
  prompt: string;
  negativePrompt?: string;
  width: number;
  height: number;
  steps: number;
  cfgScale: number;
  seed?: number;
  sampler?: string;
  initImages: string[];       // base64 PNG/JPEG (no data URL prefix)
  denoisingStrength: number;  // 0.0–1.0
}

export interface ImageGenerationResult {
  b64: string;
  seed: number;
  timingMs: number;
  savedPath?: string;
}

// ── Video Model Types ──

export type VideoModelCapability = 'txt2vid' | 'img2vid';

export interface VideoUpscaleDefaults {
  refineSteps: number;
  refineDenoise: number;
}

export interface VideoModelDef {
  id: string;
  name: string;
  capabilities: VideoModelCapability[];
  defaults: {
    width: number;
    height: number;
    frameCount: number;
    fps: number;
    steps: number;
    cfgScale: number;
  };
  requiredCustomNodes?: string[];
  upscaleDefaults?: VideoUpscaleDefaults;
}

// ── Video Upscale Types ──

export interface VideoUpscaleConfig {
  enabled: boolean;
  refineSteps: number;    // 3-8
  refineDenoise: number;  // 0.2-0.6
}

// ── Video Generation Types ──

export interface VideoGenerationRequest {
  prompt: string;
  negativePrompt?: string;
  width: number;
  height: number;
  frameCount: number;
  fps: number;
  steps: number;
  cfgScale: number;
  seed?: number;
  videoModel?: string;
  upscale?: VideoUpscaleConfig;
}

export interface Img2VidGenerationRequest extends VideoGenerationRequest {
  initImages: string[];
  denoisingStrength: number;
}

export interface VideoGenerationResult {
  filePath: string;
  frameCount: number;
  fps: number;
  durationSeconds: number;
  timingMs: number;
  upscaled?: boolean;
  outputWidth?: number;
  outputHeight?: number;
}

// ── Exo Cluster Types ──

export interface ExoClusterNode {
  id: string;
  name: string;
  model: string;
  memory: number;
  flops: number;
  isCoordinator: boolean;
}

export interface ExoClusterState {
  nodes: ExoClusterNode[];
  nodeId: string;
}

export interface ExoModel {
  id: string;
  name: string;
  owned_by: string;
}

// ── ComfyUI Install Types ──

export type ComfyUIInstallStatus = 'not-installed' | 'checking' | 'installing' | 'installed' | 'error';
export type ComfyUIInstallStep = 'checking-python' | 'downloading-comfyui' | 'extracting' | 'creating-venv' | 'installing-pytorch' | 'installing-requirements' | 'installing-custom-nodes' | 'verifying' | 'done';

export interface ComfyUIInstallProgress {
  status: ComfyUIInstallStatus;
  step: ComfyUIInstallStep | null;
  stepIndex: number;
  totalSteps: number;
  stepProgress: number; // 0-100
  message: string;
  error: string | null;
}

export interface ComfyUIInstallInfo {
  installed: boolean;
  installPath: string | null;
  pythonPath: string | null;
  version: string | null;
  mode: 'managed' | 'external';
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
  comfyui: {
    mode: 'managed' | 'external';
    path: string;
    port: number;
    pythonPath: string;
  };
  exo: {
    host: string;
    port: number;
    autoConnect: boolean;
  };
  imageOutput: {
    autoSave: boolean;
    outputDir: string;
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
  id: string;
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
