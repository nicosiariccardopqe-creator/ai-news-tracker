// src/services/newsService.ts
import { NewsItem, NewsResponse } from '../types';
import { MOCK_INITIAL_NEWS } from '../constants';

/**
 * Funzione principale per recuperare le news.
 * Ora chiama il backend dell'applicazione (same-origin).
 */
export async function fetchNews(params: { tags?: string[] } = {}): Promise<NewsResponse> {
  try {
    const query = params.tags?.[0] || 'AI news';
    const LOCAL_API_URL = '/api/mcp/news';

    console.debug(`[NewsService] Fetching from Backend: ${LOCAL_API_URL}`);

    const mcpRequest = {
      jsonrpc: '2.0',
      id: `req_${Date.now()}`,
      method: 'tools/call',
      params: {
        name: 'get_ai_news',
        arguments: {
          query: query,
          limit: 30,
          force_refresh: true
        }
      }
    };

    const response = await fetch(LOCAL_API_URL, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(mcpRequest)
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'No response body');
      throw new Error(`Backend Error ${response.status}: ${errorText.substring(0, 100)}`);
    }

    const result = await response.json();

    if (result.error) {
      throw new Error(typeof result.error === 'string' ? result.error : (result.error.message || 'Unknown MCP error'));
    }

    let rawItems: any[] = [];
    
    if (result?.result?.content && Array.isArray(result.result.content)) {
      const textPart = result.result.content.find((c: any) => c.type === 'text');
      if (textPart?.text) {
        try {
          const parsed = JSON.parse(textPart.text);
          rawItems = Array.isArray(parsed) ? parsed : (parsed.items || parsed.news || []);
        } catch (e) {
          rawItems = [];
        }
      }
    } else if (result?.result && Array.isArray(result.result)) {
      rawItems = result.result;
    }

    if (!rawItems.length) {
      return createFallbackResponse('empty-result');
    }

    return {
      generated_at: new Date().toISOString(),
      source_version: 'backend-proxy-live',
      items: dedupeAndSort(rawItems.map(mapRawToNewsItem)),
      paging: { next_cursor: null, count: rawItems.length }
    };
  } catch (err: any) {
    console.error('[NewsService] Error calling backend:', err.message);
    return createFallbackResponse('backend-failure', err.message);
  }
}

function mapRawToNewsItem(raw: any): NewsItem {
  const title = raw.title || raw.headline || raw.name || 'Titolo AI News';
  const id = raw.id || raw.guid || raw._id || `gen-${btoa(encodeURIComponent(title)).substring(0, 12)}`;

  return {
    id: String(id),
    title,
    summary: raw.summary || raw.description || raw.content || 'Nessun dettaglio disponibile.',
    url: raw.url || raw.link || '#',
    source: {
      name: raw.source_name || raw.source?.name || 'AI NEWS',
      domain: raw.domain || 'n8n.io'
    },
    published_at: raw.published_at || raw.date || new Date().toISOString(),
    fetched_at: new Date().toISOString(),
    tags: Array.isArray(raw.tags) ? raw.tags : (raw.category ? [raw.category] : ['AI']),
    thumbnail: raw.thumbnail || raw.image || '',
    language: raw.language || 'it',
    score: { freshness: 1, relevance: 1, popularity: 0.5 }
  };
}

export function dedupeAndSort(arr: NewsItem[]): NewsItem[] {
  const map = new Map<string, NewsItem>();
  for (const it of arr) {
    const key = it.title.toLowerCase().trim();
    if (!map.has(key)) map.set(key, it);
  }
  return Array.from(map.values()).sort((a, b) =>
    new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
  );
}

function createFallbackResponse(reason: string, error?: string): NewsResponse {
  return {
    generated_at: new Date().toISOString(),
    source_version: `fallback-${reason}${error ? '::' + error : ''}`,
    items: dedupeAndSort(MOCK_INITIAL_NEWS),
    paging: { next_cursor: null, count: MOCK_INITIAL_NEWS.length }
  };
}

export function trackTelemetry(event: string, data?: any) {
  console.debug('[Telemetry]', event, data);
}

export function formatTimeAgo(dateString: string): string {
  try {
    const date = new Date(dateString);
    const diff = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diff < 60) return 'ora';
    if (diff < 3600) return `${Math.floor(diff / 60)}m fa`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h fa`;
    return `${Math.floor(diff / 86400)}g fa`;
  } catch { return 'recentemente'; }
}