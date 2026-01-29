
import { NewsItem, NewsResponse } from '../types';
import { MOCK_INITIAL_NEWS } from '../constants';

// Endpoint MCP aggiornato all'URL completo richiesto
export const MCP_ENDPOINT = 'https://docker-n8n-xngg.onrender.com/mcp-server/http';

/**
 * Tenta di recuperare le news dal server primario.
 * Se fallisce, solleva un errore per permettere il logging dello stack trace.
 */
export async function fetchNews(params: { tags?: string[] } = {}): Promise<NewsResponse> {
  try {
    const token = process.env.MCP_TOKEN || 'MISSING_TOKEN';
    
    // Log di controllo interno
    if (token === 'MISSING_TOKEN') {
      console.warn('[NewsService] Attenzione: MCP_TOKEN non configurato.');
    }

    // Chiamata all'endpoint MCP assoluto
    const response = await fetch(MCP_ENDPOINT, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        method: "NewsAI",
        token: token, // Incluso nel payload come richiesto
        params: params
      }),
      signal: AbortSignal.timeout(60000) // 60s per gestire il cold start di Render
    });

    if (!response.ok) {
      const errorInfo = await response.text().catch(() => response.statusText);
      throw new Error(`Server MCP [${response.status}]: ${errorInfo}`);
    }

    return await response.json();
  } catch (error: any) {
    let errorMessage = error.message;

    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      errorMessage = "Timeout (60s). Il server Render potrebbe essere in fase di avvio o sovraccarico.";
    } else if (errorMessage === 'Failed to fetch') {
      errorMessage = "Failed to fetch: Errore CORS o rete. Verifica se il server MCP è attivo e accetta l'origine.";
    }

    const stackError = new Error(`Errore connessione MCP [${MCP_ENDPOINT}]: ${errorMessage}`);
    (stackError as any).isProviderError = true;
    (stackError as any).originalStack = error.stack;
    throw stackError;
  }
}

/**
 * Caricamento di emergenza dai dati locali (Fallback)
 */
export async function fetchMockNews(params: { tags?: string[] } = {}): Promise<NewsResponse> {
  await new Promise(resolve => setTimeout(resolve, 400));
  const activeTag = params.tags?.[0] || 'TUTTE';
  
  let filtered = MOCK_INITIAL_NEWS;
  if (activeTag !== 'TUTTE') {
    filtered = MOCK_INITIAL_NEWS.filter(item => 
      item.tags.some(t => t.toUpperCase() === activeTag.toUpperCase())
    );
  }

  return {
    generated_at: new Date().toISOString(),
    source_version: 'local-fallback-v1',
    items: dedupeAndSort(filtered),
    paging: { next_cursor: null, count: filtered.length }
  };
}

export function dedupeAndSort(arr: NewsItem[]): NewsItem[] {
  const map = new Map<string, NewsItem>();
  for (const it of arr) {
    const key = (it.title || '').toLowerCase().trim();
    if (key && !map.has(key)) map.set(key, it);
  }
  return Array.from(map.values()).sort((a, b) => 
    new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
  );
}

export function trackTelemetry(event: string, data?: any) { 
  console.debug('[Telemetry]', event, data); 
}
