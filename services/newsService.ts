
import { NewsItem, NewsResponse } from '../types';
import { MOCK_INITIAL_NEWS } from '../constants';

const N8N_MCP_URL = 'https://docker-n8n-xngg.onrender.com/mcp-server/http';
const AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkNDIyYTk3Ny0xOGM0LTQyNjMtODZkMy1jMTU4ZjAzMjRmYjIiLCJpc3MiOiJuOG4iLCJhdWQiOiJtY3Atc2VydmVyLWFwaSIsImp0aSI6IjBmNjM0NGM1LTFkMmMtNDljZC1iZjE5LTJiMDI2ODdlZGQ2NSIsImlhdCI6MTc2OTUyMTg4OH0.W0E4KVUdy8A6FB45K_RoKVbw1Yp4dbryx9eQSMiTHOk';

/**
 * Funzione per mappare i dati grezzi provenienti da n8n in NewsItem validi.
 * Gestisce diverse varianti di nomi campo per massima compatibilità.
 */
function mapRawToNewsItem(raw: any): NewsItem {
  const id = raw.id || raw.guid || raw._id || Math.random().toString(36).substr(2, 9);
  return {
    id: String(id),
    title: raw.title || raw.headline || raw.name || 'Titolo non disponibile',
    summary: raw.summary || raw.description || raw.content || raw.excerpt || 'Nessun sommario disponibile.',
    url: raw.url || raw.link || raw.href || '#',
    source: {
      name: raw.source_name || raw.author || raw.source?.name || 'N8N SOURCE',
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

/**
 * Recupera le news reali dall'automazione n8n con gestione errori avanzata e autenticazione.
 */
export async function fetchNews(params: { tags?: string[]; source?: string } = {}): Promise<NewsResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000); // Leggermente aumentato il timeout per n8n

  try {
    const fetchUrl = `${N8N_MCP_URL}?t=${Date.now()}`;
    
    const response = await fetch(fetchUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${AUTH_TOKEN}` // Token di autenticazione aggiunto
      },
      mode: 'cors',
      body: JSON.stringify({
        method: 'tools/call',
        params: {
          name: 'get_ai_news',
          arguments: {
            category: params.tags?.[0] || 'all',
            limit: 25
          }
        }
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error('Errore di autenticazione: il token potrebbe essere scaduto o non valido.');
      }
      throw new Error(`Il server ha risposto con lo stato: ${response.status}`);
    }

    const data = await response.json();
    let rawItems: any[] = [];

    // Logica di estrazione dati ultra-flessibile per MCP
    if (Array.isArray(data)) {
      rawItems = data;
    } else if (data.content && Array.isArray(data.content)) {
      const textPart = data.content.find((c: any) => c.type === 'text');
      if (textPart?.text) {
        try {
          const parsed = JSON.parse(textPart.text);
          rawItems = Array.isArray(parsed) ? parsed : (parsed.items || parsed.news || parsed.result || []);
        } catch {
          console.warn('Impossibile analizzare il contenuto testuale MCP come JSON.');
        }
      }
    } else if (data.items && Array.isArray(data.items)) {
      rawItems = data.items;
    } else if (data.result && Array.isArray(data.result)) {
      rawItems = data.result;
    }

    if (rawItems.length === 0) {
      console.warn('[NewsService] Nessun dato trovato nella risposta di n8n, uso i mock di fallback.');
      return createFallbackResponse('no-data');
    }

    const items = rawItems.map(mapRawToNewsItem);
    const processedItems = dedupeAndSort(items);

    return {
      generated_at: new Date().toISOString(),
      source_version: 'n8n-live-v3-auth',
      items: processedItems,
      paging: { next_cursor: null, count: processedItems.length }
    };

  } catch (error: any) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      console.error('[NewsService] Timeout della richiesta n8n superato.');
    } else if (error.message === 'Failed to fetch') {
      console.error('[NewsService] Errore di rete o CORS. Verifica le impostazioni su n8n:', N8N_MCP_URL);
    } else {
      console.error('[NewsService] Errore durante la fetch da n8n:', error.message);
    }

    return createFallbackResponse('error-fallback');
  }
}

function createFallbackResponse(reason: string): NewsResponse {
  return {
    generated_at: new Date().toISOString(),
    source_version: reason,
    items: dedupeAndSort(MOCK_INITIAL_NEWS),
    paging: { next_cursor: null, count: MOCK_INITIAL_NEWS.length }
  };
}

export function dedupeAndSort(arr: NewsItem[]): NewsItem[] {
  const map = new Map<string, NewsItem>();
  for (const it of arr) {
    const key = it.id || `${it.title.trim().toLowerCase()}`;
    if (!map.has(key)) {
      map.set(key, it);
    }
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

    let interval = Math.floor(seconds / 31536000);
    if (interval >= 1) return `${interval}a fa`;
    interval = Math.floor(seconds / 2592000);
    if (interval >= 1) return `${interval}m fa`;
    interval = Math.floor(seconds / 86400);
    if (interval >= 1) return interval === 1 ? 'ieri' : `${interval}g fa`;
    interval = Math.floor(seconds / 3600);
    if (interval >= 1) return `${interval}h fa`;
    interval = Math.floor(seconds / 60);
    if (interval >= 1) return `${interval} min fa`;
    return 'ora';
  } catch {
    return 'recentemente';
  }
}

export function trackTelemetry(event: string, data?: any) {
  if (process.env.NODE_ENV === 'development') {
    console.debug('[Telemetry]', event, data);
  }
}
