import http from 'node:http';
import crypto from 'node:crypto';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { app } from 'electron';
import { getActiveBackend, setActiveBackend, getBackends } from '../ipc/backend-handlers';
import { getExoBackend } from '../ipc/exo-handlers';
import { getModelService, getHuggingFaceService } from '../ipc/model-handlers';
import { assertPathInside } from '../security/path-utils';
import { getSettings, getModelsDir, getChatModelsDir, getImageModelsDir, getVideoModelsDir } from '../store/AppStore';
import { CONTROL_API_PORT } from '../../shared/constants';
import { ModelService } from '../services/ModelService';
import type { BackendType, ModelCategory } from '../../shared/types';

let server: http.Server | null = null;
let apiToken: string | null = null;

// Simple sliding-window rate limiter
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 60;
let requestTimestamps: number[] = [];

function isRateLimited(): boolean {
  const now = Date.now();
  requestTimestamps = requestTimestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (requestTimestamps.length >= RATE_LIMIT_MAX_REQUESTS) return true;
  requestTimestamps.push(now);
  return false;
}

/** Path to the auth token file (readable only by current user) */
function getTokenPath(): string {
  return path.join(app.getPath('userData'), '.control-api-token');
}

/**
 * Start the internal HTTP control API on localhost:3999
 * This allows the standalone MCP server to communicate with the Electron app.
 */
