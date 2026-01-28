// src/services/newsService.ts
// Correzioni e integrazioni per chiamare un server MCP Streamable HTTP da Node.js (Render)
// - NIENTE proxy CORS (CORS è una policy dei browser)
// - Handshake MCP `initialize` prima di `tools/call`
// - Content negotiation corretta: "Accept: application/json, text/event-stream"
// - Gestione risposta sia JSON che SSE

import { NewsItem, NewsResponse } from '../types';
import { MOCK_INITIAL_NEWS } from '../constants';

// URL del server MCP n8n (Streamable HTTP)
const N8N_MCP_URL = process.env.N8N_MCP_URL || 'https://docker-n8n-xngg.onrender.com/mcp-server/http';

// Token in variabile d'ambiente (Render → Settings → Environment → MCP_TOKEN)
const AUTH_TOKEN = process.env.MCP_TOKEN;

// (Opzionale) Origin da inviare; alcuni server MCP validano l'header Origin anche da client server-side
const FORWARD_ORIGIN = process.env.MCP_FORWARD_ORIGIN || 'https://ai-news-tracker-ii0l.onrender.com';

// Timeout (ms) per richieste MCP; aumenta se i flussi sono lenti
const MCP_TIMEOUT_MS = parseInt(process.env.MCP_TIMEOUT_MS || '60000', 10);

// -------------------------
// Tipi JSON-RPC di supporto
// -------------------------
interface JsonRpcBase { jsonrpc: '2.0'; }
interface JsonRpcRequest extends JsonRpcBase { id: string; method: string; params?: any; }
interface JsonRpcResponse extends JsonRpcBase { id?: string; result?: any; error?: any; }

// ---------------------------------
// Helper: ritaglio e dedup degli SSE
// ---------------------------------
async function readSseUntilResponse(res: Response, targetId?: string): Promise<JsonRpcResponse> {
  if (!res.body) throw new Error('SSE_NO_BODY');
  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  // Regola: nel trasporto MCP Streamable HTTP, il server può inviare uno stream SSE; tra gli eventi
  // deve apparire una risposta JSON-RPC per l'id della richiesta. Se targetId è fornito, ci fermiamo lì.
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // Gli eventi SSE sono separati da doppio newline
    const events = buffer.split('\n\n');
    buffer = events.pop() || '';

    for (const ev of events) {
      // Un evento SSE può contenere più righe, interessa "data: ..."
      const lines = ev.split('\n');
      for (const line of lines) {
        if (line.startsWith('data:')) {
          const jsonStr = line.slice(5).trim();
          if (!jsonStr) continue;
          try {
            const parsed = JSON.parse(jsonStr) as JsonRpcResponse;
            if (parsed?.jsonrpc === '2.0' && (parsed.result !== undefined || parsed.error !== undefined)) {
              if (!targetId || parsed.id === targetId) {
                return parsed;
              }
            }
          } catch {
            // Ignora chunk non-JSON
          }
        }
      }
    }
  }
  throw new Error('SSE_STREAM_ENDED_WITHOUT_RESPONSE');
}

// -----------------------------------
// Helper: esegue una chiamata MCP (POST)
// - Supporta sia risposta JSON che SSE
// -----------------------------------
async function callMcp(request: JsonRpcRequest, init?: { signal?: AbortSignal }): Promise<JsonRpcResponse> {
  if (!AUTH_TOKEN) throw new Error('MCP_TOKEN non impostato (env MCP_TOKEN)');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MCP_TIMEOUT_MS);

  try {
    const res = await fetch(N8N_MCP_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json',
        // Il client MCP deve accettare sia JSON che SSE (specifica Streamable HTTP)
        'Accept': 'application/json, text/event-stream',
        // Opzionale: alcuni server validano Origin anche lato server → forward controllato
        'Origin': FORWARD_ORIGIN,
      },
      body: JSON.stringify(request),
      signal: init?.signal ?? controller.signal,
    });

    const ct = res.headers.get('content-type') || '';
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`HTTP_${res.status} ${text}`);
    }

    if (ct.includes('application/json')) {
      return await res.json();
    }
    if (ct.includes('text/event-stream')) {
      return await readSseUntilResponse(res, request.id);
    }

    throw new Error(`UNSUPPORTED_CONTENT_TYPE ${ct}`);
  } finally {
    clearTimeout(timeout);
  }
}

