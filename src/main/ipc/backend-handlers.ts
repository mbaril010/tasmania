import { ipcMain, BrowserWindow } from 'electron';
import { execSync } from 'node:child_process';
import os from 'node:os';
import fs from 'node:fs/promises';
import path from 'node:path';
import { IPC } from '../../shared/ipc-channels';
import { BackendService } from '../services/BackendService';
import { LlamaCppBackend } from '../services/LlamaCppBackend';
import { getSettings, getModelsDir } from '../store/AppStore';
import { getImageBackend } from './image-handlers';
import type { BackendInfo, BackendType, MemoryPreflightResult, ServerOptions } from '../../shared/types';

/** Validate that a model path is within the configured models directory */
function validateModelPath(modelPath: string): void {
  const modelsDir = getModelsDir();
  const resolved = path.resolve(modelPath);
  if (!resolved.startsWith(path.resolve(modelsDir))) {
    throw new Error('Model path must be within the models directory');
  }
}

/**
 * Estimate runtime overhead for llama-server beyond model weights.
 * The dominant cost is the KV cache which is stored in fp16 regardless of model
 * quantization. For heavily quantized models (Q2-Q4), this cache is proportionally
 * large relative to the compressed weights.
 *
 * Heuristic: 2 GB base (process + compute buffers) + 25% of model file size
 * scaled linearly by context size (normalized to 32K). This gives ~21 GB overhead
 * for a 77 GB Q2_K model at 32K context, dropping to ~5 GB at 4K context.
 */
function estimateOverhead(modelSizeBytes: number, contextSize: number): number {
  const GB = 1024 ** 3;
  const BASE_OVERHEAD = 2 * GB;
  const kvEstimate = modelSizeBytes * 0.25 * (contextSize / 32768);
  return Math.round(BASE_OVERHEAD + kvEstimate);
}

/**
 * Get available memory (free + reclaimable) on the current platform.
 * On macOS, os.freemem() only reports truly "free" pages which is misleadingly low
 * because macOS aggressively caches files in RAM. We parse vm_stat to include
 * inactive and purgeable pages that the OS will reclaim for apps on demand.
 */
function getAvailableMemory(): number {
  if (process.platform === 'darwin') {
    try {
      const output = execSync('vm_stat', { encoding: 'utf8', timeout: 3000 });
      const pageSize = parseInt(output.match(/page size of (\d+) bytes/)?.[1] ?? '16384', 10);
      const free = parseInt(output.match(/Pages free:\s+(\d+)/)?.[1] ?? '0', 10);
      const inactive = parseInt(output.match(/Pages inactive:\s+(\d+)/)?.[1] ?? '0', 10);
      const purgeable = parseInt(output.match(/Pages purgeable:\s+(\d+)/)?.[1] ?? '0', 10);
      return (free + inactive + purgeable) * pageSize;
    } catch {
      return os.freemem();
    }
  }
  return os.freemem();
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

  ipcMain.handle(IPC.BACKEND_PREFLIGHT_CHECK, async (_event, modelPath: string): Promise<MemoryPreflightResult> => {
    validateModelPath(modelPath);

    const settings = getSettings();
    const contextSize = settings.llamaCpp.contextSize;

    const stat = await fs.stat(modelPath);
    const modelSizeBytes = stat.size;
    const overhead = estimateOverhead(modelSizeBytes, contextSize);
    const estimatedRamBytes = modelSizeBytes + overhead;
    const freeMemoryBytes = getAvailableMemory();
    const totalMemoryBytes = os.totalmem();

    if (estimatedRamBytes > freeMemoryBytes) {
      const estimatedGB = (estimatedRamBytes / 1024 ** 3).toFixed(1);
      const freeGB = (freeMemoryBytes / 1024 ** 3).toFixed(1);
      const ctxK = Math.round(contextSize / 1024);
      return {
        ok: false,
        modelSizeBytes,
        estimatedRamBytes,
        freeMemoryBytes,
        totalMemoryBytes,
        message: `This model needs ~${estimatedGB} GB RAM (with ${ctxK}K context) but only ${freeGB} GB is available. Try reducing the context size in Settings.`,
      };
    }

    return {
      ok: true,
      modelSizeBytes,
      estimatedRamBytes,
      freeMemoryBytes,
      totalMemoryBytes,
      message: null,
    };
  });

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