export async function startControlApi(): Promise<void> {
  if (server) return;

  // Generate a one-time auth token and write it to a restricted file
  apiToken = crypto.randomBytes(32).toString('hex');
  const tokenPath = getTokenPath();
  await fsp.writeFile(tokenPath, apiToken, { mode: 0o600 });

  server = http.createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json');

    // Only allow local connections (including IPv4-mapped IPv6)
    const remoteAddr = req.socket.remoteAddress ?? '';
    const isLocalhost =
      remoteAddr === '127.0.0.1' ||
      remoteAddr === '::1' ||
      remoteAddr === '::ffff:127.0.0.1';
    if (!isLocalhost) {
      res.writeHead(403);
      res.end(JSON.stringify({ error: 'Forbidden' }));
      return;
    }

    // Require bearer token authentication
    const authHeader = req.headers.authorization ?? '';
    if (authHeader !== `Bearer ${apiToken}`) {
      res.writeHead(401);
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }

    // Rate limiting
    if (isRateLimited()) {
      res.writeHead(429);
      res.end(JSON.stringify({ error: 'Too many requests' }));
      return;
    }

    const url = new URL(req.url ?? '/', `http://localhost:${CONTROL_API_PORT}`);
    const route = url.pathname;

    try {
      // GET /api/status — Server status
      if (route === '/api/status' && req.method === 'GET') {
        const backend = getActiveBackend();
        if (!backend) {
          res.end(JSON.stringify({ status: 'stopped', endpoint: null }));
          return;
        }
        const state = backend.getServerState();
        res.end(JSON.stringify({
          status: state.status,
          backend: state.backend,
          port: state.port,
          modelName: state.modelName,
          modelPath: state.modelPath,
          endpoint: state.status === 'running' ? backend.getApiEndpoint() : null,
          startedAt: state.startedAt,
        }));
        return;
      }

      // GET /api/models — List local models
      if (route === '/api/models' && req.method === 'GET') {
        const models = await getModelService().listLocalModels();
        res.end(JSON.stringify(models));
        return;
      }

      // GET /api/logs — Server logs
      if (route === '/api/logs' && req.method === 'GET') {
        const backend = getActiveBackend();
        res.end(JSON.stringify(backend ? backend.getLogs() : []));
        return;
      }

      // POST /api/start — Start a server
      if (route === '/api/start' && req.method === 'POST') {
        const body = await readBody(req);
        const { backend: backendType = 'llama.cpp', modelPath } = body as { backend?: string; modelPath: string };

        if (!modelPath) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'modelPath is required' }));
          return;
        }

        // Validate model path is within models directory
        const modelsDir = getModelsDir();
        try {
          assertPathInside(modelsDir, modelPath, 'Model path must be within the models directory');
        } catch {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Model path must be within the models directory' }));
          return;
        }

        const backends = getBackends();
        const backend = backends[backendType as BackendType];
        if (!backend) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: `Unknown backend: ${backendType}` }));
          return;
        }

        // Stop current backend if running
        const active = getActiveBackend();
        if (active) {
          await active.stopServer();
        }

        const settings = getSettings();
        const opts = settings.llamaCpp;

        await backend.startServer(modelPath, opts);
        setActiveBackend(backend);
        res.end(JSON.stringify({ success: true }));
        return;
      }

      // POST /api/stop — Stop the server
      if (route === '/api/stop' && req.method === 'POST') {
        const active = getActiveBackend();
        if (active) {
          await active.stopServer();
          setActiveBackend(null);
        }
        res.end(JSON.stringify({ success: true }));
        return;
      }

      // POST /api/download — Download a model from HF
      if (route === '/api/download' && req.method === 'POST') {
        const body = await readBody(req);
        const { repo, filename, category: rawCategory } = body as { repo: string; filename: string; category?: string };

        if (!repo || !filename) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'repo and filename are required' }));
          return;
        }

        // Validate repo format and filename to prevent path traversal
        if (!/^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.\-]+$/.test(repo)) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Invalid repository format' }));
          return;
        }
        if (!/^[a-zA-Z0-9_.\-]+$/.test(filename)) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Invalid filename' }));
          return;
        }

        const validCategories = new Set<string>(['chat', 'image', 'video']);
        const category: ModelCategory = (rawCategory && validCategories.has(rawCategory))
          ? rawCategory as ModelCategory
          : ModelService.detectCategory(filename);
        const categoryDirs: Record<ModelCategory, string> = {
          chat: getChatModelsDir(),
          image: getImageModelsDir(),
          video: getVideoModelsDir(),
        };
        const destDir = categoryDirs[category];
        // Start download asynchronously
        getHuggingFaceService().downloadModel(repo, filename, destDir).catch(() => {});
        res.end(JSON.stringify({ success: true, message: 'Download started', category }));
        return;
      }

      // GET /api/exo/status — Exo connection state
      if (route === '/api/exo/status' && req.method === 'GET') {
        const exo = getExoBackend();
        res.end(JSON.stringify({
          connected: exo.isConnected(),
          ...exo.getServerState(),
        }));
        return;
      }

      // GET /api/exo/models — List Exo models
      if (route === '/api/exo/models' && req.method === 'GET') {
        const exo = getExoBackend();
        const models = await exo.listModels();
        res.end(JSON.stringify(models));
        return;
      }

      // GET /api/exo/cluster — Cluster state
      if (route === '/api/exo/cluster' && req.method === 'GET') {
        const exo = getExoBackend();
        const cluster = await exo.getClusterState();
        res.end(JSON.stringify(cluster));
        return;
      }

      // POST /api/exo/instance — Create instance
      if (route === '/api/exo/instance' && req.method === 'POST') {
        const body = await readBody(req);
        const { modelId } = body as { modelId: string };
        if (!modelId) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'modelId is required' }));
          return;
        }
        const exo = getExoBackend();
        const instanceId = await exo.createInstance(modelId);
        setActiveBackend(exo);
        res.end(JSON.stringify({ success: true, instanceId }));
        return;
      }

      // DELETE /api/exo/instance — Delete active instance
      if (route === '/api/exo/instance' && req.method === 'DELETE') {
        const exo = getExoBackend();
        await exo.deleteInstance();
        const active = getActiveBackend();
        if (active?.type === 'exo') {
          setActiveBackend(null);
        }
        res.end(JSON.stringify({ success: true }));
        return;
      }

      // 404
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Not found' }));
    } catch (err) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
    }
  });

  server.listen(CONTROL_API_PORT, '127.0.0.1', () => {
    console.log(`[Tasmania] Control API listening on http://127.0.0.1:${CONTROL_API_PORT}`);
  });

  server.on('error', (err) => {
    console.error('[Tasmania] Control API error:', err);
  });
}

export function stopControlApi(): void {
  if (server) {
    server.close();
    server = null;
  }
  // Clean up token file
  apiToken = null;
  fsp.unlink(getTokenPath()).catch(() => {});
}

const MAX_BODY_SIZE = 1024 * 1024; // 1 MB

function readBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let data = '';
    let size = 0;
    req.on('data', (chunk: Buffer | string) => {
      size += typeof chunk === 'string' ? chunk.length : chunk.byteLength;
      if (size > MAX_BODY_SIZE) {
        req.destroy();
        reject(new Error('Request body too large'));
        return;
      }
      data += chunk;
    });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}
