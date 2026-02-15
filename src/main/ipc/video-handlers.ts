import { ipcMain, BrowserWindow, app } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import { IPC } from '../../shared/ipc-channels';
import { ComfyUIBackend } from '../services/ComfyUIBackend';
import { getSettings } from '../store/AppStore';
import type { VideoGenerationRequest, Img2VidGenerationRequest, ServerOptions } from '../../shared/types';

// Load workflow templates
import txt2vidWorkflow from '../services/comfyui-workflows/txt2vid-animatediff.json';
import img2vidWorkflow from '../services/comfyui-workflows/img2vid-svd.json';

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
    backend.configure(
      settings.comfyui.path,
      options?.port ?? settings.comfyui.port,
      settings.comfyui.pythonPath,
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
    if (!Number.isInteger(params.frameCount) || params.frameCount < 1 || params.frameCount > 120) {
      throw new Error('Frame count must be 1-120');
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

    const workflow = fillTemplate(txt2vidWorkflow, {
      prompt: params.prompt,
      negative_prompt: params.negativePrompt || '',
      width: params.width,
      height: params.height,
      frame_count: params.frameCount,
      fps: params.fps,
      steps: params.steps,
      cfg_scale: params.cfgScale,
      seed,
    });

    const promptId = await backend.queuePrompt(workflow);
    const history = await backend.waitForCompletion(promptId);

    // Find the output video file from the history
    const outputDir = getOutputDir();
    await fs.mkdir(outputDir, { recursive: true });

    const outputs = history.outputs as Record<string, { videos?: Array<{ filename: string; subfolder: string }> }> | undefined;
    let videoFilePath = '';

    if (outputs) {
      for (const nodeOutput of Object.values(outputs)) {
        if (nodeOutput.videos && nodeOutput.videos.length > 0) {
          const video = nodeOutput.videos[0];
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
    };
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
    if (!Number.isInteger(params.frameCount) || params.frameCount < 1 || params.frameCount > 120) {
      throw new Error('Frame count must be 1-120');
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

    const workflow = fillTemplate(img2vidWorkflow, {
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
    });

    const promptId = await backend.queuePrompt(workflow);
    const history = await backend.waitForCompletion(promptId);

    const outputDir = getOutputDir();
    await fs.mkdir(outputDir, { recursive: true });

    const outputs = history.outputs as Record<string, { videos?: Array<{ filename: string; subfolder: string }> }> | undefined;
    let videoFilePath = '';

    if (outputs) {
      for (const nodeOutput of Object.values(outputs)) {
        if (nodeOutput.videos && nodeOutput.videos.length > 0) {
          const video = nodeOutput.videos[0];
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
    };
  });
}

export async function shutdownVideoServer() {
  const state = backend.getServerState();
  if (state.status === 'running' || state.status === 'starting') {
    await backend.stopServer();
  }
}
