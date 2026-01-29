
import { NewsItem, NewsResponse } from '../types';
import { MOCK_INITIAL_NEWS } from '../constants';

// Percorsi relativi che verranno intercettati dal Service Worker
export const MCP_ENDPOINT = '/api/news';
export const STATUS_ENDPOINT = '/api/status';

export interface FetchNewsResult {
  data: NewsResponse;
  trace: string[];
}

/**
 * Verifica se il proxy (Service Worker) risponde
 */
export async function checkProxyConnectivity(): Promise<any> {
  console.log(`[Diagnostic] Test su: ${STATUS_ENDPOINT}`);
  
  // Attendiamo che il SW sia attivo se necessario
  if ('serviceWorker' in navigator) {
    await navigator.serviceWorker.ready;
  }

  const response = await fetch(STATUS_ENDPOINT);
  if (!response.ok) {
    throw new Error(`Proxy (SW) risponde con errore ${response.status}`);
  }
  return await response.json();
}

/**
 * Tenta una chiamata diretta a n8n per debug
 */
export async function testDirectConnectivity(): Promise<boolean> {
  try {
    const target = "https://docker-n8n-xngg.onrender.com/mcp-server/http";
    const res = await fetch(target, { method: 'OPTIONS' });
    return res.ok || res.status === 405; // 405 è OK per OPTIONS se CORS è parziale
  } catch (e) {
    return false;
  }
}

/**
 * Recupera le news. La chiamata viene intercettata dal Service Worker in sw.js
 */
export async function fetchNews(params: { tags?: string[] } = {}, token?: string): Promise<FetchNewsResult> {
  try {
    const response = await fetch(MCP_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ params, token }),
    });

    if (!response.ok) {
      throw new Error(`Errore API [${response.status}]`);
    }

    const data = await response.json();
    return { data, trace: ["Richiesta gestita da Service Worker Proxy"] };
  } catch (error: any) {
    throw new Error(error.message);
  }
}

export async function fetchMockNews(params: { tags?: string[] } = {}): Promise<NewsResponse> {
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
    source_version: 'local-fallback-v2',
    items: filtered,
    paging: { next_cursor: null, count: filtered.length }
  };
}

export function trackTelemetry(event: string, data?: any) { 
  console.debug('[Telemetry]', event, data); 
}
