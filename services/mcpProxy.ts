
import { Router } from "express";

const router = Router();

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
  const hasParams = !!incomingBody.params;
  const tokenSource = clientToken ? 'CLIENT_BODY' : (envToken ? 'SERVER_ENV' : 'MISSING');
  
  addTrace(`VALIDAZIONE DATI: [Token: ${hasToken ? 'PRESENT' : 'MISSING'}] [Params: ${hasParams ? 'PRESENT' : 'MISSING'}]`);
  addTrace(`Sorgente Identificata Token: ${tokenSource}`);

  if (!finalToken) {
    addTrace("ERRORE CRITICO: Impossibile procedere senza token di autorizzazione.");
    res.setHeader("X-Proxy-Trace", JSON.stringify(trace));
    return res.status(401).json({ error: "Token MCP mancante per la richiesta" });
  }

  try {
    const mcpTarget = "https://docker-n8n-xngg.onrender.com/mcp-server/http";
    
    // 3. Preparazione Payload per n8n
    const n8nPayload = {
      method: "NewsAI",
      token: finalToken,
      params: params,
    };

    addTrace(`PREPARAZIONE CHIAMATA MCP: Inoltro verso ${mcpTarget.split('://')[1]}`);
    addTrace(`Payload in uscita verso n8n: ${JSON.stringify(n8nPayload)}`);

    const mcpResponse = await fetch(mcpTarget, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${finalToken}`,
      },
      body: JSON.stringify(n8nPayload),
      signal: AbortSignal.timeout(60000), 
    });

    addTrace(`RISPOSTA MCP RICEVUTA: Status ${mcpResponse.status} ${mcpResponse.statusText}`);

    const contentType = mcpResponse.headers.get("content-type");
    const responseData = await mcpResponse.text();

    // Inviamo i log del server nell'header
    res.setHeader("Access-Control-Expose-Headers", "X-Proxy-Trace");
    res.setHeader("X-Proxy-Trace", JSON.stringify(trace));
    
    res.status(mcpResponse.status);
    if (contentType) res.setHeader("Content-Type", contentType);
    res.send(responseData);

  } catch (err: any) {
    addTrace(`ECCEZIONE DURANTE L'INOLTRO: ${err.message}`);
    res.setHeader("Access-Control-Expose-Headers", "X-Proxy-Trace");
    res.setHeader("X-Proxy-Trace", JSON.stringify(trace));
    res.status(502).json({ error: "Proxy Exception", detail: err.message });
  }
});

export default router;
