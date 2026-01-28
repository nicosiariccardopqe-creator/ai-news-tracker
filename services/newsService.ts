
import { NewsItem, NewsResponse } from '../types';
import { MOCK_INITIAL_NEWS } from '../constants';

// URL del server n8n MCP
const N8N_MCP_URL = 'https://docker-n8n-xngg.onrender.com/mcp-server/http';

/**
 * TOKEN DI AUTORIZZAZIONE
 */
const AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJlMWE5NjRkZi02ZDMzLTRkZGUtOTI3Yi05NGQ0ZjMwNmM1Y2YiLCJpc3MiOiJuOG4iLCJhdWQiOiJtY3Atc2VydmVyLWFwaSIsImp0aSI6ImQzMjdmNzkxLTExOWMtNDUzYi1iNmU0LWM4MWFhNGE3MzNkZSIsImlhdCI6MTc2OTUyMzU4N30.7u2MS7h9dhEIQ6LaOciT8xvYUxmeLoRYS4Mw_t9K2C0';

/**
 * Funzione di fetch con gestione del timeout, retry e PROXY CORS per risolvere i problemi di connessione.
 */
async function fetchWithRetry(url: string, options: RequestInit, retries = 1, delay = 2000, useProxy = false): Promise<Response> {
  // Se stiamo usando il proxy, incapsuliamo l'URL. Allorigins è un servizio pubblico utile per bypassare CORS.
  const finalUrl = useProxy 
    ? `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}` 
    : `${url}?cb=${Date.now()}`; // Cache busting query param

  try {
    const response = await fetch(finalUrl, {
      ...options,
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      // Se usiamo il proxy, alcuni server non accettano headers specifici
      headers: useProxy ? { 'Content-Type': 'application/json' } : options.headers
    });
    
    if (!response.ok) {
      if (response.status >= 500 && retries > 0) {
        throw new Error(`RETRY_SERVER_ERROR_${response.status}`);
      }
      throw new Error(`HTTP_STATUS_${response.status}`);
    }
    
    return response;
  } catch (err: any) {
    // Se fallisce per "Failed to fetch" (CORS/Network) e non abbiamo ancora provato il proxy, proviamolo subito
    if (!useProxy && (err.name === 'TypeError' || err.message.includes('Failed to fetch'))) {
      console.warn(`[NewsService] Rilevato possibile errore CORS/Rete. Tento tramite proxy...`);
      return fetchWithRetry(url, options, 0, 0, true);
    }

    if (retries > 0) {
      console.warn(`[NewsService] Tentativo fallito, riprovo... (${retries} rimasti). Errore: ${err.message}`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return fetchWithRetry(url, options, retries - 1, delay * 1.5, useProxy);
    }
    throw err;
  }
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; 
  }
  return Math.abs(hash).toString(36);
}

function mapRawToNewsItem(raw: any): NewsItem {
  const title = raw.title || raw.headline || raw.name || 'Titolo non disponibile';
  const id = raw.id || raw.guid || raw._id || `gen-${simpleHash(title)}`;
  
  return {
    id: String(id),
    title,
    summary: raw.summary || raw.description || raw.content || raw.excerpt || 'Nessun sommario disponibile.',
    url: raw.url || raw.link || raw.href || '#',
    source: {
      name: raw.source_name || raw.author || raw.source?.name || 'LIVE N8N',
      domain: raw.domain || raw.source?.domain || 'news.ai'
    },
    published_at: raw.published_at || raw.date || raw.pubDate || raw.timestamp || new Date().toISOString(),
    fetched_at: new Date().toISOString(),
    tags: Array.isArray(raw.tags) ? raw.tags : (raw.category ? [raw.category] : ['AI']),
    thumbnail: raw.thumbnail || raw.image || raw.enclosure?.url || '',
    language: raw.language || 'it',
    score: {
      freshness: Number(raw.score?.freshness || 1.0),
      relevance: Number(raw.score?.relevance || 0.9),
      popularity: Number(raw.score?.popularity || 0.5)
    }
  };
}

