import { ipcMain } from 'electron';
import { IPC } from '../../shared/ipc-channels';
import { assertSafeHttpUrl, fetchTextWithLimits, stripHtmlToText } from '../security/url-utils';

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
    links.push({ href: linkMatch[1], title: stripHtmlToText(linkMatch[2]) });
  }

  const snippetRegex = /<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
  const snippets: string[] = [];
  let snippetMatch;
  while ((snippetMatch = snippetRegex.exec(html)) !== null) {
    snippets.push(stripHtmlToText(snippetMatch[1]));
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

// ── Register IPC handlers ──

export function registerWebHandlers() {
  ipcMain.handle(IPC.WEB_SEARCH, async (_event, query: string, numResults?: number) => {
    if (typeof query !== 'string' || query.trim().length === 0) {
      throw new Error('Search query is required');
    }
    if (query.length > 500) {
      throw new Error('Search query too long');
    }
    const clamped = Math.max(1, Math.min(20, numResults ?? 5));
    return webSearch(query.trim(), clamped);
  });

  ipcMain.handle(IPC.WEB_FETCH, async (_event, url: string, maxLength?: number) => {
    const target = await assertSafeHttpUrl(url);
    const clamped = Math.max(500, Math.min(50000, maxLength ?? 10000));
    return fetchTextWithLimits(target, {
      maxChars: clamped,
      userAgent: 'Tasmania/1.0',
    });
  });
}
