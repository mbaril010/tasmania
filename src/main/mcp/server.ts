#!/usr/bin/env node

/**
 * Tasmania MCP Server
 *
 * Standalone process that exposes local LLM functionality to Claude Code via MCP protocol.
 * Communicates with the running Tasmania Electron app via an internal HTTP control API
 * on localhost:3999.
 *
 * Usage in Claude Code MCP config:
 * {
 *   "mcpServers": {
 *     "tasmania": {
 *       "command": "node",
 *       "args": ["/path/to/server.js"]
 *     }
 *   }
 * }
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const CONTROL_API = 'http://localhost:3999';

// Read auth token written by the Electron app (mode 0600)
function readApiToken(): string {
  const tokenPath = join(
    homedir(),
    'Library',
    'Application Support',
    'Tasmania',
    '.control-api-token',
  );
  try {
    return readFileSync(tokenPath, 'utf-8').trim();
  } catch {
    throw new Error(
      'Cannot read control API token. Is the Tasmania app running?'
    );
  }
}

let cachedToken: string | null = null;

function getToken(): string {
  if (!cachedToken) {
    cachedToken = readApiToken();
  }
  return cachedToken;
}

// ── Helper: Call the Tasmania control API ──

async function controlApi(apiPath: string, options?: RequestInit): Promise<unknown> {
  try {
    const token = getToken();
    const response = await fetch(`${CONTROL_API}${apiPath}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options?.headers,
      },
    });
    if (!response.ok) {
      const text = await response.text();
      // If unauthorized, token may have rotated — clear cache and retry once
      if (response.status === 401 && cachedToken) {
        cachedToken = null;
        return controlApi(apiPath, options);
      }
      throw new Error(`Control API error (${response.status}): ${text}`);
    }
    return response.json();
  } catch (err) {
    if (err instanceof TypeError && (err.message.includes('fetch') || err.message.includes('ECONNREFUSED'))) {
      cachedToken = null;
      throw new Error('Tasmania app is not running. Please start the app first.');
    }
    throw err;
  }
}

// ── Helper: Forward a prompt to the active LLM ──

async function queryLlm(prompt: string, maxTokens = 500, temperature = 0.7): Promise<string> {
  const status = (await controlApi('/api/status')) as { endpoint?: string; status?: string };
  if (!status.endpoint || status.status !== 'running') {
    throw new Error('No LLM server is currently running. Start a server in the Tasmania app first.');
  }

  const response = await fetch(`${status.endpoint}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'local',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
      temperature,
    }),
  });

  if (!response.ok) {
    throw new Error(`LLM API error: ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content ?? '';
}

// ── MCP Server Setup ──

const server = new Server(
  { name: 'tasmania', version: '0.0.1' },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

// ── Tools ──

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'query_llm',
      description: 'Send a prompt to the locally running LLM and get a response. Requires the Tasmania app to be running with a model loaded.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          prompt: { type: 'string', description: 'The prompt to send to the LLM' },
          max_tokens: { type: 'number', description: 'Maximum tokens in response (default: 500)' },
          temperature: { type: 'number', description: 'Sampling temperature 0-2 (default: 0.7)' },
        },
        required: ['prompt'],
      },
    },
    {
      name: 'list_models',
      description: 'List all locally available GGUF models that can be loaded.',
      inputSchema: {
        type: 'object' as const,
        properties: {},
      },
    },
    {
      name: 'load_model',
      description: 'Load a specific GGUF model into the active backend and start the server.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          model_path: { type: 'string', description: 'Full path to the GGUF model file' },
          backend: { type: 'string', enum: ['llama.cpp'], description: 'Backend to use (default: llama.cpp)' },
        },
        required: ['model_path'],
      },
    },
    {
      name: 'get_server_status',
      description: 'Get the current status of the LLM server (running/stopped, model loaded, API endpoint).',
      inputSchema: {
        type: 'object' as const,
        properties: {},
      },
    },
    {
      name: 'download_model',
      description: 'Download a GGUF model from HuggingFace. The model will be saved to the local models directory.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          repo_id: { type: 'string', description: 'HuggingFace repo ID (e.g., "bartowski/Llama-3.2-3B-Instruct-GGUF")' },
          filename: { type: 'string', description: 'GGUF filename to download (e.g., "Llama-3.2-3B-Instruct-Q4_K_M.gguf")' },
        },
        required: ['repo_id', 'filename'],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'query_llm': {
        const prompt = (args as { prompt: string; max_tokens?: number; temperature?: number }).prompt;
        const maxTokens = (args as { max_tokens?: number }).max_tokens ?? 500;
        const temperature = (args as { temperature?: number }).temperature ?? 0.7;
        const response = await queryLlm(prompt, maxTokens, temperature);
        return { content: [{ type: 'text', text: response }] };
      }

      case 'list_models': {
        const models = await controlApi('/api/models');
        return { content: [{ type: 'text', text: JSON.stringify(models, null, 2) }] };
      }

      case 'load_model': {
        const { model_path, backend = 'llama.cpp' } = args as { model_path: string; backend?: string };
        await controlApi('/api/start', {
          method: 'POST',
          body: JSON.stringify({ backend, modelPath: model_path }),
        });
        return { content: [{ type: 'text', text: `Model loaded successfully on ${backend}` }] };
      }

      case 'get_server_status': {
        const status = await controlApi('/api/status');
        return { content: [{ type: 'text', text: JSON.stringify(status, null, 2) }] };
      }

      case 'download_model': {
        const { repo_id, filename } = args as { repo_id: string; filename: string };
        const result = await controlApi('/api/download', {
          method: 'POST',
          body: JSON.stringify({ repo: repo_id, filename }),
        });
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { content: [{ type: 'text', text: `Error: ${message}` }], isError: true };
  }
});

// ── Resources ──

server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: [
    {
      uri: 'tasmania://models/active',
      name: 'Active Model',
      description: 'Information about the currently loaded LLM model',
      mimeType: 'application/json',
    },
    {
      uri: 'tasmania://models/available',
      name: 'Available Models',
      description: 'List of locally available GGUF models',
      mimeType: 'application/json',
    },
    {
      uri: 'tasmania://logs/server',
      name: 'Server Logs',
      description: 'Recent server output logs',
      mimeType: 'text/plain',
    },
  ],
}));

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  try {
    switch (uri) {
      case 'tasmania://models/active': {
        const status = await controlApi('/api/status');
        return { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(status, null, 2) }] };
      }

      case 'tasmania://models/available': {
        const models = await controlApi('/api/models');
        return { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(models, null, 2) }] };
      }

      case 'tasmania://logs/server': {
        const logs = await controlApi('/api/logs');
        const text = Array.isArray(logs) ? (logs as string[]).join('\n') : String(logs);
        return { contents: [{ uri, mimeType: 'text/plain', text }] };
      }

      default:
        throw new Error(`Unknown resource: ${uri}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { contents: [{ uri, mimeType: 'text/plain', text: `Error: ${message}` }] };
  }
});

// ── Start ──

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('MCP server failed to start:', err);
  process.exit(1);
});
