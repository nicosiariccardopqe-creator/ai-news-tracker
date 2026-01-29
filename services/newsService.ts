
import { NewsItem, NewsResponse } from '../types';
import { MOCK_INITIAL_NEWS } from '../constants';

export const MCP_ENDPOINT = '/api/news';

export interface FetchNewsResult {
  data: NewsResponse;
  trace: string[];
}

/**
 * Recupera le news tramite il proxy locale.
 * Ritorna sia i dati che il tracciamento delle attività del server.
 */
export async function fetchNews(params: { tags?: string[] } = {}, token?: string): Promise<FetchNewsResult> {
  try {
    const response = await fetch(MCP_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ params, token }),
      signal: AbortSignal.timeout(65000) 
    });

    // Estrazione del tracciamento dagli header
    const traceHeader = response.headers.get("X-Proxy-Trace");
    let trace: string[] = [];
    try {
      if (traceHeader) trace = JSON.parse(traceHeader);
    } catch (e) {
      console.warn("Impossibile decodificare X-Proxy-Trace");
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      const err = new Error(`Proxy Error [${response.status}]: ${errorText}`);
      (err as any).trace = trace; // Alleghiamo il trace all'errore
      throw err;
    }

    const data = await response.json();
    return { data, trace };
  } catch (error: any) {
    const stackError = new Error(error.message);
    (stackError as any).trace = error.trace || [];
    (stackError as any).originalStack = error.stack;
    throw stackError;
  }
}

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
