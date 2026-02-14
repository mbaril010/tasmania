import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import { BackendService } from './BackendService';
import { ProcessManager } from './ProcessManager';
import { LLAMA_CPP_DEFAULT_PORT, DEFAULT_CONTEXT_SIZE, DEFAULT_GPU_LAYERS } from '../../shared/constants';
import type { BackendInfo, ServerOptions, ServerState } from '../../shared/types';

/** Resolve the bundled binaries directory */
function getBinariesDir(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'binaries');
  }
  // Development: binaries live in project root /binaries/
  return path.join(app.getAppPath(), 'binaries');
}

/** Resolve the bundled llama-server binary path */
function getBinaryPath(): string {
  return path.join(getBinariesDir(), 'llama-server');
}

export class LlamaCppBackend extends BackendService {
  readonly type = 'llama.cpp' as const;
  private processManager = new ProcessManager();
  private state: ServerState = {
    status: 'stopped',
    backend: null,
    port: LLAMA_CPP_DEFAULT_PORT,
    modelPath: null,
    modelName: null,
    pid: null,
    error: null,
    startedAt: null,
    contextSize: null,
    gpuLayers: null,
  };

  async detect(): Promise<BackendInfo> {
    const binaryPath = getBinaryPath();
    try {
      await fs.access(binaryPath, fs.constants.X_OK);
      return {
        type: this.type,
        installed: true,
        executablePath: binaryPath,
        version: 'bundled',
      };
    } catch {
      return {
        type: this.type,
        installed: false,
        executablePath: null,
        version: null,
      };
    }
  }

  async startServer(modelPath: string, options: ServerOptions): Promise<void> {
    const binaryPath = getBinaryPath();

    try {
      await fs.access(binaryPath, fs.constants.X_OK);
    } catch {
      throw new Error(`Bundled llama-server not found at: ${binaryPath}`);
    }

    const port = options.port || LLAMA_CPP_DEFAULT_PORT;
    const contextSize = options.contextSize || DEFAULT_CONTEXT_SIZE;
    const gpuLayers = options.gpuLayers ?? DEFAULT_GPU_LAYERS;

    const args = [
      '-m', modelPath,
      '--port', String(port),
      '-c', String(contextSize),
      '-ngl', String(gpuLayers),
    ];

    this.state = {
      status: 'starting',
      backend: this.type,
      port,
      modelPath,
      modelName: modelPath.split('/').pop()?.replace('.gguf', '') ?? null,
      pid: null,
      error: null,
      startedAt: null,
      contextSize,
      gpuLayers,
    };

    try {
      const binDir = getBinariesDir();
      await this.processManager.start(binaryPath, args, {
        readyPattern: /listening|all slots are idle/i,
        timeoutMs: 60_000,
        env: { DYLD_LIBRARY_PATH: binDir },
      });

      this.state.status = 'running';
      this.state.pid = this.processManager.pid;
      this.state.startedAt = Date.now();

      this.processManager.on('exit', () => {
        if (this.state.status === 'running') {
          this.state.status = 'error';
          this.state.error = 'Server process exited unexpectedly';
          this.state.pid = null;
        }
      });
    } catch (err) {
      this.state.status = 'error';
      this.state.error = err instanceof Error ? err.message : String(err);
      throw err;
    }
  }

  async stopServer(): Promise<void> {
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
    return `http://127.0.0.1:${this.state.port}/v1`;
  }

  getLogs(): string[] {
    return this.processManager.getLogs();
  }

  get events(): ProcessManager {
    return this.processManager;
  }
}
