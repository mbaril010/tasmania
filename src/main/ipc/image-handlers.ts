import { ipcMain, BrowserWindow } from 'electron';
import path from 'node:path';
import fsPromises from 'node:fs/promises';
import { IPC } from '../../shared/ipc-channels';
import { assertPathInside } from '../security/path-utils';
import { StableDiffusionBackend } from '../services/StableDiffusionBackend';
import { getSettings, getModelsDir } from '../store/AppStore';
import type { ImageGenerationRequest, Img2ImgGenerationRequest, ServerOptions } from '../../shared/types';

/** Validate that a model path is within the configured models directory */
function validateModelPath(modelPath: string): void {
  if (typeof modelPath !== 'string' || modelPath.trim().length === 0) {
    throw new Error('Model path is required');
  }
  assertPathInside(getModelsDir(), modelPath, 'Model path must be within the models directory');
}

async function saveImageToDisk(b64: string, outputDir: string, prompt: string, seed: number): Promise<string> {
  await fsPromises.mkdir(outputDir, { recursive: true });
  const slug = prompt.slice(0, 30).replace(/[^a-zA-Z0-9]+/g, '_').replace(/_+$/, '');
  const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
  const filename = `${timestamp}_${slug}_${seed}.png`;
  const filepath = path.join(outputDir, filename);
  await fsPromises.writeFile(filepath, Buffer.from(b64, 'base64'));
  return filepath;
}

const backend = new StableDiffusionBackend();

function sendToRenderer(channel: string, ...args: unknown[]) {
  const win = BrowserWindow.getAllWindows()[0];
  if (win && !win.isDestroyed()) {
    win.webContents.send(channel, ...args);
  }
}

export function getImageBackend(): StableDiffusionBackend {
  return backend;
}

