import fsp from 'node:fs/promises';
import path from 'node:path';
import { getModelsDir } from '../store/AppStore';
import type { LocalModel } from '../../shared/types';

/**
 * Manages locally stored GGUF models — listing, deletion, metadata parsing.
 */
export class ModelService {
  /** Ensure the models directory exists */
  async ensureModelsDir(): Promise<string> {
    const dir = getModelsDir();
    await fsp.mkdir(dir, { recursive: true });
    return dir;
  }

  /** List all locally downloaded GGUF models */
  async listLocalModels(): Promise<LocalModel[]> {
    const modelsDir = await this.ensureModelsDir();
    const models: LocalModel[] = [];

    try {
      const repoDirs = await fsp.readdir(modelsDir);

      for (const repoDir of repoDirs) {
        const repoDirPath = path.join(modelsDir, repoDir);
        const stat = await fsp.stat(repoDirPath);
        if (!stat.isDirectory()) continue;

        const files = await fsp.readdir(repoDirPath);
        for (const file of files) {
          if (!file.endsWith('.gguf')) continue;

          const filePath = path.join(repoDirPath, file);
          const fileStat = await fsp.stat(filePath);

          // Parse quantization from filename (e.g., Q4_K_M, Q5_K_S, Q8_0)
          const quantMatch = file.match(/[.-](Q\d[_A-Z0-9]*)/i);
          // Parse parameter count from filename (e.g., 3B, 7B, 13B)
          const paramMatch = file.match(/(\d+\.?\d*)[Bb]/);

          models.push({
            name: file.replace('.gguf', '').replace(/-/g, ' '),
            filename: file,
            path: filePath,
            sizeBytes: fileStat.size,
            repo: repoDir.replace('__', '/'),
            quantization: quantMatch?.[1] ?? null,
            parameters: paramMatch ? `${paramMatch[1]}B` : null,
            architecture: null,
            addedAt: fileStat.mtimeMs,
          });
        }
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
