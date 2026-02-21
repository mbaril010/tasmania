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
import { assertSafeHttpUrl, fetchTextWithLimits, stripHtmlToText } from '../security/url-utils';

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
  const status = (await controlApi('/api/status')) as { endpoint?: string; status?: string; backend?: string; modelName?: string };
  if (!status.endpoint || status.status !== 'running') {
    throw new Error('No LLM server is currently running. Start a server in the Tasmania app first.');
  }

  const modelId = status.backend === 'exo' ? (status.modelName ?? 'local') : 'local';

  const response = await fetch(`${status.endpoint}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: modelId,
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

// ── Helper: Search the web via DuckDuckGo ──

async function webSearch(query: string, numResults = 10): Promise<Array<{ title: string; url: string; snippet: string }>> {
  const response = await fetch('https://html.duckduckgo.com/html/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `q=${encodeURIComponent(query)}`,
  });

  if (!response.ok) {
    throw new Error(`DuckDuckGo search failed: ${response.status}`);
  }

  const html = await response.text();
  const results: Array<{ title: string; url: string; snippet: string }> = [];

  // Extract result links (title + href)
  const linkRegex = /<a[^>]+class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  const links: Array<{ href: string; title: string }> = [];
  let linkMatch;
  while ((linkMatch = linkRegex.exec(html)) !== null) {
    links.push({ href: linkMatch[1], title: stripHtmlToText(linkMatch[2]) });
  }

  // Extract snippets
  const snippetRegex = /<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
  const snippets: string[] = [];
  let snippetMatch;
  while ((snippetMatch = snippetRegex.exec(html)) !== null) {
    snippets.push(stripHtmlToText(snippetMatch[1]));
  }

  for (let i = 0; i < Math.min(links.length, numResults); i++) {
    let url = links[i].href;

    // Decode DuckDuckGo redirect URLs
    if (url.includes('uddg=')) {
      try {
        const parsed = new URL(url, 'https://duckduckgo.com');
        const decoded = parsed.searchParams.get('uddg');
        if (decoded) url = decoded;
      } catch {
        // Keep original URL if parsing fails
      }
    }

    // Skip DuckDuckGo internal links
    if (url.includes('duckduckgo.com')) continue;

    results.push({
      title: links[i].title,
      url,
      snippet: snippets[i] || '',
    });
  }

  return results;
}

// ── Helper: Fetch a URL and return text content ──

async function webFetch(url: string, maxLength = 10000): Promise<string> {
  const target = await assertSafeHttpUrl(url);
  return fetchTextWithLimits(target, {
    maxChars: maxLength,
    userAgent: 'Tasmania-MCP/1.0',
  });
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
    {
      name: 'web_search',
      description: 'Search the web using DuckDuckGo and return results with titles, URLs, and snippets. Does NOT require the Tasmania app to be running.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          query: { type: 'string', description: 'Search query' },
          num_results: { type: 'number', description: 'Number of results to return (default: 10, max: 20)' },
        },
        required: ['query'],
      },
    },
    {
      name: 'web_fetch',
      description: 'Fetch a URL and return its text content. HTML pages are converted to plain text. Does NOT require the Tasmania app to be running.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          url: { type: 'string', description: 'URL to fetch (must start with http:// or https://)' },
          max_length: { type: 'number', description: 'Maximum character length of returned content (default: 10000, max: 50000)' },
        },
        required: ['url'],
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

      case 'web_search': {
        const { query, num_results } = args as { query: string; num_results?: number };
        const clamped = Math.max(1, Math.min(20, num_results ?? 10));
        const results = await webSearch(query, clamped);
        if (results.length === 0) {
          return { content: [{ type: 'text', text: 'No results found.' }] };
        }
        const formatted = results
          .map((r, i) => `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.snippet}`)
          .join('\n\n');
        return { content: [{ type: 'text', text: formatted }] };
      }

      case 'web_fetch': {
        const { url, max_length } = args as { url: string; max_length?: number };
        const clamped = Math.max(500, Math.min(50000, max_length ?? 10000));
        const content = await webFetch(url, clamped);
        return { content: [{ type: 'text', text: content }] };
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
