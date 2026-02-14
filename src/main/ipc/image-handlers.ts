import { ipcMain, BrowserWindow } from 'electron';
import path from 'node:path';
import { IPC } from '../../shared/ipc-channels';
import { StableDiffusionBackend } from '../services/StableDiffusionBackend';
import { getSettings, getModelsDir } from '../store/AppStore';
import type { ImageGenerationRequest, ServerOptions } from '../../shared/types';

/** Validate that a model path is within the configured models directory */
function validateModelPath(modelPath: string): void {
  const modelsDir = getModelsDir();
  const resolved = path.resolve(modelPath);
  if (!resolved.startsWith(path.resolve(modelsDir))) {
    throw new Error('Model path must be within the models directory');
  }
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

    return {
      b64: json.images[0],
      seed: params.seed ?? -1,
      timingMs,
    };
  });
}

export async function shutdownImageServer() {
  const state = backend.getServerState();
  if (state.status === 'running' || state.status === 'starting') {
    await backend.stopServer();
  }
}
