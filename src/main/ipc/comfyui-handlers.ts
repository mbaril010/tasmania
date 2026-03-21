import { ipcMain, BrowserWindow } from 'electron';
import { IPC } from '../../shared/ipc-channels';
import { ComfyUIInstaller } from '../services/ComfyUIInstaller';
import { getSettings } from '../store/AppStore';

const installer = new ComfyUIInstaller();

function sendToRenderer(channel: string, ...args: unknown[]) {
  const win = BrowserWindow.getAllWindows()[0];
  if (win && !win.isDestroyed()) {
    win.webContents.send(channel, ...args);
  }
}

export function getComfyUIInstaller(): ComfyUIInstaller {
  return installer;
}

export function registerComfyUIHandlers() {
  // Forward progress events to renderer
  installer.on('progress', (progress) => {
    sendToRenderer(IPC.COMFYUI_INSTALL_PROGRESS, progress);
  });

  ipcMain.handle(IPC.COMFYUI_INSTALL_STATUS, async () => {
    const settings = getSettings();
    return installer.getInstallInfo(settings.comfyui.mode);
  });

  ipcMain.handle(IPC.COMFYUI_CHECK_PYTHON, async () => {
    return installer.checkPython();
  });

  ipcMain.handle(IPC.COMFYUI_INSTALL_START, async () => {
    await installer.install();
  });

  ipcMain.handle(IPC.COMFYUI_INSTALL_CANCEL, async () => {
    installer.cancel();
  });

  ipcMain.handle(IPC.COMFYUI_UNINSTALL, async () => {
    await installer.uninstall();
  });
}
