import { ipcMain, BrowserWindow } from 'electron';
import { IPC } from '../../shared/ipc-channels';
import { BackendService } from '../services/BackendService';
import { LlamaCppBackend } from '../services/LlamaCppBackend';
import { getSettings } from '../store/AppStore';
import type { BackendInfo, BackendType, ServerOptions } from '../../shared/types';

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
  ipcMain.handle(IPC.BACKEND_DETECT, async () => {
    const info = await backend.detect();
    return { 'llama.cpp': info } as Record<string, BackendInfo>;
  });

  ipcMain.handle(
    IPC.BACKEND_START,
    async (_event, _backendType: BackendType, modelPath: string, options?: Partial<ServerOptions>) => {
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

      backend.events.on('log', (line: unknown) => sendToRenderer(IPC.BACKEND_LOG_LINE, line));
      backend.events.on('exit', () => sendToRenderer(IPC.BACKEND_STATUS_CHANGED, backend.getServerState()));

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
