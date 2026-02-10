import { ipcMain, shell, dialog } from 'electron';
import os from 'node:os';
import { IPC } from '../../shared/ipc-channels';
import { getSettings, setSettings } from '../store/AppStore';
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
    await shell.openPath(filePath);
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
    setSettings(partial);
  });
}
