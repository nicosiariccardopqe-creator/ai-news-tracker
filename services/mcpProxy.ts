
import { Router } from "express";

const router = Router();

const MCP_TARGET = "https://docker-n8n-xngg.onrender.com/mcp-server/http";

// Sleep utility
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function toBase64(obj: any) {
  return Buffer.from(JSON.stringify(obj), "utf8").toString("base64");
}

function safeErr(err: any) {
  return {
    name: err?.name,
    message: err?.message,
    cause: err?.cause ? String(err.cause) : undefined,
  };
}

/**
 * Soluzione A: retry con backoff sui fallimenti di rete/cold-start
 * - attempts: quante volte riprovare
 * - baseTimeoutMs: timeout per tentativo
 */
async function fetchWithRetry(
  url: string,
  init: RequestInit,
  attempts = 3,
  baseTimeoutMs = 60000,
  trace?: string[],
  addTrace?: (msg: string) => void
): Promise<Response> {
  let lastErr: any;

  for (let i = 0; i < attempts; i++) {
    const attemptNo = i + 1;
    const timeoutMs = baseTimeoutMs + i * 15000; // 60s, 75s, 90s
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      addTrace?.(`Tentativo ${attemptNo}/${attempts} (timeout ${timeoutMs}ms)`);
      const res = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timeoutId);

      // Se è 5xx (tipico cold-start / gateway) puoi ritentare
      if (res.status >= 500 && res.status <= 599 && attemptNo < attempts) {
        addTrace?.(`Risposta ${res.status} -> retry (backoff)`);
        await sleep(1000 * attemptNo); // 1s, 2s, 3s
        continue;
      }

      return res;
    } catch (err: any) {
      clearTimeout(timeoutId);
      lastErr = err;

      const isAbort = err?.name === "AbortError";
      addTrace?.(`Errore tentativo ${attemptNo}: ${isAbort ? "Timeout" : "Network"} | ${JSON.stringify(safeErr(err))}`);

      if (attemptNo < attempts) {
        await sleep(1000 * attemptNo); // backoff
        continue;
      }
    }
  }

  throw lastErr;
}

// Endpoint rapido per verificare se il proxy risponde
router.get("/status", (req, res) => {
  res.json({
    status: "online",
    timestamp: new Date().toISOString(),
    env_token_present: !!process.env.MCP_TOKEN,
    node_version: process.version
  });
});

router.post("/news", async (req, res) => {
  const requestId = Math.random().toString(36).substring(7);
  const trace: string[] = [];
  
  const addTrace = (msg: string) => {
    const formatted = `[Server][${requestId}] ${msg}`;
    console.log(formatted);
    trace.push(msg);
  };

  addTrace("INIZIO OPERAZIONE PROXY");
  
  // 1. Ispezione Payload in entrata
  const incomingBody = req.body || {};
  //addTrace(`Payload ricevuto dal frontend: ${JSON.stringify(incomingBody)}`);
  addTrace(`Payload ricevuto dal frontend: ${JSON.stringify({ ...incomingBody, token: incomingBody.token ? "[REDACTED]" : undefined })}`);

  const clientToken = incomingBody.token;
  const envToken = process.env.MCP_TOKEN;
  const finalToken = clientToken || envToken;
  const params = incomingBody.params || {};

  // 2. Valutazione Integrità Dati
  const hasToken = !!finalToken;
  const tokenSource = clientToken ? 'CLIENT_BODY' : (envToken ? 'SERVER_ENV' : 'MISSING');
  
  addTrace(`VALIDAZIONE: [Token: ${hasToken ? 'PRESENTE' : 'MANCANTE'}] [Fonte: ${tokenSource}]`);


  if (!envToken) {
    addTrace("ERRORE CRITICO: MCP_TOKEN mancante nelle variabili d'ambiente.");
    res.setHeader("Access-Control-Expose-Headers", "X-Proxy-Full-Trace");
    res.setHeader("X-Proxy-Full-Trace", toBase64(trace));
    return res.status(500).json({ error: "Server misconfigured: MCP_TOKEN missing", trace });
  }

  if (!finalToken) {
    addTrace("ERRORE CRITICO: Nessun token trovato. La richiesta non può procedere.");
    res.setHeader("X-Proxy-Trace", JSON.stringify(trace));
    return res.status(401).json({ error: "Token MCP mancante", trace });
  }

  try {
    const mcpTarget = "https://docker-n8n-xngg.onrender.com/mcp-server/http";
    const n8nPayload = {
      method: "NewsAI",
      token: finalToken,
      params: params,
    };

    addTrace(`CHIAMATA MCP -> Target: ${mcpTarget}`);
    addTrace(`Intestazioni: Content-Type: application/json, Authorization: Bearer [REDACTED]`);
    addTrace(`Corpo inviato a n8n: ${JSON.stringify(n8nPayload)}`);

    // Utilizziamo un timeout leggermente più basso per il test interno se necessario
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 55000);

    /*const mcpResponse = await fetch(mcpTarget, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${finalToken}`,
      },
      body: JSON.stringify(n8nPayload),
      signal: controller.signal, 
    });*/
    const mcpResponse = await fetchWithRetry(
      MCP_TARGET,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${envToken}`,
        },
        body: JSON.stringify(n8nPayload),
      },
      3,        // attempts
      60000,    // base timeout per attempt
      trace,
      addTrace
    );

    addTrace(`RISPOSTA DA MCP: HTTP ${mcpResponse.status}`);  
    //clearTimeout(timeoutId);
    
    //const contentType = mcpResponse.headers.get("content-type");
    //const responseData = await mcpResponse.text();
    const contentType = mcpResponse.headers.get("content-type") || "application/json";
    const responseText = await mcpResponse.text();

    if (mcpResponse.ok) {
      addTrace("Sincronizzazione completata con successo.");
    } else {
      addTrace(`Avviso: n8n ha restituito un errore: ${responseText.slice(0, 100)}...`);
    }

    res.setHeader("Access-Control-Expose-Headers", "X-Proxy-Trace");
    //res.setHeader("X-Proxy-Trace", JSON.stringify(trace));
    res.setHeader("X-Proxy-Full-Trace", toBase64(trace));
    
    res.status(mcpResponse.status);
    //if (contentType) res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Type", contentType);
    res.send(responseText);

  } catch (err: any) {
    /*const errorMsg = err.name === 'AbortError' ? 'Timeout (n8n non ha risposto in tempo)' : err.message;
    addTrace(`ERRORE DI RETE/PROXY: ${errorMsg}`);
    res.setHeader("Access-Control-Expose-Headers", "X-Proxy-Trace");
    res.setHeader("X-Proxy-Trace", JSON.stringify(trace));
    res.status(502).json({ error: "Proxy Exception", detail: errorMsg, trace });*/
    const isAbort = err?.name === "AbortError";
    const detail = isAbort ? "Timeout (MCP non ha risposto in tempo)" : (err?.message ?? "Network error");

    addTrace(`ERRORE DI RETE/PROXY: ${detail} | ${JSON.stringify(safeErr(err))}`);

    res.setHeader("Access-Control-Expose-Headers", "X-Proxy-Full-Trace");
    res.setHeader("X-Proxy-Full-Trace", toBase64(trace));

    return res.status(502).json({
      error: "N8N_UNREACHABLE",
      detail,
      target: MCP_TARGET,
      trace
    });
  }
});

export default router;