export function registerImageHandlers() {
  // Register event forwarding once (not per start) to avoid listener leaks
  backend.events.on('log', (line: unknown) => sendToRenderer(IPC.IMAGE_LOG_LINE, line));
  backend.events.on('exit', () => sendToRenderer(IPC.IMAGE_STATUS_CHANGED, backend.getServerState()));

  ipcMain.handle(
    IPC.IMAGE_START,
    async (_event, modelPath: string, options?: Partial<ServerOptions>) => {
      validateModelPath(modelPath);

      const settings = getSettings();
      const mergedOptions: ServerOptions = {
        port: options?.port ?? settings.stableDiffusion.port,
        contextSize: 0,
        gpuLayers: 0,
      };

      await backend.startServer(modelPath, mergedOptions);

      sendToRenderer(IPC.IMAGE_STATUS_CHANGED, backend.getServerState());
    }
  );

  ipcMain.handle(IPC.IMAGE_RESOLVE_MODEL, async (_event, modelPath: string) => {
    return backend.resolveModel(modelPath);
  });

  ipcMain.handle(IPC.IMAGE_STOP, async () => {
    await backend.stopServer();
    sendToRenderer(IPC.IMAGE_STATUS_CHANGED, backend.getServerState());
  });

  ipcMain.handle(IPC.IMAGE_STATUS, () => {
    return backend.getServerState();
  });

  ipcMain.handle(IPC.IMAGE_LOGS, () => {
    return backend.getLogs();
  });

  ipcMain.handle(IPC.IMAGE_GENERATE, async (_event, params: ImageGenerationRequest) => {
    // Validate generation parameters
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
    if (!Number.isInteger(params.steps) || params.steps < 1 || params.steps > 150) {
      throw new Error('Steps must be 1-150');
    }
    if (typeof params.cfgScale !== 'number' || params.cfgScale < 0 || params.cfgScale > 30) {
      throw new Error('CFG scale must be 0-30');
    }

    const state = backend.getServerState();
    if (state.status !== 'running') {
      throw new Error('Image server is not running');
    }

    const startTime = Date.now();

    // Use the native /sdapi/v1/txt2img endpoint — it respects all generation
    // parameters (steps, cfg_scale, seed, sampler_name, negative_prompt).
    // The OpenAI-compatible /v1/images/generations endpoint ignores them.
    const baseUrl = `http://127.0.0.1:${state.port}`;
    const response = await fetch(`${baseUrl}/sdapi/v1/txt2img`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: params.prompt,
        negative_prompt: params.negativePrompt || '',
        width: params.width,
        height: params.height,
        steps: params.steps,
        cfg_scale: params.cfgScale,
        seed: params.seed ?? -1,
        sampler_name: params.sampler || '',
      }),
      signal: AbortSignal.timeout(30 * 60_000), // 30 min — large models can be slow
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Image generation failed (${response.status}): ${text}`);
    }

    const json = await response.json() as { images: string[] };
    const timingMs = Date.now() - startTime;

    if (!json.images || json.images.length === 0) {
      throw new Error('No image returned from server');
    }

    const b64 = json.images[0];
    const seedUsed = params.seed ?? -1;
    let savedPath: string | undefined;

    const settings = getSettings();
    if (settings.imageOutput?.autoSave) {
      try {
        savedPath = await saveImageToDisk(b64, settings.imageOutput.outputDir, params.prompt, seedUsed);
      } catch (err) {
        console.error('Failed to auto-save image:', err);
      }
    }

    return { b64, seed: seedUsed, timingMs, savedPath };
  });

  ipcMain.handle(IPC.IMAGE_GENERATE_IMG2IMG, async (_event, params: Img2ImgGenerationRequest) => {
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
    if (!Number.isInteger(params.steps) || params.steps < 1 || params.steps > 150) {
      throw new Error('Steps must be 1-150');
    }
    if (typeof params.cfgScale !== 'number' || params.cfgScale < 0 || params.cfgScale > 30) {
      throw new Error('CFG scale must be 0-30');
    }
    if (!Array.isArray(params.initImages) || params.initImages.length === 0 || !params.initImages.every((s) => typeof s === 'string' && s.length > 0)) {
      throw new Error('At least one source image is required');
    }
    if (typeof params.denoisingStrength !== 'number' || params.denoisingStrength < 0 || params.denoisingStrength > 1) {
      throw new Error('Denoising strength must be 0-1');
    }

    const state = backend.getServerState();
    if (state.status !== 'running') {
      throw new Error('Image server is not running');
    }

    const startTime = Date.now();
    const baseUrl = `http://127.0.0.1:${state.port}`;
    const response = await fetch(`${baseUrl}/sdapi/v1/img2img`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: params.prompt,
        negative_prompt: params.negativePrompt || '',
        width: params.width,
        height: params.height,
        steps: params.steps,
        cfg_scale: params.cfgScale,
        seed: params.seed ?? -1,
        sampler_name: params.sampler || '',
        init_images: params.initImages,
        denoising_strength: params.denoisingStrength,
      }),
      signal: AbortSignal.timeout(30 * 60_000), // 30 min — large models can be slow
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Image generation failed (${response.status}): ${text}`);
    }

    const json = await response.json() as { images: string[] };
    const timingMs = Date.now() - startTime;

    if (!json.images || json.images.length === 0) {
      throw new Error('No image returned from server');
    }

    const b64 = json.images[0];
    const seedUsed = params.seed ?? -1;
    let savedPath: string | undefined;

    const imgSettings = getSettings();
    if (imgSettings.imageOutput?.autoSave) {
      try {
        savedPath = await saveImageToDisk(b64, imgSettings.imageOutput.outputDir, params.prompt, seedUsed);
      } catch (err) {
        console.error('Failed to auto-save image:', err);
      }
    }

    return { b64, seed: seedUsed, timingMs, savedPath };
  });
}

export async function shutdownImageServer() {
  const state = backend.getServerState();
  if (state.status === 'running' || state.status === 'starting') {
    await backend.stopServer();
  }
}
