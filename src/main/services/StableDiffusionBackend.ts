import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import { BackendService } from './BackendService';
import { ProcessManager } from './ProcessManager';
import { SD_DEFAULT_PORT } from '../../shared/constants';
import type {
  BackendInfo,
  CompanionFileStatus,
  CompanionRole,
  ImageModelArch,
  ModelResolution,
  ServerOptions,
  ServerState,
} from '../../shared/types';

function getBinariesDir(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'binaries');
  }
  return path.join(app.getAppPath(), 'binaries');
}

function getBinaryPath(): string {
  return path.join(getBinariesDir(), 'sd-server');
}

// ── Architecture detection ──

interface CompanionSpec {
  role: CompanionRole;
  flag: string;
  required: boolean;
  patterns: RegExp[];
}

const ARCH_COMPANIONS: Record<ImageModelArch, CompanionSpec[]> = {
  sd1: [],
  sdxl: [],
  flux: [
    { role: 'diffusion_model', flag: '--diffusion-model', required: true, patterns: [/(?:flux|z[_\-.]?image).*\.(gguf|safetensors)$/i] },
    { role: 't5xxl', flag: '--t5xxl', required: true, patterns: [/t5xxl.*\.(gguf|safetensors)$/i] },
    { role: 'clip_l', flag: '--clip_l', required: true, patterns: [/clip_l.*\.(gguf|safetensors)$/i] },
    { role: 'vae', flag: '--vae', required: true, patterns: [/(?:ae|vae).*\.(gguf|safetensors)$/i] },
  ],
  sd3: [
    { role: 'diffusion_model', flag: '--diffusion-model', required: true, patterns: [/sd3.*mmdit.*\.(gguf|safetensors)$/i, /sd3.*\.(gguf|safetensors)$/i] },
    { role: 't5xxl', flag: '--t5xxl', required: false, patterns: [/t5xxl.*\.(gguf|safetensors)$/i] },
    { role: 'clip_l', flag: '--clip_l', required: true, patterns: [/clip_l.*\.(gguf|safetensors)$/i] },
    { role: 'clip_g', flag: '--clip_g', required: true, patterns: [/clip_g.*\.(gguf|safetensors)$/i] },
    { role: 'vae', flag: '--vae', required: false, patterns: [/(?:ae|vae).*\.(gguf|safetensors)$/i] },
  ],
  chroma: [
    { role: 'diffusion_model', flag: '--diffusion-model', required: true, patterns: [/chroma.*\.(gguf|safetensors)$/i] },
    { role: 't5xxl', flag: '--t5xxl', required: true, patterns: [/t5xxl.*\.(gguf|safetensors)$/i] },
    { role: 'vae', flag: '--vae', required: true, patterns: [/(?:ae|vae).*\.(gguf|safetensors)$/i] },
  ],
};

function detectArch(filename: string): ImageModelArch {
  const lower = filename.toLowerCase();
  if (/flux|z[_\-.]?image/i.test(lower)) return 'flux';
  if (/sd3\.?5|sd3/i.test(lower)) return 'sd3';
  if (/chroma/i.test(lower)) return 'chroma';
  if (/sdxl|sd_xl/i.test(lower)) return 'sdxl';
  return 'sd1';
}

async function discoverCompanions(
  modelPath: string,
  specs: CompanionSpec[],
): Promise<CompanionFileStatus[]> {
  const dir = path.dirname(modelPath);
  const modelFilename = path.basename(modelPath);

  let files: string[];
  try {
    files = await fs.readdir(dir);
  } catch {
    files = [];
  }

  // Exclude the primary model file from companion matching
  const candidates = files.filter((f) => f !== modelFilename);

  return specs.map((spec) => {
    const match = candidates.find((f) =>
      spec.patterns.some((p) => p.test(f)),
    );
    return {
      role: spec.role,
      flag: spec.flag,
      required: spec.required,
      found: !!match,
      path: match ? path.join(dir, match) : null,
      patterns: spec.patterns.map((p) => p.source),
    };
  });
}

// ── Backend class ──

