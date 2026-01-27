
import { NewsItem, NewsResponse } from '../types';
import { MOCK_INITIAL_NEWS } from '../constants';

/**
 * Simulates a call to the n8n backend or a local storage cache.
 * In a real app, this would be: fetch(`/api/news?${params}`)
 */
export async function fetchNews(params: { tags?: string[]; source?: string } = {}): Promise<NewsResponse> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 1500));

  // Simulating an error 10% of the time for testing robust UI
  if (Math.random() < 0.05) {
    throw new Error('UPSTREAM_UNAVAILABLE');
  }

  let items = [...MOCK_INITIAL_NEWS];

  // Filtering logic
  if (params.tags && params.tags.length > 0 && !params.tags.includes('Tutti')) {
    items = items.filter(item => item.tags.some(tag => params.tags?.includes(tag)));
  }

  if (params.source && params.source !== 'Tutte') {
    items = items.filter(item => item.source.name === params.source);
  }

  // Simulate "new" items on refresh by occasionally adding one
  if (Math.random() > 0.5) {
    const newItem: NewsItem = {
      id: Math.random().toString(36).substr(2, 9),
      title: `News Aggiornata: Breakthrough nel campo ${params.tags?.[0] || 'AI'}`,
      summary: 'Una scoperta dell\'ultima ora promette di cambiare radicalmente l\'approccio allo scaling dei modelli attuali. I ricercatori hanno osservato comportamenti emergenti inaspettati.',
      url: 'https://example.com/breaking-news',
      source: { name: 'AI Pulse News', domain: 'aipulse.ai' },
      published_at: new Date().toISOString(),
      fetched_at: new Date().toISOString(),
      tags: params.tags && params.tags.length > 0 && params.tags[0] !== 'Tutti' ? [params.tags[0]] : ['Trend'],
      thumbnail: `https://picsum.photos/seed/${Math.random()}/800/450`,
      language: 'it',
      score: { freshness: 1.0, relevance: 0.9, popularity: 0.5 }
    };
    items.unshift(newItem);
  }

  const processedItems = dedupeAndSort(items);

  return {
    generated_at: new Date().toISOString(),
    source_version: 'n8n:ai-news-v1.2-sim',
    items: processedItems,
    paging: {
      next_cursor: null,
      count: processedItems.length
    }
  };
}

export function dedupeAndSort(arr: NewsItem[]): NewsItem[] {
  const map = new Map<string, NewsItem>();
  for (const it of arr) {
    // Deduplication key: normalized title + domain
    const key = `${(it.title || '').trim().toLowerCase()}|${(it.source?.domain || '').toLowerCase()}`;
    
    if (!map.has(key)) {
      map.set(key, it);
    } else {
      // Keep the most recent version
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

export function trackTelemetry(event: 'cta_refresh_clicked' | 'news_impression' | 'news_click_out' | 'filter_applied' | 'error_shown', data?: any) {
  const telemetry = {
    event,
    timestamp: new Date().toISOString(),
    data
  };
  console.log('[Telemetry]', telemetry);
  // In a real app, send to a tracking endpoint
}
