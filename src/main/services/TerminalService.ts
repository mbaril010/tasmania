import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';
import { app } from 'electron';
import path from 'node:path';

// Resolve @lydell/node-pty from the app root so it works regardless of Vite's output directory
const appRequire = createRequire(path.join(app.getAppPath(), 'package.json'));
// eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-explicit-any
const pty = appRequire('@lydell/node-pty') as any;

interface IDisposable {
  dispose(): void;
}

interface IPty {
  onData: (callback: (data: string) => void) => IDisposable;
  onExit: (callback: (e: { exitCode: number; signal?: number }) => void) => IDisposable;
  write: (data: string) => void;
  resize: (cols: number, rows: number) => void;
  kill: (signal?: string) => void;
}

export class TerminalService extends EventEmitter {
  private ptyProcess: IPty | null = null;

  create(cols: number, rows: number, customEnv?: Record<string, string>): void {
    // Kill existing PTY if any
    this.kill();

    const shell = process.env.SHELL || '/bin/zsh';

    this.ptyProcess = pty.spawn(shell, ['-l'], {
      name: 'xterm-256color',
      cols,
      rows,
      cwd: process.env.HOME || '/',
      env: { ...process.env, ...customEnv } as Record<string, string>,
    });

    const proc = this.ptyProcess;
    proc.onData((data: string) => {
      this.emit('data', data);
    });

    proc.onExit(() => {
      this.ptyProcess = null;
      this.emit('exit');
    });
  }

  write(data: string): void {
    this.ptyProcess?.write(data);
  }

  resize(cols: number, rows: number): void {
    this.ptyProcess?.resize(cols, rows);
  }

  kill(): void {
    if (this.ptyProcess) {
      this.ptyProcess.kill();
      this.ptyProcess = null;
    }
  }
}
