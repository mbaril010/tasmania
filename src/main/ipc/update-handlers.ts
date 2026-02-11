import { ipcMain, BrowserWindow } from 'electron';
import { IPC } from '../../shared/ipc-channels';
import { UpdateService } from '../services/UpdateService';
import type { UpdateInfo } from '../../shared/types';

const updateService = new UpdateService();

export function registerUpdateHandlers() {
  ipcMain.handle(IPC.UPDATE_CHECK, async () => {
    return await updateService.checkForUpdates();
  });

  ipcMain.handle(IPC.UPDATE_GET_INFO, () => {
    return updateService.getLatestUpdateInfo();
  });

  // Forward events to renderer
  updateService.on('update-available', (info: UpdateInfo) => {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(IPC.UPDATE_AVAILABLE, info);
    }
  });

  updateService.on('update-not-available', (info: UpdateInfo) => {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(IPC.UPDATE_NOT_AVAILABLE, info);
    }
  });

  updateService.on('update-error', (error: string) => {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(IPC.UPDATE_ERROR, error);
    }
  });
}

/** Check for updates on launch after a short delay */
export function checkForUpdatesOnLaunch(autoCheckEnabled: boolean): void {
  if (!autoCheckEnabled) return;
  setTimeout(() => {
    updateService.checkForUpdates().catch((err) => {
      console.error('[Tasmania] Auto-update check failed:', err);
    });
  }, 3000);
}
