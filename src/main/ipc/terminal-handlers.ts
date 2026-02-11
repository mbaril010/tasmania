import { ipcMain, BrowserWindow } from 'electron';
import { IPC } from '../../shared/ipc-channels';
import { TerminalService } from '../services/TerminalService';

const terminalService = new TerminalService();

export function registerTerminalHandlers(): void {
  terminalService.on('data', (data: string) => {
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send(IPC.TERMINAL_DATA, data);
    });
  });

  ipcMain.handle(IPC.TERMINAL_CREATE, (_event, cols: number, rows: number, customEnv?: Record<string, string>) => {
    terminalService.create(cols, rows, customEnv);
  });

  ipcMain.handle(IPC.TERMINAL_WRITE, (_event, data: string) => {
    terminalService.write(data);
  });

  ipcMain.handle(IPC.TERMINAL_RESIZE, (_event, cols: number, rows: number) => {
    terminalService.resize(cols, rows);
  });

  ipcMain.handle(IPC.TERMINAL_KILL, () => {
    terminalService.kill();
  });
}

export function shutdownTerminal(): void {
  terminalService.kill();
}
