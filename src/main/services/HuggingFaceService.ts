import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { HF_API_BASE, HF_DOWNLOAD_BASE } from '../../shared/constants';
import type { HuggingFaceModel, HuggingFaceFile, DownloadProgress } from '../../shared/types';

/**
 * Pure Node.js HuggingFace integration — no Python dependency.
 * Uses the HuggingFace HTTP API directly for model search, file listing, and downloads.
 */
export class HuggingFaceService extends EventEmitter {
  private activeDownloads = new Map<string, AbortController>();
  private static readonly MAX_CONCURRENT_DOWNLOADS = 3;

  /** Search for models on HuggingFace */
  async searchModels(query: string, limit = 30): Promise<HuggingFaceModel[]> {
    const url = `${HF_API_BASE}/models?` + new URLSearchParams({
      search: query,
      sort: 'downloads',
      direction: '-1',
      limit: String(limit),
    });

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HuggingFace API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as Array<{
      id: string;
      modelId?: string;
      author?: string;
      downloads?: number;
      likes?: number;
      tags?: string[];
      lastModified?: string;
    }>;

    return data.map((item) => ({
      id: item.id ?? item.modelId ?? '',
      name: (item.id ?? '').split('/').pop() ?? '',
      author: item.author ?? (item.id ?? '').split('/')[0] ?? '',
      downloads: item.downloads ?? 0,
      likes: item.likes ?? 0,
      tags: item.tags ?? [],
      lastModified: item.lastModified ?? '',
    }));
  }

  /** List files in a HuggingFace repository, sorted by size descending */
  async listModelFiles(repo: string): Promise<HuggingFaceFile[]> {
    const url = `${HF_API_BASE}/models/${repo}/tree/main?recursive=true`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to list files for ${repo}: ${response.status}`);
    }

    const files = await response.json() as Array<{
      rfilename?: string;
      path?: string;
      size?: number;
      type?: string;
    }>;

    return files
      .filter((f) => f.type !== 'directory')
      .map((f) => ({
        filename: f.rfilename ?? f.path ?? '',
        sizeBytes: f.size ?? 0,
        repo,
      }))
      .sort((a, b) => b.sizeBytes - a.sizeBytes);
  }

  /**
   * Download a model file from HuggingFace.
   * Emits 'progress' events with DownloadProgress updates.
   * Returns the local file path on success.
   */
  async downloadModel(
    repo: string,
    filename: string,
    destDir: string
  ): Promise<string> {
    // Enforce concurrent download limit
    if (this.activeDownloads.size >= HuggingFaceService.MAX_CONCURRENT_DOWNLOADS) {
      throw new Error(`Maximum ${HuggingFaceService.MAX_CONCURRENT_DOWNLOADS} concurrent downloads allowed`);
    }

    // Validate repo format: owner/name, alphanumeric + hyphens/underscores/dots
    if (!/^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.\-]+$/.test(repo)) {
      throw new Error('Invalid repository name');
    }
    // Validate filename: no path separators or traversal
    if (!/^[a-zA-Z0-9_.\-]+$/.test(filename)) {
      throw new Error('Invalid filename');
    }

    const downloadId = `${repo}/${filename}`;
    const url = `${HF_DOWNLOAD_BASE}/${repo}/resolve/main/${filename}`;
    const repoDir = path.join(destDir, repo.replace('/', '__'));
    const destPath = path.join(repoDir, filename);

    // Final safety check: resolved path must stay within destDir
    if (!path.resolve(destPath).startsWith(path.resolve(destDir))) {
      throw new Error('Invalid download path');
    }

    await fsp.mkdir(path.dirname(destPath), { recursive: true });

    // Check for partial download to resume
    let startByte = 0;
    try {
      const stat = await fsp.stat(destPath + '.partial');
      startByte = stat.size;
    } catch {
      // no partial file
    }

    const controller = new AbortController();
    this.activeDownloads.set(downloadId, controller);

    const headers: Record<string, string> = {};
    if (startByte > 0) {
      headers['Range'] = `bytes=${startByte}-`;
    }

    const progress: DownloadProgress = {
      id: downloadId,
      repo,
      filename,
      totalBytes: 0,
      downloadedBytes: startByte,
      speedBps: 0,
      status: 'downloading',
      error: null,
    };

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers,
      });

      if (!response.ok && response.status !== 206) {
        throw new Error(`Download failed: ${response.status} ${response.statusText}`);
      }

      const contentLength = response.headers.get('content-length');
      const totalSize = contentLength ? parseInt(contentLength, 10) + startByte : 0;
      progress.totalBytes = totalSize;

      const body = response.body;
      if (!body) throw new Error('No response body');

      const fileStream = fs.createWriteStream(destPath + '.partial', {
        flags: startByte > 0 ? 'a' : 'w',
      });

      const reader = body.getReader();
      let lastTime = Date.now();
      let lastBytes = startByte;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        fileStream.write(Buffer.from(value));
        progress.downloadedBytes += value.length;

        // Calculate speed every 500ms
        const now = Date.now();
        const elapsed = now - lastTime;
        if (elapsed >= 500) {
          progress.speedBps = Math.round(((progress.downloadedBytes - lastBytes) / elapsed) * 1000);
          lastTime = now;
          lastBytes = progress.downloadedBytes;
          this.emit('progress', { ...progress });
        }
      }

      fileStream.end();
      await new Promise<void>((resolve, reject) => {
        fileStream.on('finish', resolve);
        fileStream.on('error', reject);
      });

      // Rename from .partial to final name
      await fsp.rename(destPath + '.partial', destPath);

      progress.status = 'completed';
      progress.downloadedBytes = progress.totalBytes;
      this.emit('progress', { ...progress });
      this.activeDownloads.delete(downloadId);

      return destPath;
    } catch (err) {
      if (controller.signal.aborted) {
        progress.status = 'cancelled';
      } else {
        progress.status = 'error';
        progress.error = err instanceof Error ? err.message : String(err);
      }
      this.emit('progress', { ...progress });
      this.activeDownloads.delete(downloadId);
      throw err;
    }
  }

  /** Cancel an active download */
  cancelDownload(downloadId: string): void {
    const controller = this.activeDownloads.get(downloadId);
    if (controller) {
      controller.abort();
      this.activeDownloads.delete(downloadId);
    }
  }
}
