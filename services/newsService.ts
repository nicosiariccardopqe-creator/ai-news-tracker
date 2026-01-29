
import { NewsResponse } from '../types';

export const MCP_ENDPOINT = '/api/news';
export const STATUS_ENDPOINT = '/api/status';

export interface FetchNewsResult {
  data: NewsResponse & { _proxy_trace?: any[] };
  serverTrace?: any[];
}

/**
 * Il Browser interroga ESCLUSIVAMENTE il server Node locale.
 * Non c'è logica di retry qui: il server Node si occupa di gestire la resilienza verso n8n.
 */
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

  // Estraiamo il trace codificato dal server per scopi diagnostici
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

export async function checkProxyStatus(): Promise<any> {
  const response = await fetch(STATUS_ENDPOINT);
  return await response.json();
}

export function trackTelemetry(event: string, data?: any) { 
  console.debug('[Telemetry]', event, data); 
}
