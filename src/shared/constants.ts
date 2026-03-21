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

export const DEFAULT_CONTEXT_SIZE = 32768;
export const DEFAULT_GPU_LAYERS = 99;

export const SD_DEFAULT_PORT = 1234;
export const SD_DEFAULT_STEPS = 20;
export const SD_DEFAULT_CFG_SCALE = 7.0;
export const SD_DEFAULT_WIDTH = 512;
export const SD_DEFAULT_HEIGHT = 512;

export const COMFYUI_DEFAULT_PORT = 8188;
export const COMFYUI_DEFAULT_PYTHON = 'python3';

export const EXO_DEFAULT_HOST = '127.0.0.1';
export const EXO_DEFAULT_PORT = 52415;

export const DEFAULT_IMAGE_OUTPUT_DIR = path.join(os.homedir(), 'Pictures', APP_NAME);

// Video model storage — ComfyUI model subdirectories hosted by Tasmania
export const VIDEO_MODELS_DIR = path.join(
  os.homedir(),
  'Library',
  'Application Support',
  APP_NAME,
  'models',
  'video'
);

// ComfyUI managed install
export const COMFYUI_INSTALL_DIR = path.join(
  os.homedir(),
  'Library',
  'Application Support',
  APP_NAME,
  'comfyui'
);

export const COMFYUI_GITHUB_TARBALL = 'https://github.com/comfyanonymous/ComfyUI/archive/refs/heads/master.tar.gz';

export const COMFYUI_CUSTOM_NODES: Array<{ name: string; tarball: string; hasRequirements: boolean }> = [
  {
    name: 'ComfyUI-AnimateDiff-Evolved',
    tarball: 'https://github.com/Kosinkadink/ComfyUI-AnimateDiff-Evolved/archive/refs/heads/main.tar.gz',
    hasRequirements: true,
  },
  {
    name: 'ComfyUI-VideoHelperSuite',
    tarball: 'https://github.com/Kosinkadink/ComfyUI-VideoHelperSuite/archive/refs/heads/main.tar.gz',
    hasRequirements: true,
  },
  {
    name: 'ComfyUI-GGUF',
    tarball: 'https://github.com/city96/ComfyUI-GGUF/archive/refs/heads/main.tar.gz',
    hasRequirements: true,
  },
  {
    name: 'ComfyUI-LTXVideo',
    tarball: 'https://github.com/Lightricks/ComfyUI-LTXVideo/archive/refs/heads/master.tar.gz',
    hasRequirements: true,
  },
];

export const HF_API_BASE = 'https://huggingface.co/api';
export const HF_DOWNLOAD_BASE = 'https://huggingface.co';
