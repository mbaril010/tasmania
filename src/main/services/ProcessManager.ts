import { ChildProcess, spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';

const MAX_LOG_LINES = 500;
const MAX_LOG_LINE_LENGTH = 10_000;

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

      let settled = false;
      const settleResolve = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      const settleReject = (err: Error) => {
        if (settled) return;
        settled = true;
        reject(err);
      };

      const timeout = setTimeout(() => {
        if (!resolved) {
          const recentLogs = this.logs.slice(-5).join('\n');
          settleReject(new Error(`Server did not become ready within ${timeoutMs}ms\n${recentLogs}`));
          if (!proc.killed) {
            proc.kill('SIGTERM');
            setTimeout(() => {
              if (!proc.killed) {
                proc.kill('SIGKILL');
              }
            }, 2_000);
          }
        }
      }, timeoutMs);

      let resolved = false;

      const onLine = (line: string) => {
        this.pushLog(line);
        this.emit('log', line);

        if (!resolved && readyPattern.test(line)) {
          resolved = true;
          clearTimeout(timeout);
          settleResolve();
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
          settleReject(new Error(`Failed to start process: ${err.message}`));
        }
        this.emit('error', err);
      });

      // Use 'close' instead of 'exit' — 'close' fires after all stdio
      // streams are drained, ensuring logs are fully captured before we
      // inspect them for error matching in callers like StableDiffusionBackend.
      proc.on('close', (code, signal) => {
        clearTimeout(timeout);
        const recentLogs = this.logs.slice(-5).join('\n');
        this.cleanup();
        if (!resolved) {
          settleReject(new Error(`Process exited early with code ${code}, signal ${signal}\n${recentLogs}`));
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
      const proc = this.process;
      if (!proc) {
        this.cleanup();
        resolve();
        return;
      }

      let settled = false;
      const settle = () => {
        if (settled) return;
        settled = true;
        this.cleanup();
        resolve();
      };

      const forceKill = setTimeout(() => {
        if (proc && !proc.killed) {
          proc.kill('SIGKILL');
        }
        settle();
      }, 5_000);

      proc.once('exit', () => {
        clearTimeout(forceKill);
        settle();
      });

      proc.kill('SIGTERM');
    });
  }

  private pushLog(line: string) {
    const timestamp = new Date().toISOString().slice(11, 19);
    const truncated = line.length > MAX_LOG_LINE_LENGTH
      ? line.slice(0, MAX_LOG_LINE_LENGTH) + '... [truncated]'
      : line;
    this.logs.push(`[${timestamp}] ${truncated}`);
    if (this.logs.length > MAX_LOG_LINES) {
      this.logs.shift();
    }
  }

  private cleanup() {
    this.process = null;
    this.info = null;
  }
}
