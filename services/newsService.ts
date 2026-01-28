
import { NewsItem, NewsResponse } from '../types';
import { MOCK_INITIAL_NEWS } from '../constants';

export const MCP_ENDPOINT = '/api/news/default';

/**
 * Tenta di recuperare le news dal server primario.
 * Se fallisce, solleva un errore per permettere il logging dello stack trace.
 */
export async function fetchNews(params: { tags?: string[] } = {}): Promise<NewsResponse> {
  try {
    // TENTATIVO PRIMARIO: Chiamata al server MCP (simulata o reale)
    const response = await fetch(MCP_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(2000) // Timeout rapido per testare il fallback
    });

    if (!response.ok) {
      throw new Error(`Server MCP ha risposto con status ${response.status}`);
    }

    return await response.json();
  } catch (error: any) {
    // Se la chiamata fallisce, rilanciamo l'errore per il logger dell'App
    const stackError = new Error(`[MCP_FAILURE] Impossibile recuperare news da ${MCP_ENDPOINT}: ${error.message}`);
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