export class StableDiffusionBackend extends BackendService {
  readonly type = 'stable-diffusion' as const;
  private processManager = new ProcessManager();
  private state: ServerState = {
    status: 'stopped',
    backend: null,
    port: SD_DEFAULT_PORT,
    modelPath: null,
    modelName: null,
    pid: null,
    error: null,
    startedAt: null,
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

  async resolveModel(modelPath: string): Promise<ModelResolution> {
    const filename = path.basename(modelPath);
    const arch = detectArch(filename);
    const specs = ARCH_COMPANIONS[arch];

    // Single-file architectures (sd1, sdxl) — no companions needed
    if (specs.length === 0) {
      return {
        arch,
        primaryPath: modelPath,
        primaryFlag: '-m',
        companions: [],
        ready: true,
        missingRequired: [],
      };
    }

    // Multi-file architectures — discover companion files
    const companions = await discoverCompanions(modelPath, specs);
    const missingRequired = companions
      .filter((c) => c.required && !c.found)
      .map((c) => c.role);

    // For multi-file archs, the primary model IS the diffusion_model companion.
    // If the user selected the main diffusion model file, mark that companion as found.
    const diffusionCompanion = companions.find((c) => c.role === 'diffusion_model');
    if (diffusionCompanion && !diffusionCompanion.found) {
      // The selected file is itself the diffusion model
      diffusionCompanion.found = true;
      diffusionCompanion.path = modelPath;
      const idx = missingRequired.indexOf('diffusion_model');
      if (idx !== -1) missingRequired.splice(idx, 1);
    }

    return {
      arch,
      primaryPath: modelPath,
      primaryFlag: '--diffusion-model',
      companions,
      ready: missingRequired.length === 0,
      missingRequired,
    };
  }

  async startServer(modelPath: string, options: ServerOptions): Promise<void> {
    const binaryPath = getBinaryPath();

    try {
      await fs.access(binaryPath, fs.constants.X_OK);
    } catch {
      throw new Error(`Bundled sd-server not found at: ${binaryPath}`);
    }

    const port = options.port || SD_DEFAULT_PORT;
    const binDir = getBinariesDir();
    const startOpts = {
      readyPattern: /starting server|listening|ready/i,
      timeoutMs: 120_000,
      env: { DYLD_LIBRARY_PATH: binDir },
    };

    this.state = {
      status: 'starting',
      backend: this.type,
      port,
      modelPath,
      modelName: modelPath.split('/').pop()?.replace('.gguf', '').replace('.safetensors', '') ?? null,
      pid: null,
      error: null,
      startedAt: null,
    };

    try {
      const resolution = await this.resolveModel(modelPath);

      if (!resolution.ready) {
        throw new Error(
          `Missing required companion files for ${resolution.arch} model: ${resolution.missingRequired.join(', ')}. ` +
          'Download the missing files to the same directory as the model.'
        );
      }

      // Build CLI args based on architecture
      const args: string[] = [];

      if (resolution.companions.length === 0) {
        // Single-file model (sd1, sdxl): use -m
        args.push('-m', modelPath);
      } else {
        // Multi-file model: use per-companion flags
        for (const companion of resolution.companions) {
          if (companion.found && companion.path) {
            args.push(companion.flag, companion.path);
          }
        }
      }

      args.push('--listen-port', String(port));

      // For single-file models whose arch couldn't be detected from the filename,
      // fall back to --diffusion-model if -m fails with a version-detection error.
      try {
        await this.processManager.start(binaryPath, args, startOpts);
      } catch (firstErr) {
        if (resolution.companions.length === 0) {
          const msg = firstErr instanceof Error ? firstErr.message : '';
          if (
            msg.includes('get sd version from file failed') ||
            msg.includes('load tensors from model loader failed') ||
            msg.includes('not in model file')
          ) {
            await this.processManager.start(binaryPath, [
              '--diffusion-model', modelPath,
              '--listen-port', String(port),
            ], startOpts);
          } else {
            throw firstErr;
          }
        } else {
          throw firstErr;
        }
      }

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
    };
  }

  getServerState(): ServerState {
    return { ...this.state };
  }

  getApiEndpoint(): string {
    return `http://localhost:${this.state.port}/v1`;
  }

  getLogs(): string[] {
    return this.processManager.getLogs();
  }

  get events(): ProcessManager {
    return this.processManager;
  }
}
