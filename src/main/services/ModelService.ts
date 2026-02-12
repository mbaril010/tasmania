import fsp from 'node:fs/promises';
import path from 'node:path';
import { getModelsDir } from '../store/AppStore';
import type { LocalModel } from '../../shared/types';

/**
 * Manages locally stored models — listing, deletion, metadata parsing.
 */
export class ModelService {
  /** Ensure the models directory exists */
  async ensureModelsDir(): Promise<string> {
    const dir = getModelsDir();
    await fsp.mkdir(dir, { recursive: true });
    return dir;
  }

  /** List all locally downloaded models */
  async listLocalModels(): Promise<LocalModel[]> {
    const modelsDir = await this.ensureModelsDir();
    const models: LocalModel[] = [];

    const MODEL_EXTENSIONS = ['.gguf', '.safetensors', '.bin', '.pt', '.pth', '.onnx', '.ggml'];
    const SKIP_FILES = new Set(['tokenizer.model']);

    const scanDir = async (dir: string, repo: string) => {
      const entries = await fsp.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const entryPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await scanDir(entryPath, repo);
          continue;
        }
        if (SKIP_FILES.has(entry.name)) continue;
        const ext = MODEL_EXTENSIONS.find((e) => entry.name.endsWith(e));
        if (!ext) continue;

        const fileStat = await fsp.stat(entryPath);

        // Parse quantization from filename (e.g., Q4_K_M, Q5_K_S, Q8_0)
        const quantMatch = entry.name.match(/[.-](Q\d[_A-Z0-9]*)/i);
        // Parse parameter count from filename (e.g., 3B, 7B, 13B)
        const paramMatch = entry.name.match(/(\d+\.?\d*)[Bb]/);

        models.push({
          name: entry.name.replace(ext, '').replace(/-/g, ' '),
          filename: entry.name,
          path: entryPath,
          sizeBytes: fileStat.size,
          repo,
          quantization: quantMatch?.[1] ?? null,
          parameters: paramMatch ? `${paramMatch[1]}B` : null,
          architecture: null,
          addedAt: fileStat.mtimeMs,
        });
      }
    };

    try {
      const repoDirs = await fsp.readdir(modelsDir);

      for (const repoDir of repoDirs) {
        const repoDirPath = path.join(modelsDir, repoDir);
        const stat = await fsp.stat(repoDirPath);
        if (!stat.isDirectory()) continue;

        await scanDir(repoDirPath, repoDir.replace('__', '/'));
      }
    } catch (err) {
      // Directory might not exist yet or be empty
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw err;
      }
    }

    // Sort by most recently added
    return models.sort((a, b) => b.addedAt - a.addedAt);
  }

  /** Delete a model file from disk */
  async deleteModel(modelPath: string): Promise<void> {
    const modelsDir = getModelsDir();

    // Safety: only delete files within the models directory
    const resolved = path.resolve(modelPath);
    if (!resolved.startsWith(path.resolve(modelsDir))) {
      throw new Error('Cannot delete files outside the models directory');
    }

    await fsp.unlink(resolved);

    // Clean up empty parent directory
    const parentDir = path.dirname(resolved);
    try {
      const remaining = await fsp.readdir(parentDir);
      if (remaining.length === 0) {
        await fsp.rmdir(parentDir);
      }
    } catch {
      // ignore cleanup errors
    }
  }

  /** Get available disk space at the models directory location */
  async getDiskSpace(): Promise<{ free: number; total: number }> {
    const modelsDir = await this.ensureModelsDir();
    // Use statfs (Node 18.15+)
    try {
      const stats = await fsp.statfs(modelsDir);
      return {
        free: stats.bfree * stats.bsize,
        total: stats.blocks * stats.bsize,
      };
    } catch {
      return { free: 0, total: 0 };
    }
  }
}
