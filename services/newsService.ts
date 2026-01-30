
import { NewsItem, NewsResponse } from '../types';

export const MCP_ENDPOINT = '/api/news';
export const STATUS_ENDPOINT = '/api/status';

// Helper per ottenere gli header corretti di Supabase
const getSupabaseHeaders = () => ({
  'Content-Type': 'application/json',
  'apikey': process.env.SUPABASE_ANON_KEY || '',
  'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY || ''}`
});

export interface FetchNewsResult {
  data: any;
  serverTrace?: any[];
}

export async function fetchNews(
  params: { tags?: string[] } = {},
  token?: string,
  signal?: AbortSignal
): Promise<FetchNewsResult> {
  const activeToken = token || process.env.MCP_TOKEN || '';

  const response = await fetch(MCP_ENDPOINT, {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "Authorization": `Bearer ${activeToken}`
    },
    body: JSON.stringify({ params, token: activeToken }),
    signal: signal 
  });

  let serverTrace: any[] | undefined;
  const traceHeader = response.headers.get('X-Proxy-Full-Trace');
  if (traceHeader) {
    try {
      serverTrace = JSON.parse(atob(traceHeader));
    } catch (e) {
      console.warn("Impossibile decodificare trace dal server");
    }
  }

  const responseText = await response.text();
  let responseData;
  try {
    responseData = JSON.parse(responseText);
  } catch (e) {
    responseData = { error: responseText };
  }

  if (!response.ok) {
    throw {
      message: responseData.error || `Errore Server Node (${response.status})`,
      status: response.status,
      serverTrace: serverTrace || responseData.trace,
      payload: responseData
    };
  }

  return { 
    data: responseData, 
    serverTrace: serverTrace || responseData._proxy_trace 
  };
}

/**
 * Recupera le news salvate nel database Supabase.
 */
export async function fetchFromSupabase(): Promise<NewsItem[]> {
  const baseUrl = process.env.SUPABASE_URL;
  if (!baseUrl || baseUrl === 'undefined') {
    console.error("Supabase URL non configurata.");
    return [];
  }

  try {
    const url = `${baseUrl}/rest/v1/news?select=*&order=published_at.desc`;
    const response = await fetch(url, {
      method: 'GET',
      headers: getSupabaseHeaders()
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Status ${response.status}: ${errorText}`);
    }
    
    const data = await response.json();
    return data.map((row: any) => ({
      id: row.id,
      title: row.title,
      summary: row.summary,
      url: row.url,
      source: { name: row.source_name, domain: row.source_domain },
      published_at: row.published_at,
      fetched_at: row.fetched_at,
      tags: row.tags || [],
      language: 'it',
      score: { freshness: 1, relevance: 1, popularity: 1 }
    }));
  } catch (err) {
    console.error("Supabase load failed:", err);
    return [];
  }
}

/**
 * Salva le news nel database Supabase usando upsert.
 */
export async function saveToSupabase(items: NewsItem[]): Promise<void> {
  const baseUrl = process.env.SUPABASE_URL;
  if (!baseUrl || items.length === 0) return;

  const rows = items.map(item => ({
    id: item.id,
    title: item.title,
    summary: item.summary,
    url: item.url,
    source_name: item.source.name,
    source_domain: item.source.domain,
    published_at: item.published_at,
    fetched_at: item.fetched_at,
    tags: item.tags
  }));

  try {
    const response = await fetch(`${baseUrl}/rest/v1/news`, {
      method: 'POST',
      headers: {
        ...getSupabaseHeaders(),
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify(rows)
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Supabase save error: ${err}`);
    }
  } catch (err) {
    console.error("Supabase save failed:", err);
  }
}

export async function checkProxyStatus(): Promise<any> {
  const response = await fetch(STATUS_ENDPOINT);
  return await response.json();
}

export function trackTelemetry(event: string, data?: any) { 
  console.debug('[Telemetry]', event, data); 
}
