import { EventEmitter } from 'node:events';
import { spawn, execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { createGunzip } from 'node:zlib';
import { extract as tarExtract } from 'tar';
import {
  COMFYUI_INSTALL_DIR,
  COMFYUI_GITHUB_TARBALL,
  COMFYUI_CUSTOM_NODES,
} from '../../shared/constants';
import type {
  ComfyUIInstallProgress,
  ComfyUIInstallInfo,
  ComfyUIInstallStep,
} from '../../shared/types';

const INSTALL_STEPS: ComfyUIInstallStep[] = [
  'checking-python',
  'downloading-comfyui',
  'extracting',
  'creating-venv',
  'installing-pytorch',
  'installing-requirements',
  'installing-custom-nodes',
  'verifying',
  'done',
];

interface InstallMarker {
  version: string;
  arch: string;
  installedAt: string;
}

export class ComfyUIInstaller extends EventEmitter {
  private installDir = COMFYUI_INSTALL_DIR;
  private abortController: AbortController | null = null;
  private installing = false;

  private get comfyuiDir(): string {
    return path.join(this.installDir, 'ComfyUI');
  }

  private get venvDir(): string {
    return path.join(this.installDir, 'venv');
  }

  private get venvPython(): string {
    return path.join(this.venvDir, 'bin', 'python3');
  }

  private get markerPath(): string {
    return path.join(this.installDir, '.install-complete');
  }

  async getInstallInfo(mode: 'managed' | 'external' = 'managed'): Promise<ComfyUIInstallInfo> {
    if (mode === 'external') {
      return { installed: false, installPath: null, pythonPath: null, version: null, mode };
    }

    try {
      const raw = await fs.readFile(this.markerPath, 'utf-8');
      const marker = JSON.parse(raw) as InstallMarker;
      return {
        installed: true,
        installPath: this.comfyuiDir,
        pythonPath: this.venvPython,
        version: marker.version,
        mode,
      };
    } catch {
      return { installed: false, installPath: null, pythonPath: null, version: null, mode };
    }
  }

  async checkPython(): Promise<{ available: boolean; path: string; version: string }> {
    try {
      const result = await this.exec('which', ['python3']);
      const pythonPath = result.stdout.trim();
      const versionResult = await this.exec(pythonPath, ['--version']);
      const version = versionResult.stdout.trim() || versionResult.stderr.trim();
      return { available: true, path: pythonPath, version };
    } catch {
      return { available: false, path: '', version: '' };
    }
  }

  getManagedPaths(): { comfyuiPath: string; pythonPath: string } {
    return { comfyuiPath: this.comfyuiDir, pythonPath: this.venvPython };
  }

  async install(): Promise<void> {
    if (this.installing) throw new Error('Installation already in progress');
    this.installing = true;
    this.abortController = new AbortController();

    try {
      // Step 1: Check Python
      this.emitProgress('checking-python', 'Checking for Python 3...');
      const python = await this.checkPython();
      if (!python.available) {
        throw new Error('Python 3 not found. Install Xcode Command Line Tools: xcode-select --install');
      }
      this.checkAborted();
      this.emitProgress('checking-python', `Found ${python.version} at ${python.path}`, 100);

      // Step 2: Download ComfyUI
      this.emitProgress('downloading-comfyui', 'Downloading ComfyUI...');
      await fs.mkdir(this.installDir, { recursive: true });
      const tarballPath = path.join(this.installDir, 'comfyui.tar.gz');
      await this.downloadFile(COMFYUI_GITHUB_TARBALL, tarballPath);
      this.checkAborted();
      this.emitProgress('downloading-comfyui', 'Download complete', 100);

      // Step 3: Extract
      this.emitProgress('extracting', 'Extracting ComfyUI...');
      // Remove old ComfyUI dir if exists (partial install cleanup)
      await fs.rm(this.comfyuiDir, { recursive: true, force: true });
      await tarExtract({ file: tarballPath, cwd: this.installDir, strip: 1 });
      // tar extracts to ComfyUI-master, rename to ComfyUI
      const extractedDir = path.join(this.installDir, 'ComfyUI-master');
      try {
        await fs.access(extractedDir);
        await fs.rename(extractedDir, this.comfyuiDir);
      } catch {
        // If strip:1 extracted directly or different naming, check if ComfyUI dir exists
        // The tarball root is "ComfyUI-master/" — with strip:1 it extracts contents directly
        // So files go into installDir directly. We need to handle this differently.
      }

      // If strip:1 put files directly in installDir, check if main.py is there
      const mainPyDirect = path.join(this.installDir, 'main.py');
      const mainPyInDir = path.join(this.comfyuiDir, 'main.py');
      try {
        await fs.access(mainPyInDir);
        // Already in the right place
      } catch {
        try {
          await fs.access(mainPyDirect);
          // Files extracted to installDir directly due to strip:1 — we need to restructure
          // Re-extract without strip into a temp dir
          await fs.rm(mainPyDirect, { force: true });
          // Clean up and re-extract properly
          await this.reExtractComfyUI(tarballPath);
        } catch {
          // Try without strip
          await this.reExtractComfyUI(tarballPath);
        }
      }

      await fs.rm(tarballPath, { force: true });
      this.checkAborted();
      this.emitProgress('extracting', 'Extraction complete', 100);

      // Step 4: Create venv
      this.emitProgress('creating-venv', 'Creating Python virtual environment...');
      await fs.rm(this.venvDir, { recursive: true, force: true });
      await this.execLogged(python.path, ['-m', 'venv', this.venvDir]);
      this.checkAborted();
      this.emitProgress('creating-venv', 'Virtual environment created', 100);

      // Step 5: Install PyTorch (biggest step)
      this.emitProgress('installing-pytorch', 'Installing PyTorch (this may take a while)...');
      await this.pipInstall(['torch', 'torchvision', 'torchaudio']);
      this.checkAborted();
      this.emitProgress('installing-pytorch', 'PyTorch installed', 100);

      // Step 6: Install ComfyUI requirements
      this.emitProgress('installing-requirements', 'Installing ComfyUI requirements...');
      const requirementsFile = path.join(this.comfyuiDir, 'requirements.txt');
      await this.execLogged(this.venvPython, ['-m', 'pip', 'install', '-r', requirementsFile]);
      this.checkAborted();
      this.emitProgress('installing-requirements', 'Requirements installed', 100);

      // Step 7: Install custom nodes
      this.emitProgress('installing-custom-nodes', 'Installing custom nodes...');
      const customNodesDir = path.join(this.comfyuiDir, 'custom_nodes');
      await fs.mkdir(customNodesDir, { recursive: true });

      for (let i = 0; i < COMFYUI_CUSTOM_NODES.length; i++) {
        const node = COMFYUI_CUSTOM_NODES[i];
        this.checkAborted();
        const progress = Math.round(((i + 0.5) / COMFYUI_CUSTOM_NODES.length) * 100);
        this.emitProgress('installing-custom-nodes', `Installing ${node.name}...`, progress);

        const nodeTarball = path.join(this.installDir, `${node.name}.tar.gz`);
        await this.downloadFile(node.tarball, nodeTarball);

        const nodeDir = path.join(customNodesDir, node.name);
        await fs.rm(nodeDir, { recursive: true, force: true });
        await fs.mkdir(nodeDir, { recursive: true });

        await tarExtract({ file: nodeTarball, cwd: nodeDir, strip: 1 });
        await fs.rm(nodeTarball, { force: true });

        if (node.hasRequirements) {
          const reqFile = path.join(nodeDir, 'requirements.txt');
          try {
            await fs.access(reqFile);
            await this.execLogged(this.venvPython, ['-m', 'pip', 'install', '-r', reqFile]);
          } catch {
            // No requirements.txt or install failed — non-fatal
          }
        }
      }
      this.emitProgress('installing-custom-nodes', 'Custom nodes installed', 100);

      // Step 8: Verify
      this.emitProgress('verifying', 'Verifying installation...');
      const verifyResult = await this.exec(this.venvPython, [
        path.join(this.comfyuiDir, 'main.py'), '--help',
      ]);
      if (!verifyResult.stdout.includes('ComfyUI') && !verifyResult.stderr.includes('ComfyUI')) {
        // Non-fatal: --help might not output "ComfyUI" but as long as it doesn't crash
        console.log('[ComfyUI Installer] Verify output:', verifyResult.stdout.slice(0, 200));
      }

      // Write install marker
      const marker: InstallMarker = {
        version: new Date().toISOString().split('T')[0],
        arch: process.arch,
        installedAt: new Date().toISOString(),
      };
      await fs.writeFile(this.markerPath, JSON.stringify(marker, null, 2));

      this.emitProgress('done', 'Installation complete!', 100);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.emitError(message);
      throw err;
    } finally {
      this.installing = false;
      this.abortController = null;
    }
  }

  cancel(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  async uninstall(): Promise<void> {
    if (this.installing) throw new Error('Cannot uninstall while installation is in progress');
    await fs.rm(this.installDir, { recursive: true, force: true });
  }

  // ── Private helpers ──

  private async reExtractComfyUI(tarballPath: string): Promise<void> {
    // Extract without strip, then rename the top-level directory
    const tempDir = path.join(this.installDir, '_extract_temp');
    await fs.rm(tempDir, { recursive: true, force: true });
    await fs.mkdir(tempDir, { recursive: true });
    await tarExtract({ file: tarballPath, cwd: tempDir });

    // Find the extracted directory (should be ComfyUI-master or similar)
    const entries = await fs.readdir(tempDir);
    const extractedName = entries.find((e) => e.startsWith('ComfyUI'));
    if (!extractedName) {
      throw new Error('Failed to find ComfyUI directory in archive');
    }

    await fs.rm(this.comfyuiDir, { recursive: true, force: true });
    await fs.rename(path.join(tempDir, extractedName), this.comfyuiDir);
    await fs.rm(tempDir, { recursive: true, force: true });
  }

  private checkAborted(): void {
    if (this.abortController?.signal.aborted) {
      throw new Error('Installation cancelled');
    }
  }

  private emitProgress(step: ComfyUIInstallStep, message: string, stepProgress = 0): void {
    const stepIndex = INSTALL_STEPS.indexOf(step);
    const progress: ComfyUIInstallProgress = {
      status: step === 'done' ? 'installed' : 'installing',
      step,
      stepIndex,
      totalSteps: INSTALL_STEPS.length,
      stepProgress,
      message,
      error: null,
    };
    this.emit('progress', progress);
  }

  private emitError(error: string): void {
    const progress: ComfyUIInstallProgress = {
      status: 'error',
      step: null,
      stepIndex: 0,
      totalSteps: INSTALL_STEPS.length,
      stepProgress: 0,
      message: error,
      error,
    };
    this.emit('progress', progress);
  }

  private async downloadFile(url: string, destPath: string): Promise<void> {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: this.abortController?.signal,
    });
    if (!response.ok) {
      throw new Error(`Download failed: ${response.status} ${response.statusText}`);
    }
    if (!response.body) {
      throw new Error('No response body');
    }

    const fileStream = createWriteStream(destPath);
    // @ts-expect-error Node fetch body is a ReadableStream
    await pipeline(response.body, fileStream);
  }

  private async pipInstall(packages: string[]): Promise<void> {
    await this.execLogged(this.venvPython, ['-m', 'pip', 'install', ...packages]);
  }

  private async execLogged(command: string, args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = spawn(command, args, {
        signal: this.abortController?.signal ?? undefined,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      proc.stdout?.on('data', (data: Buffer) => {
        const line = data.toString().trim();
        if (line) this.emit('log', line);
      });

      proc.stderr?.on('data', (data: Buffer) => {
        const line = data.toString().trim();
        if (line) this.emit('log', line);
      });

      proc.on('error', (err) => {
        if (err.name === 'AbortError') {
          reject(new Error('Installation cancelled'));
        } else {
          reject(err);
        }
      });

      proc.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Command failed with exit code ${code}: ${command} ${args.join(' ')}`));
      });
    });
  }

  private exec(command: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      execFile(command, args, { timeout: 30_000 }, (err, stdout, stderr) => {
        if (err) reject(err);
        else resolve({ stdout, stderr });
      });
    });
  }
}
