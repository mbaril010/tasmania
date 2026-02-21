import { ipcMain } from 'electron';
import { IPC } from '../../shared/ipc-channels';

// ── Helper: Strip HTML to plain text ──

function stripHtml(html: string): string {
  let text = html;
  text = text.replace(/<script[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[\s\S]*?<\/style>/gi, '');
  text = text.replace(/<\/?(?:p|div|br|hr|h[1-6]|li|tr|blockquote)[^>]*>/gi, '\n');
  text = text.replace(/<[^>]+>/g, '');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/[ \t]+/g, ' ');
  text = text.replace(/\n\s*\n/g, '\n\n');
  return text.trim();
}

// ── Helper: Search the web via DuckDuckGo ──

async function webSearch(query: string, numResults = 5): Promise<Array<{ title: string; url: string; snippet: string }>> {
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

  const linkRegex = /<a[^>]+class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  const links: Array<{ href: string; title: string }> = [];
  let linkMatch;
  while ((linkMatch = linkRegex.exec(html)) !== null) {
    links.push({ href: linkMatch[1], title: stripHtml(linkMatch[2]) });
  }

  const snippetRegex = /<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
  const snippets: string[] = [];
  let snippetMatch;
  while ((snippetMatch = snippetRegex.exec(html)) !== null) {
    snippets.push(stripHtml(snippetMatch[1]));
  }

  for (let i = 0; i < Math.min(links.length, numResults); i++) {
    let url = links[i].href;

    if (url.includes('uddg=')) {
      try {
        const parsed = new URL(url, 'https://duckduckgo.com');
        const decoded = parsed.searchParams.get('uddg');
        if (decoded) url = decoded;
      } catch {
        // Keep original URL if parsing fails
      }
    }

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
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Tasmania/1.0' },
    });

    if (!response.ok) {
      throw new Error(`Fetch failed: ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') || '';
    const raw = await response.text();

    let text: string;
    if (contentType.includes('html')) {
      text = stripHtml(raw);
    } else {
      text = raw;
    }

    if (text.length > maxLength) {
      text = text.slice(0, maxLength) + `\n\n[Truncated — showing ${maxLength} of ${text.length} characters]`;
    }

    return text;
  } finally {
    clearTimeout(timeout);
  }
}

// ── Register IPC handlers ──

export function registerWebHandlers() {
  ipcMain.handle(IPC.WEB_SEARCH, async (_event, query: string, numResults?: number) => {
    const clamped = Math.max(1, Math.min(20, numResults ?? 5));
    return webSearch(query, clamped);
  });

  ipcMain.handle(IPC.WEB_FETCH, async (_event, url: string, maxLength?: number) => {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      throw new Error('URL must start with http:// or https://');
    }
    const clamped = Math.max(500, Math.min(50000, maxLength ?? 10000));
    return webFetch(url, clamped);
  });
}