export async function fetchNews(params: { tags?: string[]; source?: string } = {}): Promise<NewsResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);

  try {
    const response = await fetchWithRetry(N8N_MCP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: `req-${Date.now()}`,
        method: 'tools/call',
        params: {
          name: 'get_ai_news',
          arguments: {
            description: "Questo workflow serve per prendere le ultime news nel campo AI",
            query: params.tags?.[0] || 'AI news',
            limit: 30,
            timestamp: new Date().toISOString() // Forza il server a non usare cache se possibile
          }
        }
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const data = await response.json();
    let rawItems: any[] = [];

    if (data.content && Array.isArray(data.content)) {
      const textPart = data.content.find((c: any) => c.type === 'text');
      if (textPart?.text) {
        try {
          const parsed = JSON.parse(textPart.text);
          rawItems = Array.isArray(parsed) ? parsed : (parsed.items || parsed.news || parsed.result || []);
        } catch {
          rawItems = [];
        }
      }
    } else if (data.result) {
      rawItems = Array.isArray(data.result) ? data.result : (data.result.items || []);
    }

    if (!rawItems || rawItems.length === 0) {
      throw new Error("EMPTY_DATA_FROM_N8N");
    }

    const items = rawItems.map(mapRawToNewsItem);
    
    return {
      generated_at: new Date().toISOString(),
      source_version: 'n8n-direct-mcp',
      items: dedupeAndSort(items),
      paging: { next_cursor: null, count: items.length }
    };

  } catch (error: any) {
    clearTimeout(timeoutId);
    
    let errorDetail = 'unknown';
    if (error.name === 'AbortError') errorDetail = 'timeout-60s';
    else if (error.message.includes('HTTP_STATUS_')) errorDetail = error.message.toLowerCase().replace(/_/g, '-');
    else if (error.message.includes('Failed to fetch') || error.name === 'TypeError') errorDetail = 'network-cors-critical';
    else if (error.message === 'EMPTY_DATA_FROM_N8N') errorDetail = 'empty-response';
    else errorDetail = `err-${error.message.slice(0, 50).replace(/\s+/g, '-')}`;

    console.error(`[NewsService] Connessione Fallita (${errorDetail}):`, error);
    const fallback = createFallbackResponse(errorDetail);
    
    // Costruiamo un messaggio diagnostico completo per il modal
    const debugInfo = [
      `Dettaglio: ${errorDetail}`,
      `Messaggio: ${error.message}`,
      `Data: ${new Date().toLocaleString()}`,
      `URL: ${N8N_MCP_URL}`,
      `Mode: CORS Fallback Active`
    ].join('\n');
    
    fallback.source_version = `fallback-${errorDetail}::${debugInfo}`;
    return fallback;
  }
}

export function dedupeAndSort(arr: NewsItem[]): NewsItem[] {
  const map = new Map<string, NewsItem>();
  for (const it of arr) {
    const key = it.id;
    if (!map.has(key)) map.set(key, it);
  }
  return Array.from(map.values()).sort((a, b) =>
    new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
  );
}

export function formatTimeAgo(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (isNaN(seconds)) return 'recentemente';
    if (seconds < 60) return 'ora';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} min fa`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h fa`;
    return `${Math.floor(hours / 24)}g fa`;
  } catch {
    return 'recentemente';
  }
}

export function trackTelemetry(event: string, data?: any) {
  if (process.env.NODE_ENV === 'development') {
    console.debug('[Telemetry]', event, data);
  }
}

function createFallbackResponse(reason: string): NewsResponse {
  return {
    generated_at: new Date().toISOString(),
    source_version: `fallback-${reason}`,
    items: dedupeAndSort(MOCK_INITIAL_NEWS),
    paging: { next_cursor: null, count: MOCK_INITIAL_NEWS.length }
  };
}
