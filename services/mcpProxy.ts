
import { Router } from "express";

const router = Router();

router.post("/news", async (req, res) => {
  const requestId = Math.random().toString(36).substring(7);
  const trace: string[] = [];
  
  const addTrace = (msg: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const formatted = `[Server][${requestId}] ${msg}`;
    console.log(formatted);
    trace.push(msg); // Memorizziamo solo il messaggio pulito per il client
  };

  addTrace("Ricevuta richiesta proxy");
  
  const clientToken = req.body?.token;
  const envToken = process.env.MCP_TOKEN;
  const finalToken = clientToken || envToken;

  addTrace(`Sorgente Token: ${clientToken ? 'CLIENT_BODY' : (envToken ? 'SERVER_ENV' : 'MANCANTE')}`);

  if (!finalToken) {
    addTrace("ERRORE: Autorizzazione fallita (Token null)");
    res.setHeader("X-Proxy-Trace", JSON.stringify(trace));
    return res.status(401).json({ error: "Token MCP mancante" });
  }

  try {
    const mcpTarget = "https://docker-n8n-xngg.onrender.com/mcp-server/http";
    addTrace(`Inoltro a n8n: ${mcpTarget.split('://')[1]}`);

    const mcpResponse = await fetch(mcpTarget, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${finalToken}`,
      },
      body: JSON.stringify({
        method: "NewsAI",
        token: finalToken,
        params: req.body?.params ?? { tags: [] },
      }),
      signal: AbortSignal.timeout(60000), 
    });

    addTrace(`n8n ha risposto con status: ${mcpResponse.status}`);

    const contentType = mcpResponse.headers.get("content-type");
    const responseData = await mcpResponse.text();

    // Inviamo i log del server nell'header prima di chiudere la risposta
    res.setHeader("Access-Control-Expose-Headers", "X-Proxy-Trace");
    res.setHeader("X-Proxy-Trace", JSON.stringify(trace));
    
    res.status(mcpResponse.status);
    if (contentType) res.setHeader("Content-Type", contentType);
    res.send(responseData);

  } catch (err: any) {
    addTrace(`ECCEZIONE: ${err.message}`);
    res.setHeader("Access-Control-Expose-Headers", "X-Proxy-Trace");
    res.setHeader("X-Proxy-Trace", JSON.stringify(trace));
    res.status(502).json({ error: "Proxy Exception", detail: err.message });
  }
});

export default router;
