import type { BackendInfo, BackendType, ServerOptions, ServerState } from '../../shared/types';

/**
 * Abstract base class for LLM backend implementations.
 * Each backend extends this with its own detection/management logic.
 */
export abstract class BackendService {
  abstract readonly type: BackendType;

  /** Check if the backend binary/app is installed on the system */
  abstract detect(): Promise<BackendInfo>;

  /** Start the LLM server with a given model */
  abstract startServer(modelPath: string, options: ServerOptions): Promise<void>;

  /** Stop the running server */
  abstract stopServer(): Promise<void>;

  /** Get current server state */
  abstract getServerState(): ServerState;

  /** Get the OpenAI-compatible API base URL */
  abstract getApiEndpoint(): string;

  /** Get recent log lines from the server process */
  abstract getLogs(): string[];
}
