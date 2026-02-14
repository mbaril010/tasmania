import { ipcMain, BrowserWindow } from 'electron';
import path from 'node:path';
import { IPC } from '../../shared/ipc-channels';
import { BackendService } from '../services/BackendService';
import { LlamaCppBackend } from '../services/LlamaCppBackend';
import { getSettings, getModelsDir } from '../store/AppStore';
import { getImageBackend } from './image-handlers';
import type { BackendInfo, BackendType, ServerOptions } from '../../shared/types';

/** Validate that a model path is within the configured models directory */
function validateModelPath(modelPath: string): void {
  const modelsDir = getModelsDir();
  const resolved = path.resolve(modelPath);
  if (!resolved.startsWith(path.resolve(modelsDir))) {
    throw new Error('Model path must be within the models directory');
  }
}

const backend = new LlamaCppBackend();
let activeBackend: BackendService | null = null;

function sendToRenderer(channel: string, ...args: unknown[]) {
  const win = BrowserWindow.getAllWindows()[0];
  if (win && !win.isDestroyed()) {
    win.webContents.send(channel, ...args);
  }
}

export function getActiveBackend(): BackendService | null {
  return activeBackend;
}

export function setActiveBackend(b: BackendService | null): void {
  activeBackend = b;
}

export function getBackends(): Record<string, BackendService> {
  return { 'llama.cpp': backend };
}

export function registerBackendHandlers() {
  // Register event forwarding once (not per start) to avoid listener leaks
  backend.events.on('log', (line: unknown) => sendToRenderer(IPC.BACKEND_LOG_LINE, line));
  backend.events.on('exit', () => sendToRenderer(IPC.BACKEND_STATUS_CHANGED, backend.getServerState()));

  ipcMain.handle(IPC.BACKEND_DETECT, async () => {
    const llamaInfo = await backend.detect();
    const result: Record<string, BackendInfo> = { 'llama.cpp': llamaInfo };

    const imageBackend = getImageBackend();
    if (imageBackend) {
      const sdInfo = await imageBackend.detect();
      result['stable-diffusion'] = sdInfo;
    }

    return result;
  });

  ipcMain.handle(
    IPC.BACKEND_START,
    async (_event, _backendType: BackendType, modelPath: string, options?: Partial<ServerOptions>) => {
      validateModelPath(modelPath);

      if (activeBackend) {
        await activeBackend.stopServer();
      }

      const settings = getSettings();
      const mergedOptions: ServerOptions = {
        port: options?.port ?? settings.llamaCpp.port,
        contextSize: options?.contextSize ?? settings.llamaCpp.contextSize,
        gpuLayers: options?.gpuLayers ?? settings.llamaCpp.gpuLayers,
      };

      await backend.startServer(modelPath, mergedOptions);
      activeBackend = backend;

      sendToRenderer(IPC.BACKEND_STATUS_CHANGED, backend.getServerState());
    }
  );

  ipcMain.handle(IPC.BACKEND_STOP, async () => {
    if (activeBackend) {
      await activeBackend.stopServer();
      sendToRenderer(IPC.BACKEND_STATUS_CHANGED, activeBackend.getServerState());
      activeBackend = null;
    }
  });

  ipcMain.handle(IPC.BACKEND_STATUS, () => {
    if (activeBackend) {
      return activeBackend.getServerState();
    }
    return {
      status: 'stopped',
      backend: null,
      port: 0,
      modelPath: null,
      modelName: null,
      pid: null,
      error: null,
      startedAt: null,
      contextSize: null,
      gpuLayers: null,
    };
  });

  ipcMain.handle(IPC.BACKEND_LOGS, () => {
    if (activeBackend) {
      return activeBackend.getLogs();
    }
    return [];
  });
}

export async function shutdownBackends() {
  if (activeBackend) {
    await activeBackend.stopServer();
    activeBackend = null;
  }
}
