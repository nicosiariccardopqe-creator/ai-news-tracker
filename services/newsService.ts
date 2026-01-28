
import { NewsItem, NewsResponse } from '../types';
import { MOCK_INITIAL_NEWS } from '../constants';

/**
 * Servizio News semplificato. 
 * Rimosso il supporto a /api/mcp/news per operare in modalità locale/statica.
 */
export async function fetchNews(params: { tags?: string[] } = {}): Promise<NewsResponse> {
  // Simuliamo un leggero ritardo di caricamento per l'UX
  await new Promise(resolve => setTimeout(resolve, 600));

  const activeTag = params.tags?.[0] || 'TUTTE';
  
  let filtered = MOCK_INITIAL_NEWS;
  if (activeTag !== 'TUTTE') {
    filtered = MOCK_INITIAL_NEWS.filter(item => 
      item.tags.some(t => t.toUpperCase() === activeTag.toUpperCase())
    );
  }

  return {
    generated_at: new Date().toISOString(),
    source_version: 'local-static-v1',
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
