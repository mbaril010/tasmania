import { EventEmitter } from 'node:events';
import { BackendService } from './BackendService';
import { EXO_DEFAULT_HOST, EXO_DEFAULT_PORT } from '../../shared/constants';
import type { BackendInfo, ExoClusterNode, ExoClusterState, ExoModel, ServerOptions, ServerState } from '../../shared/types';

const MAX_LOG_LINES = 500;
const SSE_RECONNECT_DELAY_MS = 3_000;

export class ExoBackend extends BackendService {
  readonly type = 'exo' as const;

  private host = EXO_DEFAULT_HOST;
  private port = EXO_DEFAULT_PORT;
  private connected = false;
  private logs: string[] = [];
  private clusterState: ExoClusterState | null = null;
  private activeInstanceId: string | null = null;
  private activeModelName: string | null = null;
  private sseController: AbortController | null = null;

  readonly events = new EventEmitter();

  // ── Configuration ──

  configure(host: string, port: number): void {
    this.host = host;
    this.port = port;
  }

  private baseUrl(): string {
    return `http://${this.host}:${this.port}`;
  }

  // ── Connection lifecycle ──

  async connect(): Promise<void> {
    this.log(`Connecting to Exo at ${this.baseUrl()}...`);
    const reachable = await this.probe();
    if (!reachable) {
      this.connected = false;
      this.events.emit('status-changed');
      throw new Error(`Exo not reachable at ${this.baseUrl()}`);
    }
    this.connected = true;
    this.log('Connected to Exo cluster');
    await this.refreshClusterState();
    this.startSSE();
    this.events.emit('status-changed');
  }

  async disconnect(): Promise<void> {
    this.stopSSE();
    this.connected = false;
    this.clusterState = null;
    this.activeInstanceId = null;
    this.activeModelName = null;
    this.log('Disconnected from Exo cluster');
    this.events.emit('status-changed');
  }

  isConnected(): boolean {
    return this.connected;
  }

  // ── BackendService abstract implementations ──

  async detect(): Promise<BackendInfo> {
    const reachable = await this.probe();
    return {
      type: this.type,
      installed: reachable,
      executablePath: null,
      version: reachable ? 'external' : null,
    };
  }

