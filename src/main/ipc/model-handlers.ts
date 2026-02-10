import { ipcMain, BrowserWindow } from 'electron';
import { IPC } from '../../shared/ipc-channels';
import { HuggingFaceService } from '../services/HuggingFaceService';
import { ModelService } from '../services/ModelService';
import { getModelsDir } from '../store/AppStore';

const hfService = new HuggingFaceService();
const modelService = new ModelService();

function sendToRenderer(channel: string, ...args: unknown[]) {
  const win = BrowserWindow.getAllWindows()[0];
  if (win && !win.isDestroyed()) {
    win.webContents.send(channel, ...args);
  }
}

export function getModelService(): ModelService {
  return modelService;
}

export function getHuggingFaceService(): HuggingFaceService {
  return hfService;
}

export function registerModelHandlers() {
  // Forward download progress to renderer
  hfService.on('progress', (progress) => {
    sendToRenderer(IPC.MODEL_DOWNLOAD_PROGRESS, progress);
  });

  ipcMain.handle(IPC.MODEL_LIST_LOCAL, async () => {
    return modelService.listLocalModels();
  });

  ipcMain.handle(IPC.MODEL_DELETE, async (_event, modelPath: string) => {
    await modelService.deleteModel(modelPath);
  });

  ipcMain.handle(IPC.MODEL_SEARCH_HF, async (_event, query: string) => {
    return hfService.searchModels(query);
  });

  ipcMain.handle(IPC.MODEL_LIST_FILES, async (_event, repo: string) => {
    return hfService.listModelFiles(repo);
  });

  ipcMain.handle(IPC.MODEL_DOWNLOAD, async (_event, repo: string, filename: string) => {
    const destDir = getModelsDir();
    return hfService.downloadModel(repo, filename, destDir);
  });

  ipcMain.handle(IPC.MODEL_CANCEL_DOWNLOAD, async (_event, downloadId: string) => {
    hfService.cancelDownload(downloadId);
  });
}
