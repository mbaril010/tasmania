import net from 'node:net';
import path from 'node:path';
import type { AppSettings } from '../../shared/types';

type PartialSettings = Partial<AppSettings>;

const TOP_LEVEL_KEYS = new Set<keyof AppSettings>([
  'modelsDir',
  'autoStart',
  'autoCheckUpdates',
  'llamaCpp',
  'stableDiffusion',
  'comfyui',
  'exo',
  'imageOutput',
  'theme',
]);

function assertBoolean(value: unknown, label: string): asserts value is boolean {
  if (typeof value !== 'boolean') {
    throw new Error(`${label} must be a boolean`);
  }
}

function assertString(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string') {
    throw new Error(`${label} must be a string`);
  }
}

function assertIntegerInRange(value: unknown, min: number, max: number, label: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${label} must be ${min}-${max}`);
  }
}

function assertNumberInRange(value: unknown, min: number, max: number, label: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${label} must be ${min}-${max}`);
  }
}

function normalizeAbsolutePath(value: string, label: string): string {
  if (value.trim().length === 0) {
    throw new Error(`${label} is required`);
  }
  return path.resolve(value);
}

function assertValidHost(value: string): void {
  const host = value.trim();
  if (host.length === 0) {
    throw new Error('Exo host is required');
  }
  if (host.length > 253) {
    throw new Error('Exo host is too long');
  }
  if (net.isIP(host) !== 0) {
    return;
  }
  const hostnameLabel = '[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?';
  const hostnamePattern = new RegExp(`^(?:${hostnameLabel}\\.)*${hostnameLabel}$`);
  if (!hostnamePattern.test(host)) {
    throw new Error('Exo host must be a valid hostname or IP address');
  }
}

export function validateSettingsPartial(input: PartialSettings): PartialSettings {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Settings update must be an object');
  }

  for (const key of Object.keys(input)) {
    if (!TOP_LEVEL_KEYS.has(key as keyof AppSettings)) {
      throw new Error(`Unknown settings key: ${key}`);
    }
  }

  const partial: PartialSettings = { ...input };

  if (partial.modelsDir !== undefined) {
    assertString(partial.modelsDir, 'modelsDir');
    partial.modelsDir = normalizeAbsolutePath(partial.modelsDir, 'modelsDir');
  }

  if (partial.autoStart !== undefined) {
    assertBoolean(partial.autoStart, 'autoStart');
  }

  if (partial.autoCheckUpdates !== undefined) {
    assertBoolean(partial.autoCheckUpdates, 'autoCheckUpdates');
  }

  if (partial.llamaCpp !== undefined) {
    const llama = { ...partial.llamaCpp };
    if (llama.port !== undefined) assertIntegerInRange(llama.port, 1024, 65535, 'llama.cpp port');
    if (llama.contextSize !== undefined) assertIntegerInRange(llama.contextSize, 128, 1_048_576, 'Context size');
    if (llama.gpuLayers !== undefined) assertIntegerInRange(llama.gpuLayers, 0, 999, 'GPU layers');
    partial.llamaCpp = llama as AppSettings['llamaCpp'];
  }

  if (partial.stableDiffusion !== undefined) {
    const sd = { ...partial.stableDiffusion };
    if (sd.port !== undefined) assertIntegerInRange(sd.port, 1024, 65535, 'Stable Diffusion port');
    if (sd.defaultSteps !== undefined) assertIntegerInRange(sd.defaultSteps, 1, 150, 'Default steps');
    if (sd.defaultCfgScale !== undefined) assertNumberInRange(sd.defaultCfgScale, 0, 30, 'Default CFG scale');
    if (sd.defaultWidth !== undefined) assertIntegerInRange(sd.defaultWidth, 64, 2048, 'Default width');
    if (sd.defaultHeight !== undefined) assertIntegerInRange(sd.defaultHeight, 64, 2048, 'Default height');
    partial.stableDiffusion = sd as AppSettings['stableDiffusion'];
  }

  if (partial.comfyui !== undefined) {
    const comfyui = { ...partial.comfyui };
    if (comfyui.mode !== undefined && comfyui.mode !== 'managed' && comfyui.mode !== 'external') {
      throw new Error('ComfyUI mode must be one of: managed, external');
    }
    if (comfyui.path !== undefined) {
      assertString(comfyui.path, 'ComfyUI path');
      if (comfyui.path.trim().length > 0) {
        comfyui.path = path.resolve(comfyui.path);
      }
    }
    if (comfyui.port !== undefined) assertIntegerInRange(comfyui.port, 1024, 65535, 'ComfyUI port');
    if (comfyui.pythonPath !== undefined) {
      assertString(comfyui.pythonPath, 'ComfyUI python path');
      const trimmed = comfyui.pythonPath.trim();
      if (trimmed.length === 0 || trimmed.length > 1024 || /\0/.test(trimmed)) {
        throw new Error('ComfyUI python path is invalid');
      }
      comfyui.pythonPath = trimmed;
    }
    partial.comfyui = comfyui as AppSettings['comfyui'];
  }

  if (partial.exo !== undefined) {
    const exo = { ...partial.exo };
    if (exo.host !== undefined) {
      assertString(exo.host, 'Exo host');
      assertValidHost(exo.host);
      exo.host = exo.host.trim();
    }
    if (exo.port !== undefined) assertIntegerInRange(exo.port, 1, 65535, 'Exo port');
    if (exo.autoConnect !== undefined) assertBoolean(exo.autoConnect, 'Exo autoConnect');
    partial.exo = exo as AppSettings['exo'];
  }

  if (partial.imageOutput !== undefined) {
    const imageOutput = { ...partial.imageOutput };
    if (imageOutput.autoSave !== undefined) assertBoolean(imageOutput.autoSave, 'imageOutput.autoSave');
    if (imageOutput.outputDir !== undefined) {
      assertString(imageOutput.outputDir, 'Image output directory');
      imageOutput.outputDir = normalizeAbsolutePath(imageOutput.outputDir, 'Image output directory');
    }
    partial.imageOutput = imageOutput as AppSettings['imageOutput'];
  }

  if (partial.theme !== undefined && partial.theme !== 'light' && partial.theme !== 'dark' && partial.theme !== 'system') {
    throw new Error('Theme must be one of: light, dark, system');
  }

  return partial;
}
