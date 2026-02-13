import { ipcMain, BrowserWindow } from 'electron';
import { IPC } from '../../shared/ipc-channels';
import { StableDiffusionBackend } from '../services/StableDiffusionBackend';
import { getSettings } from '../store/AppStore';
import type { ImageGenerationRequest, ServerOptions } from '../../shared/types';

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
    const endpoint = backend.getApiEndpoint();
    const state = backend.getServerState();
    if (state.status !== 'running') {
      throw new Error('Image server is not running');
    }

    const startTime = Date.now();

    const response = await fetch(`${endpoint}/images/generations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: params.prompt,
        negative_prompt: params.negativePrompt || '',
        size: `${params.width}x${params.height}`,
        n: 1,
        response_format: 'b64_json',
        sample_steps: params.steps,
        cfg_scale: params.cfgScale,
        seed: params.seed ?? -1,
        sampler: params.sampler,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Image generation failed (${response.status}): ${text}`);
    }

    const json = await response.json() as { data: Array<{ b64_json: string }> };
    const timingMs = Date.now() - startTime;

    return {
      b64: json.data[0].b64_json,
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
