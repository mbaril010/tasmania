import { ipcMain, shell, dialog, app } from 'electron';
import { execSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { IPC } from '../../shared/ipc-channels';
import { getSettings, setSettings, getModelsDir } from '../store/AppStore';
import type { AppSettings } from '../../shared/types';

/**
 * Get available memory (free + reclaimable) on the current platform.
 * On macOS, os.freemem() only reports truly "free" pages — misleadingly low
 * because macOS aggressively caches in RAM. We parse vm_stat to include
 * inactive and purgeable pages that the OS will reclaim on demand.
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

export function registerSystemHandlers() {
  ipcMain.handle(IPC.SYSTEM_INFO, () => {
    return {
      platform: process.platform,
      arch: process.arch,
      memory: os.totalmem(),
      freeMemory: getAvailableMemory(),
    };
  });

  ipcMain.handle(IPC.SYSTEM_OPEN_PATH, async (_event, filePath: string) => {
    // Only allow opening paths within known safe directories
    const resolved = path.resolve(filePath);
    const allowedDirs = [
      path.resolve(getModelsDir()),
      path.resolve(app.getPath('logs')),
      path.resolve(app.getPath('userData')),
    ];
    const isAllowed = allowedDirs.some((dir) => resolved.startsWith(dir));
    if (!isAllowed) {
      throw new Error('Opening this path is not allowed');
    }
    await shell.openPath(resolved);
  });

  ipcMain.handle(IPC.SYSTEM_OPEN_EXTERNAL, async (_event, url: string) => {
    // Only allow http/https URLs to prevent file://, javascript:, etc.
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new Error('Invalid URL');
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error(`URL protocol "${parsed.protocol}" is not allowed`);
    }
    await shell.openExternal(url);
  });

  ipcMain.handle(IPC.SYSTEM_SELECT_DIR, async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
      title: 'Select Models Directory',
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle(IPC.SETTINGS_GET, () => {
    return getSettings();
  });

  ipcMain.handle(IPC.SETTINGS_SET, (_event, partial: Partial<AppSettings>) => {
    // Validate port numbers
    if (partial.llamaCpp?.port != null) {
      if (!Number.isInteger(partial.llamaCpp.port) || partial.llamaCpp.port < 1024 || partial.llamaCpp.port > 65535) {
        throw new Error('llama.cpp port must be 1024-65535');
      }
    }
    if (partial.stableDiffusion?.port != null) {
      if (!Number.isInteger(partial.stableDiffusion.port) || partial.stableDiffusion.port < 1024 || partial.stableDiffusion.port > 65535) {
        throw new Error('Stable Diffusion port must be 1024-65535');
      }
    }
    // Validate context size
    if (partial.llamaCpp?.contextSize != null) {
      if (!Number.isInteger(partial.llamaCpp.contextSize) || partial.llamaCpp.contextSize < 128 || partial.llamaCpp.contextSize > 1_048_576) {
        throw new Error('Context size must be 128-1048576');
      }
    }
    // Validate GPU layers
    if (partial.llamaCpp?.gpuLayers != null) {
      if (!Number.isInteger(partial.llamaCpp.gpuLayers) || partial.llamaCpp.gpuLayers < 0 || partial.llamaCpp.gpuLayers > 999) {
        throw new Error('GPU layers must be 0-999');
      }
    }
    setSettings(partial);
  });
}
