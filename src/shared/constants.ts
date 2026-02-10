import path from 'node:path';
import os from 'node:os';

export const APP_NAME = 'Tasmania';

export const DEFAULT_MODELS_DIR = path.join(
  os.homedir(),
  'Library',
  'Application Support',
  APP_NAME,
  'models'
);

export const LOGS_DIR = path.join(
  os.homedir(),
  'Library',
  'Logs',
  APP_NAME
);

export const LLAMA_CPP_DEFAULT_PORT = 8080;
export const CONTROL_API_PORT = 3999;

export const DEFAULT_CONTEXT_SIZE = 4096;
export const DEFAULT_GPU_LAYERS = 99;

export const HF_API_BASE = 'https://huggingface.co/api';
export const HF_DOWNLOAD_BASE = 'https://huggingface.co';
