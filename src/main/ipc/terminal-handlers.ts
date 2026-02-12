import { ipcMain, BrowserWindow } from 'electron';
import { IPC } from '../../shared/ipc-channels';
import { TerminalService } from '../services/TerminalService';

const terminalService = new TerminalService();

export function registerTerminalHandlers(): void {
  terminalService.on('data', (sessionId: string, data: string) => {
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send(IPC.TERMINAL_DATA, sessionId, data);
    });
  });

  terminalService.on('exit', (sessionId: string) => {
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send(IPC.TERMINAL_EXIT, sessionId);
    });
  });

  ipcMain.handle(IPC.TERMINAL_CREATE, (_event, sessionId: string, cols: number, rows: number, customEnv?: Record<string, string>) => {
    terminalService.create(sessionId, cols, rows, customEnv);
  });

  ipcMain.handle(IPC.TERMINAL_WRITE, (_event, sessionId: string, data: string) => {
    terminalService.write(sessionId, data);
  });

  ipcMain.handle(IPC.TERMINAL_RESIZE, (_event, sessionId: string, cols: number, rows: number) => {
    terminalService.resize(sessionId, cols, rows);
  });

  ipcMain.handle(IPC.TERMINAL_KILL, (_event, sessionId: string) => {
    terminalService.kill(sessionId);
  });

  ipcMain.handle(IPC.TERMINAL_KILL_ALL, () => {
    terminalService.killAll();
  });
}

export function shutdownTerminal(): void {
  terminalService.killAll();
}