// -----------------------
// Mapper forniti dall'utente
// -----------------------
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function mapRawToNewsItem(raw: any): NewsItem {
  const title = raw.title || raw.headline || raw.name || 'Titolo AI News';
  const id = raw.id || raw.guid || raw._id || `gen-${simpleHash(title)}`;

  return {
    id: String(id),
    title,
    summary: raw.summary || raw.description || raw.content || 'Dettagli in arrivo dal server...',
    url: raw.url || raw.link || '#',
    source: {
      name: raw.source_name || raw.source?.name || 'MCP LIVE',
      domain: raw.domain || 'n8n.io'
    },
    published_at: raw.published_at || raw.date || new Date().toISOString(),
    fetched_at: new Date().toISOString(),
    tags: Array.isArray(raw.tags) ? raw.tags : (raw.category ? [raw.category] : ['AI']),
    thumbnail: raw.thumbnail || raw.image || '',
    language: raw.language || 'it',
    score: {
      freshness: 1.0,
      relevance: 1.0,
      popularity: 0.5
    }
  };
}

export function dedupeAndSort(arr: NewsItem[]): NewsItem[] {
  const map = new Map<string, NewsItem>();
  for (const it of arr) {
    if (!map.has(it.id)) map.set(it.id, it);
  }
  return Array.from(map.values()).sort((a, b) =>
    new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
  );
}

export function formatTimeAgo(dateString: string): string {
  try {
    const date = new Date(dateString);
    const diff = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diff < 60) return 'ora';
    if (diff < 3600) return `${Math.floor(diff / 60)}m fa`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h fa`;
    return `${Math.floor(diff / 86400)}g fa`;
  } catch { return 'recentemente'; }
}

export function trackTelemetry(event: string, data?: any) {
  console.debug('[Telemetry]', event, data);
}

function createFallbackResponse(reason: string): NewsResponse {
  return {
    generated_at: new Date().toISOString(),
    source_version: `fallback-${reason}`,
    items: dedupeAndSort(MOCK_INITIAL_NEWS),
    paging: { next_cursor: null, count: MOCK_INITIAL_NEWS.length }
  };
}

// -------------------------------------
// API principale: fetchNews (export)
// -------------------------------------
export async function fetchNews(params: { tags?: string[] } = {}): Promise<NewsResponse> {
  const requestId = `req_${Date.now()}`;

  try {
    // 1) Handshake MCP: initialize
    const initResp = await callMcp({
      jsonrpc: '2.0',
      id: `${requestId}_init`,
      method: 'initialize',
      params: {
        clientInfo: { name: 'ai-news-tracker', version: '1.0.0' }
      }
    });

    if (initResp.error) {
      throw new Error(`INIT_ERROR ${JSON.stringify(initResp.error)}`);
    }

    // 2) Chiamata tool
    const callResp = await callMcp({
      jsonrpc: '2.0',
      id: requestId,
      method: 'tools/call',
      params: {
        name: 'get_ai_news',
        arguments: {
          query: params.tags?.[0] || 'AI news',
          limit: 30,
          force_refresh: true,
          request_id: requestId
        }
      }
    });

    if (callResp.error) {
      throw new Error(`TOOLS_CALL_ERROR ${JSON.stringify(callResp.error)}`);
    }

    // 3) Estrazione risultati in modo robusto
    const payload: any = callResp.result ?? callResp;
    let rawItems: any[] = [];

    if (payload?.content && Array.isArray(payload.content)) {
      const textPart = payload.content.find((c: any) => c.type === 'text');
      if (textPart?.text) {
        try {
          const parsed = JSON.parse(textPart.text);
          rawItems = Array.isArray(parsed) ? parsed : (parsed.items || parsed.news || []);
        } catch { /* fallback sotto */ }
      }
    } else if (Array.isArray(payload)) {
      rawItems = payload;
    } else if (payload?.items) {
      rawItems = payload.items;
    }

    if (!rawItems?.length) {
      return {
        generated_at: new Date().toISOString(),
        source_version: 'n8n-live-empty',
        items: [],
        paging: { next_cursor: null, count: 0 }
      };
    }

    return {
      generated_at: new Date().toISOString(),
      source_version: 'n8n-live',
      items: dedupeAndSort(rawItems.map(mapRawToNewsItem)),
      paging: { next_cursor: null, count: rawItems.length }
    };
  } catch (err: any) {
    console.error('[NewsService] Errore fetchNews:', err?.message || err);
    const fallback = createFallbackResponse('mcp-call-failure');
    fallback.source_version += `::${err?.message || 'unknown'}`;
    return fallback;
  }
}
