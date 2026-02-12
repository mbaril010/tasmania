import { ChildProcess, spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';

const MAX_LOG_LINES = 500;

export interface ProcessInfo {
  pid: number;
  command: string;
  args: string[];
  startedAt: number;
}

/**
 * Manages a single child process lifecycle — spawn, monitor, capture logs, kill.
 */
export class ProcessManager extends EventEmitter {
  private process: ChildProcess | null = null;
  private logs: string[] = [];
  private info: ProcessInfo | null = null;

  get running(): boolean {
    return this.process !== null && !this.process.killed;
  }

  get pid(): number | null {
    return this.process?.pid ?? null;
  }

  getInfo(): ProcessInfo | null {
    return this.info;
  }

  getLogs(): string[] {
    return [...this.logs];
  }

  /**
   * Spawn a child process and monitor stdout/stderr.
   * Resolves when the process is confirmed ready (via readyPattern match on stdout),
   * or rejects on early exit / timeout.
   */
  async start(
    command: string,
    args: string[],
    options?: {
      readyPattern?: RegExp;
      timeoutMs?: number;
      env?: Record<string, string>;
    }
  ): Promise<void> {
    if (this.running) {
      await this.stop();
    }

    this.logs = [];
    const readyPattern = options?.readyPattern ?? /listening|started|ready/i;
    const timeoutMs = options?.timeoutMs ?? 30_000;

    return new Promise<void>((resolve, reject) => {
      const proc = spawn(command, args, {
        env: { ...process.env, ...options?.env },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      this.process = proc;
      this.info = {
        pid: proc.pid!,
        command,
        args,
        startedAt: Date.now(),
      };

      const timeout = setTimeout(() => {
        reject(new Error(`Server did not become ready within ${timeoutMs}ms`));
      }, timeoutMs);

      let resolved = false;

      const onLine = (line: string) => {
        this.pushLog(line);
        this.emit('log', line);

        if (!resolved && readyPattern.test(line)) {
          resolved = true;
          clearTimeout(timeout);
          resolve();
        }
      };

      proc.stdout?.on('data', (data: Buffer) => {
        const lines = data.toString().split('\n').filter(Boolean);
        lines.forEach(onLine);
      });

      proc.stderr?.on('data', (data: Buffer) => {
        const lines = data.toString().split('\n').filter(Boolean);
        lines.forEach(onLine);
      });

      proc.on('error', (err) => {
        clearTimeout(timeout);
        this.cleanup();
        if (!resolved) {
          reject(new Error(`Failed to start process: ${err.message}`));
        }
        this.emit('error', err);
      });

      // Use 'close' instead of 'exit' — 'close' fires after all stdio
      // streams are drained, ensuring logs are fully captured before we
      // inspect them for error matching in callers like StableDiffusionBackend.
      proc.on('close', (code, signal) => {
        clearTimeout(timeout);
        this.cleanup();
        if (!resolved) {
          const recentLogs = this.logs.slice(-5).join('\n');
          reject(new Error(`Process exited early with code ${code}, signal ${signal}\n${recentLogs}`));
        }
        this.emit('exit', code, signal);
      });
    });
  }

  /** Gracefully stop the process (SIGTERM, then SIGKILL after 5s) */
  async stop(): Promise<void> {
    if (!this.process || this.process.killed) {
      this.cleanup();
      return;
    }

    return new Promise<void>((resolve) => {
      const forceKill = setTimeout(() => {
        if (this.process && !this.process.killed) {
          this.process.kill('SIGKILL');
        }
        this.cleanup();
        resolve();
      }, 5_000);

      this.process!.on('exit', () => {
        clearTimeout(forceKill);
        this.cleanup();
        resolve();
      });

      this.process!.kill('SIGTERM');
    });
  }

  private pushLog(line: string) {
    const timestamp = new Date().toISOString().slice(11, 19);
    this.logs.push(`[${timestamp}] ${line}`);
    if (this.logs.length > MAX_LOG_LINES) {
      this.logs.shift();
    }
  }

  private cleanup() {
    this.process = null;
    this.info = null;
  }
}
