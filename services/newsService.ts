
import { NewsItem, NewsResponse } from '../types';
import { MOCK_INITIAL_NEWS } from '../constants';

// Percorsi relativi gestiti dal Middleware Proxy di Vite
export const MCP_ENDPOINT = '/api/news';
export const STATUS_ENDPOINT = '/api/status';

export interface FetchNewsResult {
  data: NewsResponse;
  trace: string[];
}

/**
 * STEP 1 & 2: Verifica l'endpoint locale e lo stato del Proxy
 */
export async function checkProxyStatus(): Promise<any> {
  const response = await fetch(STATUS_ENDPOINT);
  if (!response.ok) {
    throw new Error(`Endpoint ${STATUS_ENDPOINT} non raggiungibile (HTTP ${response.status})`);
  }
  return await response.json();
}

/**
 * STEP 3: Recupera le news attraverso il Proxy (Endpoint -> Proxy -> n8n)
 */
export async function fetchNews(
  params: { tags?: string[] } = {}, 
  token?: string, 
  signal?: AbortSignal
): Promise<FetchNewsResult> {
  // Usiamo il token passato come argomento o quello presente nel contesto di processo (iniettato da Vite)
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

  if (!response.ok) {
    let detail = "Errore durante la comunicazione col Proxy";
    try {
      const errorData = await response.json();
      detail = errorData.error || errorData.details || JSON.stringify(errorData);
    } catch (e) {
      detail = await response.text();
    }
    throw new Error(`[Proxy Error ${response.status}] ${detail}`);
  }

  const data = await response.json();
  return { data, trace: ["Flusso: Browser -> Endpoint -> Proxy -> n8n completato"] };
}

export function trackTelemetry(event: string, data?: any) { 
  console.debug('[Telemetry]', event, data); 
}
