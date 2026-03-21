import { ipcMain, BrowserWindow, app } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import { IPC } from '../../shared/ipc-channels';
import { ComfyUIBackend } from '../services/ComfyUIBackend';
import { getSettings } from '../store/AppStore';
import { getComfyUIInstaller } from './comfyui-handlers';
import { DEFAULT_VIDEO_MODEL, getUpscalerModelFilename, getDistilledLoraFilename } from '../../shared/video-models';
import { VIDEO_MODELS_DIR } from '../../shared/constants';
import type { VideoGenerationRequest, Img2VidGenerationRequest, VideoUpscaleConfig, ServerOptions } from '../../shared/types';

// Load workflow templates – keyed by model id
import txt2vidLtx from '../services/comfyui-workflows/txt2vid-ltx-video.json';
import img2vidLtx from '../services/comfyui-workflows/img2vid-ltx-video.json';
import txt2vidLtx20 from '../services/comfyui-workflows/txt2vid-ltx-video-2.0.json';
import img2vidLtx20 from '../services/comfyui-workflows/img2vid-ltx-video-2.0.json';
import txt2vidLtxUpscale from '../services/comfyui-workflows/txt2vid-ltx-video-upscale.json';
import img2vidLtxUpscale from '../services/comfyui-workflows/img2vid-ltx-video-upscale.json';

type WorkflowMap = Record<string, Record<string, unknown> | undefined>;

const txt2vidWorkflows: WorkflowMap = {
  'ltx-video-2.3': txt2vidLtx,
  'ltx-video-2.0': txt2vidLtx20,
};

const img2vidWorkflows: WorkflowMap = {
  'ltx-video-2.3': img2vidLtx,
  'ltx-video-2.0': img2vidLtx20,
};

const txt2vidUpscaleWorkflows: WorkflowMap = {
  'ltx-video-2.3': txt2vidLtxUpscale,
};

const img2vidUpscaleWorkflows: WorkflowMap = {
  'ltx-video-2.3': img2vidLtxUpscale,
};

function getTxt2VidWorkflow(modelId: string, upscale?: VideoUpscaleConfig): Record<string, unknown> {
  if (upscale?.enabled) {
    const wf = txt2vidUpscaleWorkflows[modelId];
    if (!wf) throw new Error(`No txt2vid upscale workflow for model "${modelId}"`);
    return wf;
  }
  const wf = txt2vidWorkflows[modelId];
  if (!wf) throw new Error(`No txt2vid workflow for model "${modelId}"`);
  return wf;
}

function getImg2VidWorkflow(modelId: string, upscale?: VideoUpscaleConfig): Record<string, unknown> {
  if (upscale?.enabled) {
    const wf = img2vidUpscaleWorkflows[modelId];
    if (!wf) throw new Error(`No img2vid upscale workflow for model "${modelId}"`);
    return wf;
  }
  const wf = img2vidWorkflows[modelId];
  if (!wf) throw new Error(`No img2vid workflow for model "${modelId}"`);
  return wf;
}

/** Check that upscaler model files exist; throw descriptive error if missing */
async function validateUpscaleModels(): Promise<void> {
  const upscalerFile = getUpscalerModelFilename();
  const loraFile = getDistilledLoraFilename();

  const upscalerPath = path.join(VIDEO_MODELS_DIR, 'latent_upscale_models', upscalerFile);
  const loraPath = path.join(VIDEO_MODELS_DIR, 'loras', loraFile);

  const missing: string[] = [];
  try { await fs.access(upscalerPath); } catch { missing.push(upscalerPath); }
  try { await fs.access(loraPath); } catch { missing.push(loraPath); }

  if (missing.length > 0) {
    throw new Error(`MISSING_UPSCALE_MODELS: The following model files are required for latent upscaling but were not found:\n${missing.join('\n')}\n\nDownload them from Lightricks/LTX-Video on HuggingFace and place them in the paths above.`);
  }
}

const backend = new ComfyUIBackend();

