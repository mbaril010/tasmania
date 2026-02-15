import fs from 'node:fs/promises';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { BackendService } from './BackendService';
import { ProcessManager } from './ProcessManager';
import { COMFYUI_DEFAULT_PORT } from '../../shared/constants';
import type {
  BackendInfo,
  ServerOptions,
  ServerState,
} from '../../shared/types';

export class ComfyUIBackend extends BackendService {
  readonly type = 'comfyui' as const;
  private processManager = new ProcessManager();
  private comfyuiPath = '';
  private pythonPath = 'python3';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private wsClient: any = null;
  private progressEmitter = new EventEmitter();
  private state: ServerState = {
    status: 'stopped',
    backend: null,
    port: COMFYUI_DEFAULT_PORT,
    modelPath: null,
    modelName: null,
    pid: null,
    error: null,
    startedAt: null,
    contextSize: null,
    gpuLayers: null,
  };

  configure(comfyuiPath: string, port: number, pythonPath: string) {
    this.comfyuiPath = comfyuiPath;
    this.state.port = port || COMFYUI_DEFAULT_PORT;
    this.pythonPath = pythonPath || 'python3';
  }

  get progress(): EventEmitter {
    return this.progressEmitter;
  }

  async detect(): Promise<BackendInfo> {
    if (!this.comfyuiPath) {
      return { type: this.type, installed: false, executablePath: null, version: null };
    }
    try {
      const mainPy = path.join(this.comfyuiPath, 'main.py');
      await fs.access(mainPy);
      return { type: this.type, installed: true, executablePath: mainPy, version: 'user-installed' };
    } catch {
      return { type: this.type, installed: false, executablePath: null, version: null };
    }
  }

  async startServer(_modelPath: string, options: ServerOptions): Promise<void> {
    if (!this.comfyuiPath) {
      throw new Error('ComfyUI path not configured. Set it in Settings.');
    }

    const mainPy = path.join(this.comfyuiPath, 'main.py');
    try {
      await fs.access(mainPy);
    } catch {
      throw new Error(`ComfyUI main.py not found at: ${mainPy}`);
    }

    const port = options.port || this.state.port;

    this.state = {
      status: 'starting',
      backend: this.type,
      port,
      modelPath: this.comfyuiPath,
      modelName: 'ComfyUI',
      pid: null,
      error: null,
      startedAt: null,
      contextSize: null,
      gpuLayers: null,
    };

    try {
      await this.processManager.start(this.pythonPath, [
        mainPy,
        '--listen', '127.0.0.1',
        '--port', String(port),
      ], {
        readyPattern: /To see the GUI go to/i,
        timeoutMs: 120_000,
      });

      this.state.status = 'running';
      this.state.pid = this.processManager.pid;
      this.state.startedAt = Date.now();

      this.processManager.on('exit', () => {
        if (this.state.status === 'running') {
          this.state.status = 'error';
          this.state.error = 'ComfyUI process exited unexpectedly';
          this.state.pid = null;
        }
        this.disconnectWebSocket();
      });

      // Connect WebSocket for progress events
      this.connectWebSocket(port);
    } catch (err) {
      this.state.status = 'error';
      this.state.error = err instanceof Error ? err.message : String(err);
      throw err;
    }
  }

  async stopServer(): Promise<void> {
    this.disconnectWebSocket();
    await this.processManager.stop();
    this.state = {
      status: 'stopped',
      backend: null,
      port: this.state.port,
      modelPath: null,
      modelName: null,
      pid: null,
      error: null,
      startedAt: null,
      contextSize: null,
      gpuLayers: null,
    };
  }

  getServerState(): ServerState {
    return { ...this.state };
  }

  getApiEndpoint(): string {
    return `http://127.0.0.1:${this.state.port}`;
  }

  getLogs(): string[] {
    return this.processManager.getLogs();
  }

  get events(): ProcessManager {
    return this.processManager;
  }

  /** Queue a workflow prompt and return the prompt_id */
  async queuePrompt(workflow: Record<string, unknown>): Promise<string> {
    const baseUrl = this.getApiEndpoint();
    const response = await fetch(`${baseUrl}/prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: workflow }),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`ComfyUI prompt queue failed (${response.status}): ${text}`);
    }
    const json = await response.json() as { prompt_id: string };
    return json.prompt_id;
  }

  /** Poll history for a completed prompt */
  async getHistory(promptId: string): Promise<Record<string, unknown> | null> {
    const baseUrl = this.getApiEndpoint();
    const response = await fetch(`${baseUrl}/history/${promptId}`);
    if (!response.ok) return null;
    const json = await response.json() as Record<string, Record<string, unknown>>;
    return json[promptId] ?? null;
  }

  /** Upload an image to ComfyUI for img2vid */
  async uploadImage(base64: string, filename: string): Promise<{ name: string; subfolder: string }> {
    const baseUrl = this.getApiEndpoint();
    const buffer = Buffer.from(base64, 'base64');

    // Build multipart form data manually
    const boundary = '----ComfyUIUpload' + Date.now();
    const parts: Buffer[] = [];

    // Image file part
    parts.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="${filename}"\r\nContent-Type: image/png\r\n\r\n`
    ));
    parts.push(buffer);
    parts.push(Buffer.from('\r\n'));

    // Overwrite part
    parts.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="overwrite"\r\n\r\ntrue\r\n`
    ));

    parts.push(Buffer.from(`--${boundary}--\r\n`));

    const body = Buffer.concat(parts);

    const response = await fetch(`${baseUrl}/upload/image`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
      body,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Image upload failed (${response.status}): ${text}`);
    }

    return await response.json() as { name: string; subfolder: string };
  }

  /** Wait for a prompt to complete by polling history */
  async waitForCompletion(promptId: string, timeoutMs = 600_000): Promise<Record<string, unknown>> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const history = await this.getHistory(promptId);
      if (history) {
        const status = history.status as { status_str?: string } | undefined;
        if (status?.status_str === 'success') return history;
        if (status?.status_str === 'error') {
          throw new Error('ComfyUI generation failed');
        }
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    throw new Error('ComfyUI generation timed out');
  }

  /** Interrupt the current generation */
  async interrupt(): Promise<void> {
    const baseUrl = this.getApiEndpoint();
    await fetch(`${baseUrl}/interrupt`, { method: 'POST' });
  }

  private connectWebSocket(port: number) {
    try {
      // Use dynamic import for ws since it may not be available in all environments
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const WebSocket = require('ws');
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);

      ws.on('message', (data: Buffer) => {
        try {
          const msg = JSON.parse(data.toString()) as { type: string; data: Record<string, unknown> };
          if (msg.type === 'progress') {
            this.progressEmitter.emit('progress', msg.data);
          } else if (msg.type === 'executed') {
            this.progressEmitter.emit('executed', msg.data);
          }
        } catch {
          // Ignore parse errors
        }
      });

      ws.on('error', () => {
        // WebSocket connection errors are non-fatal for the backend
      });

      ws.on('close', () => {
        this.wsClient = null;
      });

      this.wsClient = ws;
    } catch {
      // ws module not available — progress tracking disabled
    }
  }

  private disconnectWebSocket() {
    if (this.wsClient) {
      try {
        this.wsClient.close();
      } catch {
        // Ignore close errors
      }
      this.wsClient = null;
    }
  }
}
