// src/services/newsService.ts
import { NewsItem, NewsResponse } from '../types';
import { MOCK_INITIAL_NEWS } from '../constants';

export async function fetchNews(params: { tags?: string[] } = {}): Promise<NewsResponse> {
  const controller = new AbortController();
  // Timeout di 60 secondi
  const timeoutId = setTimeout(() => controller.abort(), 60000); 

  try {
    const query = params.tags?.[0] || 'AI news';
    const LOCAL_API_URL = '/api/mcp/news';

    const mcpRequest = {
      jsonrpc: '2.0',
      id: `req_${Date.now()}`,
      method: 'tools/call',
      params: {
        name: 'get_ai_news',
        arguments: { query, limit: 30, force_refresh: true }
      }
    };

    const response = await fetch(LOCAL_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mcpRequest),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.warn('[NewsService] API Error, loading defaults...', errorData);
      return createFallbackResponse('api-error', JSON.stringify(errorData));
    }

    const result = await response.json();

    let rawItems: any[] = [];
    if (result?.result?.content && Array.isArray(result.result.content)) {
      const textPart = result.result.content.find((c: any) => c.type === 'text');
      if (textPart?.text) {
        try {
          const parsed = JSON.parse(textPart.text);
          rawItems = Array.isArray(parsed) ? parsed : (parsed.items || []);
        } catch (e) { rawItems = []; }
      }
    } else if (result?.result && Array.isArray(result.result)) {
      rawItems = result.result;
    }

    if (!rawItems.length) return createFallbackResponse('empty-result');

    return {
      generated_at: new Date().toISOString(),
      source_version: 'backend-proxy-live',
      items: dedupeAndSort(rawItems.map(mapRawToNewsItem)),
      paging: { next_cursor: null, count: rawItems.length }
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    const isTimeout = err.name === 'AbortError';
    console.error(`[NewsService] ${isTimeout ? 'Timeout (60s)' : 'Error'}:`, err.message);
    
    // In caso di errore o timeout, carica sempre le news di default
    return createFallbackResponse(isTimeout ? 'timeout' : 'network-failure', err.message);
  }
}

function mapRawToNewsItem(raw: any): NewsItem {
  const title = raw.title || raw.headline || 'AI News';
  return {
    id: String(raw.id || Math.random()),
    title,
    summary: raw.summary || raw.description || '...',
    url: raw.url || raw.link || '#',
    source: { name: raw.source_name || 'AI', domain: 'n8n.io' },
    published_at: raw.published_at || new Date().toISOString(),
    fetched_at: new Date().toISOString(),
    tags: Array.isArray(raw.tags) ? raw.tags : ['AI'],
    language: 'it',
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
    source_version: `fallback-${reason}::${error || ''}`,
    items: dedupeAndSort(MOCK_INITIAL_NEWS),
    paging: { next_cursor: null, count: MOCK_INITIAL_NEWS.length }
  };
}

export function trackTelemetry(event: string, data?: any) { console.debug('[Telemetry]', event, data); }