function sendToRenderer(channel: string, ...args: unknown[]) {
  const win = BrowserWindow.getAllWindows()[0];
  if (win && !win.isDestroyed()) {
    win.webContents.send(channel, ...args);
  }
}

function getOutputDir(): string {
  return path.join(app.getPath('userData'), 'video-output');
}

function fillTemplate(template: Record<string, unknown>, vars: Record<string, string | number>): Record<string, unknown> {
  let json = JSON.stringify(template);
  for (const [key, value] of Object.entries(vars)) {
    json = json.replace(new RegExp(`"{{${key}}}"`, 'g'), JSON.stringify(value));
    json = json.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
  }
  return JSON.parse(json);
}

export function getVideoBackend(): ComfyUIBackend {
  return backend;
}

export function registerVideoHandlers() {
  // Forward events to renderer
  backend.events.on('log', (line: unknown) => sendToRenderer(IPC.VIDEO_LOG_LINE, line));
  backend.events.on('exit', () => sendToRenderer(IPC.VIDEO_STATUS_CHANGED, backend.getServerState()));

  backend.progress.on('progress', (data: unknown) => {
    sendToRenderer(IPC.VIDEO_GENERATION_PROGRESS, data);
  });

  ipcMain.handle(IPC.VIDEO_START, async (_event, options?: Partial<ServerOptions>) => {
    const settings = getSettings();
    const mode = settings.comfyui.mode ?? 'managed';

    let comfyuiPath: string;
    let pythonPath: string;

    if (mode === 'managed') {
      const installer = getComfyUIInstaller();
      const info = await installer.getInstallInfo('managed');
      if (!info.installed) {
        throw new Error('ComfyUI not installed. Install it from Settings or the Video tab.');
      }
      const managed = installer.getManagedPaths();
      comfyuiPath = managed.comfyuiPath;
      pythonPath = managed.pythonPath;
    } else {
      comfyuiPath = settings.comfyui.path;
      pythonPath = settings.comfyui.pythonPath;
    }

    backend.configure(
      comfyuiPath,
      options?.port ?? settings.comfyui.port,
      pythonPath,
    );

    const mergedOptions: ServerOptions = {
      port: options?.port ?? settings.comfyui.port,
      contextSize: 0,
      gpuLayers: 0,
    };

    await backend.startServer('', mergedOptions);
    sendToRenderer(IPC.VIDEO_STATUS_CHANGED, backend.getServerState());
  });

  ipcMain.handle(IPC.VIDEO_STOP, async () => {
    await backend.stopServer();
    sendToRenderer(IPC.VIDEO_STATUS_CHANGED, backend.getServerState());
  });

  ipcMain.handle(IPC.VIDEO_STATUS, () => {
    return backend.getServerState();
  });

  ipcMain.handle(IPC.VIDEO_LOGS, () => {
    return backend.getLogs();
  });

  ipcMain.handle(IPC.VIDEO_CANCEL, async () => {
    await backend.interrupt();
  });

  ipcMain.handle(IPC.VIDEO_GENERATE_TXT2VID, async (_event, params: VideoGenerationRequest) => {
    if (!params || typeof params.prompt !== 'string' || params.prompt.trim().length === 0) {
      throw new Error('Prompt is required');
    }
    if (params.prompt.length > 10_000) throw new Error('Prompt too long (max 10000 chars)');
    if (!Number.isInteger(params.width) || params.width < 64 || params.width > 2048) {
      throw new Error('Width must be 64-2048');
    }
    if (!Number.isInteger(params.height) || params.height < 64 || params.height > 2048) {
      throw new Error('Height must be 64-2048');
    }
    if (!Number.isInteger(params.frameCount) || params.frameCount < 1) {
      throw new Error('Frame count must be at least 1');
    }
    if (!Number.isInteger(params.fps) || params.fps < 1 || params.fps > 60) {
      throw new Error('FPS must be 1-60');
    }
    if (!Number.isInteger(params.steps) || params.steps < 1 || params.steps > 150) {
      throw new Error('Steps must be 1-150');
    }
    if (typeof params.cfgScale !== 'number' || params.cfgScale < 0 || params.cfgScale > 30) {
      throw new Error('CFG scale must be 0-30');
    }

    const state = backend.getServerState();
    if (state.status !== 'running') {
      throw new Error('ComfyUI server is not running');
    }

    const startTime = Date.now();
    const seed = params.seed ?? Math.floor(Math.random() * 2147483647);

    const modelId = params.videoModel || DEFAULT_VIDEO_MODEL;
    const upscale = params.upscale;
    const useUpscale = upscale?.enabled && modelId === 'ltx-video-2.3';

    if (useUpscale) {
      await validateUpscaleModels();
    }

    const templateVars: Record<string, string | number> = {
      prompt: params.prompt,
      negative_prompt: params.negativePrompt || '',
      width: params.width,
      height: params.height,
      frame_count: params.frameCount,
      fps: params.fps,
      steps: params.steps,
      cfg_scale: params.cfgScale,
      seed,
    };

    if (useUpscale) {
      templateVars.upscale_model_name = getUpscalerModelFilename();
      templateVars.refine_steps = upscale.refineSteps;
      templateVars.refine_denoise = upscale.refineDenoise;
      templateVars.refine_seed = Math.floor(Math.random() * 2147483647);
      templateVars.lora_name = getDistilledLoraFilename();
    }

    const workflow = fillTemplate(getTxt2VidWorkflow(modelId, upscale), templateVars);

    const promptId = await backend.queuePrompt(workflow);
    const history = await backend.waitForCompletion(promptId);

    // Find the output video file from the history
    const outputDir = getOutputDir();
    await fs.mkdir(outputDir, { recursive: true });

    const outputs = history.outputs as Record<string, {
      videos?: Array<{ filename: string; subfolder: string }>;
      gifs?: Array<{ filename: string; subfolder: string }>;
    }> | undefined;
    let videoFilePath = '';

    if (outputs) {
      for (const nodeOutput of Object.values(outputs)) {
        const videoList = nodeOutput.videos ?? nodeOutput.gifs;
        if (videoList && videoList.length > 0) {
          const video = videoList[0];
          const comfyOutputDir = path.join(backend.getServerState().modelPath || '', 'output', video.subfolder);
          const srcPath = path.join(comfyOutputDir, video.filename);
          const destPath = path.join(outputDir, `txt2vid_${Date.now()}_${video.filename}`);
          try {
            await fs.copyFile(srcPath, destPath);
            videoFilePath = destPath;
          } catch {
            videoFilePath = srcPath;
          }
          break;
        }
      }
    }

    const timingMs = Date.now() - startTime;
    const durationSeconds = params.frameCount / params.fps;

    return {
      filePath: videoFilePath,
      frameCount: params.frameCount,
      fps: params.fps,
      durationSeconds,
      timingMs,
      ...(useUpscale ? {
        upscaled: true,
        outputWidth: params.width * 2,
        outputHeight: params.height * 2,
      } : {}),
    };
  });

  ipcMain.handle(IPC.VIDEO_GET_OUTPUT_DIR, async () => {
    const dir = getOutputDir();
    await fs.mkdir(dir, { recursive: true });
    return dir;
  });

  ipcMain.handle(IPC.VIDEO_GENERATE_IMG2VID, async (_event, params: Img2VidGenerationRequest) => {
    if (!params || typeof params.prompt !== 'string' || params.prompt.trim().length === 0) {
      throw new Error('Prompt is required');
    }
    if (!Array.isArray(params.initImages) || params.initImages.length === 0 || !params.initImages.every((s) => typeof s === 'string' && s.length > 0)) {
      throw new Error('At least one source image is required');
    }
    if (typeof params.denoisingStrength !== 'number' || params.denoisingStrength < 0 || params.denoisingStrength > 1) {
      throw new Error('Denoising strength must be 0-1');
    }
    if (!Number.isInteger(params.width) || params.width < 64 || params.width > 2048) {
      throw new Error('Width must be 64-2048');
    }
    if (!Number.isInteger(params.height) || params.height < 64 || params.height > 2048) {
      throw new Error('Height must be 64-2048');
    }
    if (!Number.isInteger(params.frameCount) || params.frameCount < 1) {
      throw new Error('Frame count must be at least 1');
    }
    if (!Number.isInteger(params.fps) || params.fps < 1 || params.fps > 60) {
      throw new Error('FPS must be 1-60');
    }
    if (!Number.isInteger(params.steps) || params.steps < 1 || params.steps > 150) {
      throw new Error('Steps must be 1-150');
    }
    if (typeof params.cfgScale !== 'number' || params.cfgScale < 0 || params.cfgScale > 30) {
      throw new Error('CFG scale must be 0-30');
    }

    const state = backend.getServerState();
    if (state.status !== 'running') {
      throw new Error('ComfyUI server is not running');
    }

    const startTime = Date.now();
    const seed = params.seed ?? Math.floor(Math.random() * 2147483647);

    // Upload all source images (workflow uses the first; extras available for future workflows)
    const now = Date.now();
    const uploadedImages = await Promise.all(
      params.initImages.map((img, i) =>
        backend.uploadImage(img, `img2vid_input_${now}_${i}.png`)
      )
    );
    const uploaded = uploadedImages[0];

    const modelId = params.videoModel || DEFAULT_VIDEO_MODEL;
    const upscale = params.upscale;
    const useUpscale = upscale?.enabled && modelId === 'ltx-video-2.3';

    if (useUpscale) {
      await validateUpscaleModels();
    }

    const templateVars: Record<string, string | number> = {
      prompt: params.prompt,
      negative_prompt: params.negativePrompt || '',
      width: params.width,
      height: params.height,
      frame_count: params.frameCount,
      fps: params.fps,
      steps: params.steps,
      cfg_scale: params.cfgScale,
      seed,
      denoising_strength: params.denoisingStrength,
      init_image_name: uploaded.name,
    };

    if (useUpscale) {
      templateVars.upscale_model_name = getUpscalerModelFilename();
      templateVars.refine_steps = upscale.refineSteps;
      templateVars.refine_denoise = upscale.refineDenoise;
      templateVars.refine_seed = Math.floor(Math.random() * 2147483647);
      templateVars.lora_name = getDistilledLoraFilename();
    }

    const workflow = fillTemplate(getImg2VidWorkflow(modelId, upscale), templateVars);

    const promptId = await backend.queuePrompt(workflow);
    const history = await backend.waitForCompletion(promptId);

    const outputDir = getOutputDir();
    await fs.mkdir(outputDir, { recursive: true });

    const outputs = history.outputs as Record<string, {
      videos?: Array<{ filename: string; subfolder: string }>;
      gifs?: Array<{ filename: string; subfolder: string }>;
    }> | undefined;
    let videoFilePath = '';

    if (outputs) {
      for (const nodeOutput of Object.values(outputs)) {
        const videoList = nodeOutput.videos ?? nodeOutput.gifs;
        if (videoList && videoList.length > 0) {
          const video = videoList[0];
          const comfyOutputDir = path.join(backend.getServerState().modelPath || '', 'output', video.subfolder);
          const srcPath = path.join(comfyOutputDir, video.filename);
          const destPath = path.join(outputDir, `img2vid_${Date.now()}_${video.filename}`);
          try {
            await fs.copyFile(srcPath, destPath);
            videoFilePath = destPath;
          } catch {
            videoFilePath = srcPath;
          }
          break;
        }
      }
    }

    const timingMs = Date.now() - startTime;
    const durationSeconds = params.frameCount / params.fps;

    return {
      filePath: videoFilePath,
      frameCount: params.frameCount,
      fps: params.fps,
      durationSeconds,
      timingMs,
      ...(useUpscale ? {
        upscaled: true,
        outputWidth: params.width * 2,
        outputHeight: params.height * 2,
      } : {}),
    };
  });
}

export async function shutdownVideoServer() {
  const state = backend.getServerState();
  if (state.status === 'running' || state.status === 'starting') {
    await backend.stopServer();
  }
}
