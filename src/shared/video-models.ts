import type { VideoModelDef } from './types';

export const VIDEO_MODELS: VideoModelDef[] = [
  {
    id: 'ltx-video-2.3',
    name: 'LTX-Video 2.3 (AV)',
    capabilities: ['txt2vid', 'img2vid'],
    defaults: { width: 768, height: 512, frameCount: 97, fps: 25, steps: 15, cfgScale: 1.0 },
    requiredCustomNodes: ['ComfyUI-LTXVideo', 'ComfyUI-VideoHelperSuite'],
    upscaleDefaults: { refineSteps: 5, refineDenoise: 0.4 },
  },
  {
    id: 'ltx-video-2.0',
    name: 'LTX-Video 2.0 (GGUF)',
    capabilities: ['txt2vid', 'img2vid'],
    defaults: { width: 768, height: 512, frameCount: 97, fps: 24, steps: 30, cfgScale: 3.0 },
    requiredCustomNodes: ['ComfyUI-GGUF', 'ComfyUI-VideoHelperSuite'],
  },
];

export const DEFAULT_VIDEO_MODEL = 'ltx-video-2.3';

/** LTX-Video upscaler model files — downloaded on demand */
export interface UpscalerModelFile {
  repo: string;
  filename: string;
  targetDir: string;  // subdirectory under VIDEO_MODELS_DIR
}

export const LTX_UPSCALER_MODELS: Record<string, UpscalerModelFile> = {
  'spatial_upscaler_2x': {
    repo: 'Lightricks/LTX-Video',
    filename: 'ltx-2.3-spatial-upscaler-x2-1.0.safetensors',
    targetDir: 'latent_upscale_models',
  },
  'distilled_lora': {
    repo: 'Lightricks/LTX-Video',
    filename: 'ltx-2.3-22b-distilled-lora-384.safetensors',
    targetDir: 'loras',
  },
};

/** Get the upscaler model filename (always x2 — scale is determined by the model) */
export function getUpscalerModelFilename(): string {
  return LTX_UPSCALER_MODELS['spatial_upscaler_2x'].filename;
}

/** Get the distilled LoRA filename */
export function getDistilledLoraFilename(): string {
  return LTX_UPSCALER_MODELS['distilled_lora'].filename;
}
