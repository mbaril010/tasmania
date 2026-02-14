import { EventEmitter } from 'node:events';
import { app } from 'electron';
import type { UpdateInfo, UpdateCheckResult } from '../../shared/types';

const GITHUB_API = 'https://api.github.com';
const REPO_OWNER = 'mbaril010';
const REPO_NAME = 'tasmania';

interface GitHubRelease {
  tag_name: string;
  body?: string;
  html_url: string;
  published_at: string;
  assets: Array<{ browser_download_url: string; name: string }>;
}

export class UpdateService extends EventEmitter {
  private latestUpdateInfo: UpdateInfo | null = null;
  private checkInProgress = false;

  async checkForUpdates(): Promise<UpdateCheckResult> {
    if (this.checkInProgress) {
      return { updateAvailable: false, updateInfo: null, error: 'Check already in progress' };
    }

    this.checkInProgress = true;
    const currentVersion = app.getVersion();

    try {
      const res = await fetch(`${GITHUB_API}/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`, {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': `Tasmania/${currentVersion}`,
        },
      });

      if (!res.ok) {
        throw new Error(`GitHub API: ${res.status} ${res.statusText}`);
      }

      const release = (await res.json()) as GitHubRelease;
      const latestVersion = release.tag_name.replace(/^v/, '');
      const isUpdateAvailable = this.compareVersions(currentVersion, latestVersion) < 0;

      const dmgAsset = release.assets.find((a) => a.name.endsWith('.dmg'));
      let downloadUrl = dmgAsset?.browser_download_url ?? release.html_url;

      // Validate download URL points to GitHub (prevent open redirect via compromised release)
      try {
        const parsed = new URL(downloadUrl);
        const isGitHub = parsed.hostname === 'github.com' || parsed.hostname.endsWith('.github.com');
        if (!isGitHub || parsed.protocol !== 'https:') {
          downloadUrl = release.html_url;
        }
      } catch {
        downloadUrl = release.html_url;
      }

      const updateInfo: UpdateInfo = {
        currentVersion,
        latestVersion,
        releaseNotes: release.body ?? '',
        downloadUrl,
        releasedAt: release.published_at,
        isUpdateAvailable,
      };

      this.latestUpdateInfo = updateInfo;

      if (isUpdateAvailable) {
        this.emit('update-available', updateInfo);
      } else {
        this.emit('update-not-available', updateInfo);
      }

      return { updateAvailable: isUpdateAvailable, updateInfo, error: null };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.emit('update-error', msg);
      return { updateAvailable: false, updateInfo: null, error: msg };
    } finally {
      this.checkInProgress = false;
    }
  }

  getLatestUpdateInfo(): UpdateInfo | null {
    return this.latestUpdateInfo;
  }

  /** Returns -1 if a < b, 0 if equal, 1 if a > b */
  private compareVersions(a: string, b: string): number {
    const pa = a.split('.').map(Number);
    const pb = b.split('.').map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const na = pa[i] || 0;
      const nb = pb[i] || 0;
      if (na < nb) return -1;
      if (na > nb) return 1;
    }
    return 0;
  }
}
