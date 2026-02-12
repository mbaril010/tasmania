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
  private processes = new Map<string, IPty>();

  create(sessionId: string, cols: number, rows: number, customEnv?: Record<string, string>): void {
    // Kill existing PTY for this session if any
    this.kill(sessionId);

    const shell = process.env.SHELL || '/bin/zsh';

    const proc = pty.spawn(shell, ['-l'], {
      name: 'xterm-256color',
      cols,
      rows,
      cwd: process.env.HOME || '/',
      env: { ...process.env, ...customEnv } as Record<string, string>,
    });

    this.processes.set(sessionId, proc);

    proc.onData((data: string) => {
      this.emit('data', sessionId, data);
    });

    proc.onExit(() => {
      this.processes.delete(sessionId);
      this.emit('exit', sessionId);
    });
  }

  write(sessionId: string, data: string): void {
    this.processes.get(sessionId)?.write(data);
  }

  resize(sessionId: string, cols: number, rows: number): void {
    this.processes.get(sessionId)?.resize(cols, rows);
  }

  kill(sessionId: string): void {
    const proc = this.processes.get(sessionId);
    if (proc) {
      proc.kill();
      this.processes.delete(sessionId);
    }
  }

  killAll(): void {
    for (const [id, proc] of this.processes) {
      proc.kill();
      this.processes.delete(id);
    }
  }
}
