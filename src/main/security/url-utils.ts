import dns from 'node:dns/promises';
import net from 'node:net';

export const MAX_FETCH_RESPONSE_BYTES = 1_000_000;

function isPrivateIpv4(address: string): boolean {
  const parts = address.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return true;
  }
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
  return false;
}

function isPrivateIpv6(address: string): boolean {
  const normalized = address.toLowerCase();
  if (normalized === '::1' || normalized === '::') return true;
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true; // unique local
  if (normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb')) {
    return true; // link-local
  }
  if (normalized.startsWith('::ffff:')) {
    const mapped = normalized.slice('::ffff:'.length);
    return isPrivateIpv4(mapped);
  }
  return false;
}

function isPrivateOrLocalIp(address: string): boolean {
  const version = net.isIP(address);
  if (version === 4) return isPrivateIpv4(address);
  if (version === 6) return isPrivateIpv6(address);
  return true;
}

function isBlockedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost')) return true;
  if (host.endsWith('.local')) return true;
  if (host === '0.0.0.0') return true;
  return false;
}

export function stripHtmlToText(html: string): string {
  let text = html;
  text = text.replace(/<script[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[\s\S]*?<\/style>/gi, '');
  text = text.replace(/<\/?(?:p|div|br|hr|h[1-6]|li|tr|blockquote)[^>]*>/gi, '\n');
  text = text.replace(/<[^>]+>/g, '');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, '\'');
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/[ \t]+/g, ' ');
  text = text.replace(/\n\s*\n/g, '\n\n');
  return text.trim();
}

function parseUrl(input: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    throw new Error('Invalid URL');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('URL must start with http:// or https://');
  }
  if (parsed.username || parsed.password) {
    throw new Error('URL authentication credentials are not allowed');
  }
  if (!parsed.hostname) {
    throw new Error('URL hostname is required');
  }
  return parsed;
}

async function assertResolvablePublicHost(hostname: string): Promise<void> {
  if (isBlockedHostname(hostname)) {
    throw new Error(`Blocked hostname: ${hostname}`);
  }

  const literalIpVersion = net.isIP(hostname);
  if (literalIpVersion !== 0) {
    if (isPrivateOrLocalIp(hostname)) {
      throw new Error(`Blocked private or local IP: ${hostname}`);
    }
    return;
  }

  const records = await dns.lookup(hostname, { all: true, verbatim: true });
  if (records.length === 0) {
    throw new Error(`Could not resolve host: ${hostname}`);
  }
  for (const record of records) {
    if (isPrivateOrLocalIp(record.address)) {
      throw new Error(`Blocked private or local destination: ${hostname}`);
    }
  }
}

export async function assertSafeHttpUrl(url: string): Promise<URL> {
  const parsed = parseUrl(url);
  await assertResolvablePublicHost(parsed.hostname);
  return parsed;
}

async function readBodyWithSizeLimit(response: Response, maxBytes: number): Promise<string> {
  if (!response.body) {
    return '';
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel();
      throw new Error(`Response too large (>${maxBytes} bytes)`);
    }

    chunks.push(decoder.decode(value, { stream: true }));
  }

  chunks.push(decoder.decode());
  return chunks.join('');
}

export async function fetchTextWithLimits(
  target: URL,
  options: { maxChars: number; maxBytes?: number; timeoutMs?: number; userAgent: string },
): Promise<string> {
  const maxBytes = options.maxBytes ?? MAX_FETCH_RESPONSE_BYTES;
  const timeoutMs = options.timeoutMs ?? 15_000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(target, {
      signal: controller.signal,
      headers: { 'User-Agent': options.userAgent },
    });

    if (!response.ok) {
      throw new Error(`Fetch failed: ${response.status} ${response.statusText}`);
    }

    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    const raw = await readBodyWithSizeLimit(response, maxBytes);
    let text = contentType.includes('html') ? stripHtmlToText(raw) : raw;

    if (text.length > options.maxChars) {
      text = text.slice(0, options.maxChars)
        + `\n\n[Truncated - showing ${options.maxChars} of ${text.length} characters]`;
    }

    return text;
  } finally {
    clearTimeout(timeout);
  }
}