  /**
   * "Starting a server" for Exo means creating a model instance on the cluster.
   * modelPath is actually the model ID for Exo.
   */
  async startServer(modelId: string, _options: ServerOptions): Promise<void> {
    if (!this.connected) {
      throw new Error('Exo is not connected');
    }

    this.log(`Creating instance for model: ${modelId}`);

    // Create instance
    const resp = await this.fetchExo('/instance', {
      method: 'POST',
      body: JSON.stringify({ model_id: modelId }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Failed to create instance: ${resp.status} ${text}`);
    }

    const data = await resp.json() as { instance_id: string };
    this.activeInstanceId = data.instance_id;

    // Place instance (trigger scheduling)
    const placeResp = await this.fetchExo(`/instance/${this.activeInstanceId}/place`, {
      method: 'POST',
    });
    if (!placeResp.ok) {
      this.log(`Warning: place_instance returned ${placeResp.status}`);
    }

    // Poll until running (max 60s)
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
      const statusResp = await this.fetchExo(`/instance/${this.activeInstanceId}`);
      if (statusResp.ok) {
        const info = await statusResp.json() as { status: string };
        if (info.status === 'running') {
          this.activeModelName = modelId;
          this.log(`Instance ${this.activeInstanceId} is running`);
          this.events.emit('status-changed');
          return;
        }
        if (info.status === 'failed' || info.status === 'error') {
          this.activeInstanceId = null;
          throw new Error(`Instance failed to start: ${info.status}`);
        }
      }
      await sleep(1_000);
    }

    // Timeout
    this.activeInstanceId = null;
    throw new Error('Instance did not become ready within 60 seconds');
  }

  async stopServer(): Promise<void> {
    if (this.activeInstanceId) {
      this.log(`Deleting instance ${this.activeInstanceId}`);
      try {
        await this.fetchExo(`/instance/${this.activeInstanceId}`, { method: 'DELETE' });
      } catch (err) {
        this.log(`Warning: failed to delete instance: ${err}`);
      }
      this.activeInstanceId = null;
      this.activeModelName = null;
      this.events.emit('status-changed');
    }
  }

  getServerState(): ServerState {
    if (!this.connected) {
      return {
        status: 'stopped',
        backend: null,
        port: this.port,
        modelPath: null,
        modelName: null,
        pid: null,
        error: null,
        startedAt: null,
        contextSize: null,
        gpuLayers: null,
      };
    }

    return {
      status: this.activeInstanceId ? 'running' : 'stopped',
      backend: 'exo',
      port: this.port,
      modelPath: null,
      modelName: this.activeModelName,
      pid: null,
      error: null,
      startedAt: this.activeInstanceId ? Date.now() : null,
      contextSize: null,
      gpuLayers: null,
    };
  }

  getApiEndpoint(): string {
    return `${this.baseUrl()}/v1`;
  }

  getLogs(): string[] {
    return [...this.logs];
  }

  // ── Exo-specific methods ──

  async getClusterState(): Promise<ExoClusterState | null> {
    if (!this.connected) return null;
    await this.refreshClusterState();
    return this.clusterState;
  }

  async listModels(): Promise<ExoModel[]> {
    if (!this.connected) return [];
    const resp = await this.fetchExo('/models');
    if (!resp.ok) return [];
    const data = await resp.json() as { data: ExoModel[] };
    return data.data ?? [];
  }

  async searchModels(query: string): Promise<ExoModel[]> {
    if (!this.connected) return [];
    const resp = await this.fetchExo(`/models/search?q=${encodeURIComponent(query)}`);
    if (!resp.ok) return [];
    const data = await resp.json() as { data: ExoModel[] };
    return data.data ?? [];
  }

  async addCustomModel(repoId: string): Promise<void> {
    if (!this.connected) throw new Error('Exo not connected');
    const resp = await this.fetchExo('/models/add', {
      method: 'POST',
      body: JSON.stringify({ repo_id: repoId }),
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Failed to add model: ${resp.status} ${text}`);
    }
  }

  async deleteCustomModel(modelId: string): Promise<void> {
    if (!this.connected) throw new Error('Exo not connected');
    const resp = await this.fetchExo(`/models/custom/${encodeURIComponent(modelId)}`, {
      method: 'DELETE',
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Failed to delete model: ${resp.status} ${text}`);
    }
  }

  async previewInstance(modelId: string): Promise<unknown> {
    if (!this.connected) throw new Error('Exo not connected');
    const resp = await this.fetchExo(`/instance/previews?model_id=${encodeURIComponent(modelId)}`);
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Instance preview failed: ${resp.status} ${text}`);
    }
    return resp.json();
  }

  async createInstance(modelId: string): Promise<string> {
    // Convenience wrapper that creates + places + polls
    await this.startServer(modelId, { port: this.port, contextSize: 0, gpuLayers: 0 });
    return this.activeInstanceId!;
  }

  async deleteInstance(): Promise<void> {
    await this.stopServer();
  }

  async startDownload(modelId: string): Promise<void> {
    if (!this.connected) throw new Error('Exo not connected');
    const resp = await this.fetchExo('/download/start', {
      method: 'POST',
      body: JSON.stringify({ model_id: modelId }),
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Failed to start download: ${resp.status} ${text}`);
    }
  }

  async cancelDownload(nodeId: string, modelId: string): Promise<void> {
    if (!this.connected) throw new Error('Exo not connected');
    const resp = await this.fetchExo(
      `/download/${encodeURIComponent(nodeId)}/${encodeURIComponent(modelId)}`,
      { method: 'DELETE' },
    );
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Failed to cancel download: ${resp.status} ${text}`);
    }
  }

  // ── Internal helpers ──

  private async probe(): Promise<boolean> {
    try {
      const resp = await fetch(`${this.baseUrl()}/state`, {
        signal: AbortSignal.timeout(3_000),
      });
      return resp.ok;
    } catch {
      return false;
    }
  }

  private async refreshClusterState(): Promise<void> {
    try {
      const resp = await this.fetchExo('/state');
      if (resp.ok) {
        const raw = await resp.json() as Record<string, unknown>;
        // Map the Exo /state response to our ExoClusterState type
        const nodes: ExoClusterNode[] = Array.isArray(raw.nodes) ? (raw.nodes as Array<Record<string, unknown>>).map((n) => ({
          id: String(n.id ?? ''),
          name: String(n.name ?? ''),
          model: String(n.model ?? ''),
          memory: Number(n.memory ?? 0),
          flops: Number(n.flops ?? 0),
          isCoordinator: Boolean(n.is_coordinator ?? false),
        })) : [];

        this.clusterState = {
          nodes,
          nodeId: String(raw.node_id ?? ''),
        };
        this.events.emit('cluster-changed', this.clusterState);
      }
    } catch (err) {
      this.log(`Failed to refresh cluster state: ${err}`);
    }
  }

  private async fetchExo(path: string, init?: RequestInit): Promise<Response> {
    const url = `${this.baseUrl()}${path}`;
    return fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...init?.headers,
      },
      signal: init?.signal ?? AbortSignal.timeout(10_000),
    });
  }

  private startSSE(): void {
    this.stopSSE();
    this.sseController = new AbortController();
    this.consumeSSE(this.sseController.signal);
  }

  private stopSSE(): void {
    if (this.sseController) {
      this.sseController.abort();
      this.sseController = null;
    }
  }

  private async consumeSSE(signal: AbortSignal): Promise<void> {
    while (!signal.aborted && this.connected) {
      try {
        const resp = await fetch(`${this.baseUrl()}/events`, { signal });
        if (!resp.ok || !resp.body) {
          throw new Error(`SSE response ${resp.status}`);
        }

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (!signal.aborted) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const event = JSON.parse(line.slice(6)) as { type: string; data: unknown };
                this.handleSSEEvent(event);
              } catch {
                // Ignore malformed SSE data
              }
            }
          }
        }
      } catch (err) {
        if (signal.aborted) return;
        this.log(`SSE connection lost, reconnecting in ${SSE_RECONNECT_DELAY_MS / 1000}s...`);
        await sleep(SSE_RECONNECT_DELAY_MS);
      }
    }
  }

  private handleSSEEvent(event: { type: string; data: unknown }): void {
    switch (event.type) {
      case 'cluster_state':
        this.refreshClusterState();
        break;
      case 'download_progress':
        this.events.emit('download-progress', event.data);
        break;
      case 'instance_status':
        this.events.emit('status-changed');
        break;
      default:
        this.log(`SSE event: ${event.type}`);
    }
  }

  private log(message: string): void {
    const line = `[Exo] ${message}`;
    this.logs.push(line);
    if (this.logs.length > MAX_LOG_LINES) {
      this.logs = this.logs.slice(-MAX_LOG_LINES);
    }
    this.events.emit('log', line);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
