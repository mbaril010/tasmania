import fsp from 'node:fs/promises';
import path from 'node:path';
import { assertPathInside } from '../security/path-utils';
import { getModelsDir, getChatModelsDir, getImageModelsDir, getVideoModelsDir } from '../store/AppStore';
import type { LocalModel, ModelCategory } from '../../shared/types';

const IMAGE_MODEL_PATTERN = /(?:^|[_\-.\s])(sd|sdxl|flux|diffusion|stable.?diffusion|turbo|lora|z[_\-.]?image)(?=[\d_\-.\s]|$)/i;

const MIGRATION_SENTINEL = '.migrated';

/**
 * Manages locally stored models — listing, deletion, metadata parsing.
 */
export class ModelService {
  /** Ensure the models directory and subdirectories exist */
  async ensureModelsDir(): Promise<string> {
    const dir = getModelsDir();
    await fsp.mkdir(path.join(dir, 'chat'), { recursive: true });
    await fsp.mkdir(path.join(dir, 'image'), { recursive: true });
    await fsp.mkdir(path.join(dir, 'video'), { recursive: true });
    return dir;
  }

  /** Detect model category from filename */
  static detectCategory(filename: string): ModelCategory {
    if (IMAGE_MODEL_PATTERN.test(filename)) return 'image';
    return 'chat';
  }

  /** List all locally downloaded models across all category subdirectories */
  async listLocalModels(): Promise<LocalModel[]> {
    await this.ensureModelsDir();
    const models: LocalModel[] = [];

    const categories: ModelCategory[] = ['chat', 'image', 'video'];
    const categoryDirs: Record<ModelCategory, string> = {
      chat: getChatModelsDir(),
      image: getImageModelsDir(),
      video: getVideoModelsDir(),
    };

    const MODEL_EXTENSIONS = ['.gguf', '.safetensors', '.bin', '.pt', '.pth', '.onnx', '.ggml'];
    const SKIP_FILES = new Set(['tokenizer.model']);

    const scanDir = async (dir: string, repo: string, category: ModelCategory) => {
      const entries = await fsp.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const entryPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await scanDir(entryPath, repo, category);
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
          category,
        });
      }
    };

    for (const category of categories) {
      const categoryDir = categoryDirs[category];
      try {
        const repoDirs = await fsp.readdir(categoryDir);
        for (const repoDir of repoDirs) {
          const repoDirPath = path.join(categoryDir, repoDir);
          const stat = await fsp.stat(repoDirPath);
          if (!stat.isDirectory()) continue;
          await scanDir(repoDirPath, repoDir.replace('__', '/'), category);
        }
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw err;
        }
      }
    }

    // Sort by most recently added
    return models.sort((a, b) => b.addedAt - a.addedAt);
  }

  /** Delete a model file from disk */
  async deleteModel(modelPath: string): Promise<void> {
    const modelsDir = getModelsDir();

    // Safety: only delete files within the models directory
    const resolved = assertPathInside(
      modelsDir,
      modelPath,
      'Cannot delete files outside the models directory',
    );

    await fsp.unlink(resolved);

    // Clean up empty parent directory (but don't remove category dirs)
    const parentDir = path.dirname(resolved);
    const categoryDirs = new Set([getChatModelsDir(), getImageModelsDir(), getVideoModelsDir()]);
    if (!categoryDirs.has(parentDir)) {
      try {
        const remaining = await fsp.readdir(parentDir);
        if (remaining.length === 0) {
          await fsp.rmdir(parentDir);
        }
      } catch {
        // ignore cleanup errors
      }
    }
  }

  /**
   * Migrate models from flat models/ directory into category subdirectories.
   * Runs once on first startup after the update, then writes a sentinel file.
   */
  async migrateModelsDir(): Promise<void> {
    const modelsDir = getModelsDir();
    const sentinelPath = path.join(modelsDir, MIGRATION_SENTINEL);

    // Check if migration already done
    try {
      await fsp.access(sentinelPath);
      return; // sentinel exists, skip migration
    } catch {
      // sentinel doesn't exist, proceed with migration
    }

    // Ensure subdirectories exist
    await this.ensureModelsDir();

    const CATEGORY_DIRS = new Set(['chat', 'image', 'video']);

    try {
      const entries = await fsp.readdir(modelsDir, { withFileTypes: true });

      for (const entry of entries) {
        // Skip the category subdirectories themselves and the sentinel file
        if (CATEGORY_DIRS.has(entry.name) || entry.name === MIGRATION_SENTINEL) continue;
        // Skip non-directories (loose files in models root)
        if (!entry.isDirectory()) continue;

        const repoDirPath = path.join(modelsDir, entry.name);

        // Scan files in this repo dir to determine category
        const categories = await this.detectRepoCategory(repoDirPath);

        if (categories.size === 0) {
          // No model files found, skip
          continue;
        }

        if (categories.size === 1) {
          // All files map to the same category — move entire directory
          const category = [...categories][0];
          const destPath = path.join(modelsDir, category, entry.name);
          try {
            await fsp.rename(repoDirPath, destPath);
            console.log(`[Migration] Moved ${entry.name} → ${category}/`);
          } catch (err) {
            console.error(`[Migration] Failed to move ${entry.name}:`, err);
          }
        } else {
          // Mixed categories — move files individually
          await this.migrateMixedRepo(repoDirPath, entry.name, modelsDir);
        }
      }
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error('[Migration] Error scanning models directory:', err);
      }
    }

    // Write sentinel to avoid re-running
    try {
      await fsp.writeFile(sentinelPath, new Date().toISOString());
      console.log('[Migration] Models directory migration complete');
    } catch (err) {
      console.error('[Migration] Failed to write sentinel:', err);
    }
  }

  /** Detect category for all model files in a directory */
  private async detectRepoCategory(dirPath: string): Promise<Set<ModelCategory>> {
    const MODEL_EXTENSIONS = ['.gguf', '.safetensors', '.bin', '.pt', '.pth', '.onnx', '.ggml'];
    const categories = new Set<ModelCategory>();

    const scan = async (dir: string) => {
      const entries = await fsp.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          await scan(path.join(dir, entry.name));
          continue;
        }
        if (MODEL_EXTENSIONS.some((ext) => entry.name.endsWith(ext))) {
          categories.add(ModelService.detectCategory(entry.name));
        }
      }
    };

    await scan(dirPath);
    return categories;
  }

  /** Move files from a mixed-category repo into appropriate subdirectories */
  private async migrateMixedRepo(repoDirPath: string, repoName: string, modelsDir: string): Promise<void> {
    const MODEL_EXTENSIONS = ['.gguf', '.safetensors', '.bin', '.pt', '.pth', '.onnx', '.ggml'];
    const entries = await fsp.readdir(repoDirPath, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) continue;
      const ext = MODEL_EXTENSIONS.find((e) => entry.name.endsWith(e));
      if (!ext) continue;

      const category = ModelService.detectCategory(entry.name);
      const destDir = path.join(modelsDir, category, repoName);
      await fsp.mkdir(destDir, { recursive: true });

      const srcPath = path.join(repoDirPath, entry.name);
      const destPath = path.join(destDir, entry.name);
      try {
        await fsp.rename(srcPath, destPath);
        console.log(`[Migration] Moved ${repoName}/${entry.name} → ${category}/`);
      } catch (err) {
        console.error(`[Migration] Failed to move ${repoName}/${entry.name}:`, err);
      }
    }

    // Clean up source directory if empty
    try {
      const remaining = await fsp.readdir(repoDirPath);
      if (remaining.length === 0) {
        await fsp.rmdir(repoDirPath);
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
