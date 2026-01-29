
import { Router } from "express";

const router = Router();

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
  addTrace(`Payload ricevuto dal frontend: ${JSON.stringify(incomingBody)}`);

  const clientToken = incomingBody.token;
  const envToken = process.env.MCP_TOKEN;
  const finalToken = clientToken || envToken;
  const params = incomingBody.params || {};

  // 2. Valutazione Integrità Dati
  const hasToken = !!finalToken;
  const tokenSource = clientToken ? 'CLIENT_BODY' : (envToken ? 'SERVER_ENV' : 'MISSING');
  
  addTrace(`VALIDAZIONE: [Token: ${hasToken ? 'PRESENTE' : 'MANCANTE'}] [Fonte: ${tokenSource}]`);

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

    const mcpResponse = await fetch(mcpTarget, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${finalToken}`,
      },
      body: JSON.stringify(n8nPayload),
      signal: controller.signal, 
    });

    clearTimeout(timeoutId);

    addTrace(`RISPOSTA DA N8N: HTTP ${mcpResponse.status}`);
    
    const contentType = mcpResponse.headers.get("content-type");
    const responseData = await mcpResponse.text();

    if (mcpResponse.ok) {
      addTrace("Sincronizzazione completata con successo.");
    } else {
      addTrace(`Avviso: n8n ha restituito un errore: ${responseData.slice(0, 100)}...`);
    }

    res.setHeader("Access-Control-Expose-Headers", "X-Proxy-Trace");
    res.setHeader("X-Proxy-Trace", JSON.stringify(trace));
    
    res.status(mcpResponse.status);
    if (contentType) res.setHeader("Content-Type", contentType);
    res.send(responseData);

  } catch (err: any) {
    const errorMsg = err.name === 'AbortError' ? 'Timeout (n8n non ha risposto in tempo)' : err.message;
    addTrace(`ERRORE DI RETE/PROXY: ${errorMsg}`);
    res.setHeader("Access-Control-Expose-Headers", "X-Proxy-Trace");
    res.setHeader("X-Proxy-Trace", JSON.stringify(trace));
    res.status(502).json({ error: "Proxy Exception", detail: errorMsg, trace });
  }
});

export default router;
