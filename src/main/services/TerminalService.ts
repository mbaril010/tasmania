import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';
import { app } from 'electron';
import path from 'node:path';

// In dev: resolve @lydell/node-pty from project root node_modules.
// In production: the platform-specific package (node-pty-darwin-arm64) is copied to
// Contents/Resources/ via extraResource in forge config. We require it directly,
// skipping the @lydell/node-pty trampoline that does require('@lydell/node-pty-<platform>').
let pty: any; // eslint-disable-line @typescript-eslint/no-explicit-any
if (app.isPackaged) {
  pty = require(path.join(process.resourcesPath, 'node-pty-darwin-arm64', 'lib', 'index.js'));
} else {
  const appRequire = createRequire(path.join(app.getAppPath(), 'package.json'));
  pty = appRequire('@lydell/node-pty');
}

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
