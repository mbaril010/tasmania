import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import { registerBackendHandlers, shutdownBackends } from './ipc/backend-handlers';
import { registerModelHandlers } from './ipc/model-handlers';
import { registerSystemHandlers } from './ipc/system-handlers';
import { startControlApi, stopControlApi } from './mcp/control-api';

let mainWindow: BrowserWindow | null = null;

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Vite dev server or production build
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
    );
  }

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

// Register all IPC handlers
ipcMain.handle('ping', () => 'pong');
registerBackendHandlers();
registerModelHandlers();
registerSystemHandlers();

app.whenReady().then(() => {
  createWindow();
  startControlApi();
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Clean up server processes on quit
app.on('before-quit', async () => {
  stopControlApi();
  await shutdownBackends();
});

// Declare Vite globals
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;
