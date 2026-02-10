import Store from 'electron-store';
import path from 'node:path';
import os from 'node:os';
import type { AppSettings } from '../../shared/types';
import { LLAMA_CPP_DEFAULT_PORT, DEFAULT_CONTEXT_SIZE, DEFAULT_GPU_LAYERS } from '../../shared/constants';

const DEFAULT_MODELS_DIR = path.join(
  os.homedir(),
  'Library',
  'Application Support',
  'Tasmania',
  'models'
);

const defaults: AppSettings = {
  modelsDir: DEFAULT_MODELS_DIR,
  autoStart: false,
  llamaCpp: {
    port: LLAMA_CPP_DEFAULT_PORT,
    contextSize: DEFAULT_CONTEXT_SIZE,
    gpuLayers: DEFAULT_GPU_LAYERS,
  },
  theme: 'system',
};

const store = new Store<AppSettings>({
  name: 'settings',
  defaults,
});

export function getSettings(): AppSettings {
  return store.store;
}

export function setSettings(partial: Partial<AppSettings>): void {
  for (const [key, value] of Object.entries(partial)) {
    store.set(key, value);
  }
}

export function getModelsDir(): string {
  return store.get('modelsDir', DEFAULT_MODELS_DIR);
}
