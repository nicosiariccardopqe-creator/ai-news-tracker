
import { NewsItem, NewsResponse } from '../types';

export const MCP_ENDPOINT = '/api/news';
export const STATUS_ENDPOINT = '/api/status';

export interface FetchNewsResult {
  data: NewsResponse & { _proxy_trace?: any[] };
  serverTrace?: any[];
}

export async function checkProxyStatus(): Promise<any> {
  const response = await fetch(STATUS_ENDPOINT);
  if (!response.ok) {
    throw new Error(`Endpoint ${STATUS_ENDPOINT} non raggiungibile (HTTP ${response.status})`);
  }
  return await response.json();
}

export async function fetchNews(
  params: { tags?: string[] } = {},
  signal?: AbortSignal
): Promise<FetchNewsResult> {
  const activeToken = token || process.env.MCP_TOKEN || '';

  const response = await fetch(MCP_ENDPOINT, {
    method: "POST",
    headers: { 
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ params, token: activeToken }),
    signal: signal 
  });

  // Estraiamo il trace dall'header se presente (codificato in base64 per sicurezza caratteri)
  let serverTrace: any[] | undefined;
  const traceHeader = response.headers.get('X-Proxy-Full-Trace');
  if (traceHeader) {
    try {
      serverTrace = JSON.parse(atob(traceHeader));
    } catch (e) {
      console.warn("Impossibile decodificare X-Proxy-Full-Trace");
    }
  }

  if (!response.ok) {
    const errorText = await response.text();
    let errorData;
    try { errorData = JSON.parse(errorText); } catch { errorData = { error: errorText }; }
    
    throw {
      message: errorData.error || "Errore comunicazione Proxy",
      status: response.status,
      serverTrace: serverTrace || errorData.trace,
      payload: errorData
    };
  }

  const data = await response.json();
  return { data, serverTrace: serverTrace || data._proxy_trace };
}

export function trackTelemetry(event: string, data?: any) { 
  console.debug('[Telemetry]', event, data); 
}
