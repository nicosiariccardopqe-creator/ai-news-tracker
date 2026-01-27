
import { NewsItem, NewsResponse } from '../types';
import { MOCK_INITIAL_NEWS } from '../constants';

const N8N_MCP_URL = 'https://docker-n8n-xngg.onrender.com/mcp-server/http';

/**
 * Funzione per mappare i dati grezzi provenienti da n8n in NewsItem validi
 */
function mapRawToNewsItem(raw: any): NewsItem {
  return {
    id: raw.id || raw.guid || Math.random().toString(36).substr(2, 9),
    title: raw.title || raw.headline || 'Titolo non disponibile',
    summary: raw.summary || raw.description || raw.content || 'Nessun sommario disponibile per questa notizia.',
    url: raw.url || raw.link || '#',
    source: {
      name: raw.source_name || raw.author || raw.source?.name || 'FONTE AI',
      domain: raw.domain || raw.source?.domain || 'news.ai'
    },
    published_at: raw.published_at || raw.date || raw.pubDate || new Date().toISOString(),
    fetched_at: new Date().toISOString(),
    tags: Array.isArray(raw.tags) ? raw.tags : (raw.category ? [raw.category] : ['AI']),
    thumbnail: raw.thumbnail || raw.image || raw.enclosure?.url || '',
    language: raw.language || 'it',
    score: {
      freshness: raw.score?.freshness || 1.0,
      relevance: raw.score?.relevance || 0.9,
      popularity: raw.score?.popularity || 0.5
    }
  };
}

/**
 * Recupera le news reali dall'automazione n8n
 */
export async function fetchNews(params: { tags?: string[]; source?: string } = {}): Promise<NewsResponse> {
  try {
    // Nota: Trattandosi di un MCP server su Render, facciamo una chiamata POST 
    // cercando di invocare un tool di "get_news" o semplicemente recuperando i dati.
    // Se l'endpoint n8n è configurato come webhook standard, useremo una GET/POST diretta.
    
    const response = await fetch(N8N_MCP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      // Struttura tipica per chiamare un tool su MCP bridge n8n
      body: JSON.stringify({
        method: 'tools/call',
        params: {
          name: 'get_ai_news', // Nome ipotetico del tool nell'automazione
          arguments: {
            category: params.tags?.[0] || 'all',
            limit: 20
          }
        }
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP_ERROR_${response.status}`);
    }

    const data = await response.json();
    
    // Gestione flessibile della risposta n8n (array diretto o oggetto MCP)
    let rawItems = [];
    if (Array.isArray(data)) {
      rawItems = data;
    } else if (data.content && Array.isArray(data.content)) {
      // Formato MCP: content: [{ type: 'text', text: '...' }]
      const textContent = data.content.find((c: any) => c.type === 'text')?.text;
      if (textContent) {
        try {
          const parsed = JSON.parse(textContent);
          rawItems = Array.isArray(parsed) ? parsed : (parsed.items || []);
        } catch {
          rawItems = [];
        }
      }
    } else if (data.items) {
      rawItems = data.items;
    }

    // Se n8n non restituisce nulla, usiamo i mock come fallback sicuro (world-class resilience)
    if (rawItems.length === 0) {
      console.warn('N8N ha restituito 0 risultati, uso fallback mock.');
      return {
        generated_at: new Date().toISOString(),
        source_version: 'fallback-mock',
        items: dedupeAndSort(MOCK_INITIAL_NEWS),
        paging: { next_cursor: null, count: MOCK_INITIAL_NEWS.length }
      };
    }

    const items = rawItems.map(mapRawToNewsItem);
    const processedItems = dedupeAndSort(items);

    return {
      generated_at: new Date().toISOString(),
      source_version: 'n8n-live-feed',
      items: processedItems,
      paging: {
        next_cursor: null,
        count: processedItems.length
      }
    };

  } catch (error) {
    console.error('[NewsService] Error fetching from n8n:', error);
    // In caso di errore server, non rompiamo l'app: restituiamo i dati iniziali
    return {
      generated_at: new Date().toISOString(),
      source_version: 'error-fallback',
      items: dedupeAndSort(MOCK_INITIAL_NEWS),
      paging: { next_cursor: null, count: MOCK_INITIAL_NEWS.length }
    };
  }
}

export function dedupeAndSort(arr: NewsItem[]): NewsItem[] {
  const map = new Map<string, NewsItem>();
  for (const it of arr) {
    const key = `${(it.title || '').trim().toLowerCase()}|${(it.source?.domain || '').toLowerCase()}`;
    if (!map.has(key)) {
      map.set(key, it);
    } else {
      const existing = map.get(key)!;
      if (new Date(it.published_at) > new Date(existing.published_at)) {
        map.set(key, it);
      }
    }
  }

  return Array.from(map.values()).sort((a, b) =>
    new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
  );
}

export function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  let interval = Math.floor(seconds / 31536000);
  if (interval >= 1) return interval === 1 ? '1 anno fa' : `${interval} anni fa`;
  interval = Math.floor(seconds / 2592000);
  if (interval >= 1) return interval === 1 ? '1 mese fa' : `${interval} mesi fa`;
  interval = Math.floor(seconds / 86400);
  if (interval >= 1) return interval === 1 ? 'ieri' : `${interval} giorni fa`;
  interval = Math.floor(seconds / 3600);
  if (interval >= 1) return interval === 1 ? '1h fa' : `${interval}h fa`;
  interval = Math.floor(seconds / 60);
  if (interval >= 1) return interval === 1 ? '1 min fa' : `${interval} min fa`;
  return 'proprio ora';
}

export function trackTelemetry(event: string, data?: any) {
  console.log('[Telemetry]', { event, timestamp: new Date().toISOString(), data });
}
