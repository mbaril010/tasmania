import { ipcMain, shell, dialog, app } from 'electron';
import os from 'node:os';
import path from 'node:path';
import { IPC } from '../../shared/ipc-channels';
import { getSettings, setSettings, getModelsDir } from '../store/AppStore';
import type { AppSettings } from '../../shared/types';

export function registerSystemHandlers() {
  ipcMain.handle(IPC.SYSTEM_INFO, () => {
    return {
      platform: process.platform,
      arch: process.arch,
      memory: os.totalmem(),
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
