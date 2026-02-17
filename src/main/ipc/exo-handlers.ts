import { ipcMain, BrowserWindow } from 'electron';
import { IPC } from '../../shared/ipc-channels';
import { ExoBackend } from '../services/ExoBackend';
import { getSettings } from '../store/AppStore';

const backend = new ExoBackend();

function sendToRenderer(channel: string, ...args: unknown[]) {
  const win = BrowserWindow.getAllWindows()[0];
  if (win && !win.isDestroyed()) {
    win.webContents.send(channel, ...args);
  }
}

export function getExoBackend(): ExoBackend {
  return backend;
}

export function registerExoHandlers() {
  // Forward events to renderer
  backend.events.on('log', (line: unknown) => sendToRenderer(IPC.EXO_LOG_LINE, line));
  backend.events.on('status-changed', () => sendToRenderer(IPC.EXO_STATUS_CHANGED, backend.getServerState()));
  backend.events.on('cluster-changed', (state: unknown) => sendToRenderer(IPC.EXO_CLUSTER_CHANGED, state));
  backend.events.on('download-progress', (data: unknown) => sendToRenderer(IPC.EXO_DOWNLOAD_PROGRESS, data));

  // Auto-connect if configured
  const settings = getSettings();
  if (settings.exo?.autoConnect) {
    backend.configure(settings.exo.host, settings.exo.port);
    backend.connect().catch((err) => {
      console.log(`[Exo] Auto-connect failed: ${err.message}`);
    });
  }

  ipcMain.handle(IPC.EXO_CONNECT, async () => {
    const s = getSettings();
    backend.configure(s.exo.host, s.exo.port);
    await backend.connect();
  });

  ipcMain.handle(IPC.EXO_DISCONNECT, async () => {
    await backend.disconnect();
  });

  ipcMain.handle(IPC.EXO_STATUS, () => {
    return backend.getServerState();
  });

  ipcMain.handle(IPC.EXO_LOGS, () => {
    return backend.getLogs();
  });

  ipcMain.handle(IPC.EXO_CLUSTER_STATE, async () => {
    return backend.getClusterState();
  });

  ipcMain.handle(IPC.EXO_LIST_MODELS, async () => {
    return backend.listModels();
  });

  ipcMain.handle(IPC.EXO_SEARCH_MODELS, async (_event, query: string) => {
    return backend.searchModels(query);
  });

  ipcMain.handle(IPC.EXO_ADD_MODEL, async (_event, repoId: string) => {
    await backend.addCustomModel(repoId);
  });

  ipcMain.handle(IPC.EXO_DELETE_MODEL, async (_event, modelId: string) => {
    await backend.deleteCustomModel(modelId);
  });

  ipcMain.handle(IPC.EXO_INSTANCE_PREVIEW, async (_event, modelId: string) => {
    return backend.previewInstance(modelId);
  });

  ipcMain.handle(IPC.EXO_CREATE_INSTANCE, async (_event, modelId: string) => {
    return backend.createInstance(modelId);
  });

  ipcMain.handle(IPC.EXO_DELETE_INSTANCE, async () => {
    await backend.deleteInstance();
  });

  ipcMain.handle(IPC.EXO_START_DOWNLOAD, async (_event, modelId: string) => {
    await backend.startDownload(modelId);
  });

  ipcMain.handle(IPC.EXO_CANCEL_DOWNLOAD, async (_event, nodeId: string, modelId: string) => {
    await backend.cancelDownload(nodeId, modelId);
  });
}

export async function shutdownExo() {
  if (backend.isConnected()) {
    try {
      await backend.stopServer();
    } catch {
      // Best-effort cleanup
    }
    await backend.disconnect();
  }
}
