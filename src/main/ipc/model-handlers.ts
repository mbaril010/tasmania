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
    if (typeof modelPath !== 'string' || modelPath.length === 0) throw new Error('Invalid model path');
    await modelService.deleteModel(modelPath);
  });

  ipcMain.handle(IPC.MODEL_SEARCH_HF, async (_event, query: string) => {
    if (typeof query !== 'string' || query.trim().length === 0) throw new Error('Search query is required');
    if (query.length > 200) throw new Error('Search query too long');
    return hfService.searchModels(query);
  });

  ipcMain.handle(IPC.MODEL_LIST_FILES, async (_event, repo: string) => {
    if (typeof repo !== 'string' || !/^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.\-]+$/.test(repo)) {
      throw new Error('Invalid repository format');
    }
    return hfService.listModelFiles(repo);
  });

  ipcMain.handle(IPC.MODEL_DOWNLOAD, async (_event, repo: string, filename: string) => {
    if (typeof repo !== 'string' || typeof filename !== 'string') throw new Error('Invalid arguments');
    const destDir = getModelsDir();
    return hfService.downloadModel(repo, filename, destDir);
  });

  ipcMain.handle(IPC.MODEL_CANCEL_DOWNLOAD, async (_event, downloadId: string) => {
    if (typeof downloadId !== 'string' || downloadId.length === 0) throw new Error('Invalid download ID');
    hfService.cancelDownload(downloadId);
  });
}
