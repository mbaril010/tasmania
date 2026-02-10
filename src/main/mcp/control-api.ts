import http from 'node:http';
import { getActiveBackend, setActiveBackend, getBackends } from '../ipc/backend-handlers';
import { getModelService, getHuggingFaceService } from '../ipc/model-handlers';
import { getSettings, getModelsDir } from '../store/AppStore';
import { CONTROL_API_PORT } from '../../shared/constants';
import type { BackendType } from '../../shared/types';

let server: http.Server | null = null;

/**
 * Start the internal HTTP control API on localhost:3999
 * This allows the standalone MCP server to communicate with the Electron app.
 */
export function startControlApi(): void {
  if (server) return;

  server = http.createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json');

    // Only allow local connections
    if (req.socket.remoteAddress !== '127.0.0.1' && req.socket.remoteAddress !== '::1') {
      res.writeHead(403);
      res.end(JSON.stringify({ error: 'Forbidden' }));
      return;
    }

    const url = new URL(req.url ?? '/', `http://localhost:${CONTROL_API_PORT}`);
    const path = url.pathname;

    try {
      // GET /api/status — Server status
      if (path === '/api/status' && req.method === 'GET') {
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
      if (path === '/api/models' && req.method === 'GET') {
        const models = await getModelService().listLocalModels();
        res.end(JSON.stringify(models));
        return;
      }

      // GET /api/logs — Server logs
      if (path === '/api/logs' && req.method === 'GET') {
        const backend = getActiveBackend();
        res.end(JSON.stringify(backend ? backend.getLogs() : []));
        return;
      }

      // POST /api/start — Start a server
      if (path === '/api/start' && req.method === 'POST') {
        const body = await readBody(req);
        const { backend: backendType = 'llama.cpp', modelPath } = body as { backend?: string; modelPath: string };

        if (!modelPath) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'modelPath is required' }));
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
      if (path === '/api/stop' && req.method === 'POST') {
        const active = getActiveBackend();
        if (active) {
          await active.stopServer();
          setActiveBackend(null);
        }
        res.end(JSON.stringify({ success: true }));
        return;
      }

      // POST /api/download — Download a model from HF
      if (path === '/api/download' && req.method === 'POST') {
        const body = await readBody(req);
        const { repo, filename } = body as { repo: string; filename: string };

        if (!repo || !filename) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'repo and filename are required' }));
          return;
        }

        const destDir = getModelsDir();
        // Start download asynchronously
        getHuggingFaceService().downloadModel(repo, filename, destDir).catch(() => {});
        res.end(JSON.stringify({ success: true, message: 'Download started' }));
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
}

function readBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
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
