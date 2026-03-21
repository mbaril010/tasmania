import { ipcMain, shell, dialog, app } from 'electron';
import { execSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { IPC } from '../../shared/ipc-channels';
import { VIDEO_MODELS_DIR } from '../../shared/constants';
import { assertPathInsideAny } from '../security/path-utils';
import { validateSettingsPartial } from '../security/settings-schema';
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

/** Directories the app is allowed to serve / open files from. */
export function getAllowedDirs(): string[] {
  const settings = getSettings();
  return [
    path.resolve(getModelsDir()),
    path.resolve(app.getPath('logs')),
    path.resolve(app.getPath('userData')),
    path.resolve(settings.imageOutput.outputDir),
  ];
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
    if (typeof filePath !== 'string' || filePath.trim().length === 0) {
      throw new Error('Path is required');
    }

    const resolved = assertPathInsideAny(
      getAllowedDirs(),
      filePath,
      'Opening this path is not allowed',
    );
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

  ipcMain.handle(IPC.SYSTEM_VIDEO_MODELS_DIR, async () => {
    const subdirs = ['diffusion_models', 'vae', 'clip', 'checkpoints', 'unet'];
    await Promise.all(subdirs.map((d) => fs.mkdir(path.join(VIDEO_MODELS_DIR, d), { recursive: true })));
    return VIDEO_MODELS_DIR;
  });

  ipcMain.handle(IPC.SETTINGS_GET, () => {
    return getSettings();
  });

  ipcMain.handle(IPC.SETTINGS_SET, (_event, partial: Partial<AppSettings>) => {
    const validated = validateSettingsPartial(partial);
    setSettings(validated);
  });
}
