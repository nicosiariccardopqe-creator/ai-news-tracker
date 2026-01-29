
import { Router } from "express";

const router = Router();
const MCP_TARGET = "https://docker-n8n-xngg.onrender.com/mcp-server/http";

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function toBase64(obj: any) {
  return Buffer.from(JSON.stringify(obj), "utf8").toString("base64");
}

/**
 * LOGICA PROXY SERVER-SIDE
 * Gestisce i tentativi di connessione verso n8n.
 */
async function fetchWithRetry(
  url: string,
  init: RequestInit,
  attempts = 3,
  addTrace: (msg: string) => void
): Promise<Response> {
  let lastErr: any;

  for (let i = 0; i < attempts; i++) {
    const attemptNo = i + 1;
    addTrace(`[Proxy] Tentativo ${attemptNo}/${attempts} verso n8n...`);

    try {
      const res = await fetch(url, init);

      if (res.status >= 500 && attemptNo < attempts) {
        addTrace(`[Proxy] n8n ha risposto ${res.status}. Ritento...`);
        await sleep(1000 * attemptNo);
        continue;
      }

      return res;
    } catch (err: any) {
      lastErr = err;
      addTrace(`[Proxy] Errore di rete verso n8n: ${err.message}`);
      if (attemptNo < attempts) {
        await sleep(1000 * attemptNo);
        continue;
      }
    }
  }
  throw lastErr;
}

router.get("/status", (req, res) => {
  res.json({ status: "online", node: process.version });
});

router.post("/news", async (req, res) => {
  const trace: string[] = [];
  const addTrace = (msg: string) => {
    console.log(`[NODE-SERVER] ${msg}`);
    trace.push(msg);
  };

  addTrace("Richiesta ricevuta dal Browser.");
  
  const { params, token } = req.body;
  const finalToken = token || process.env.MCP_TOKEN;

  if (!finalToken) {
    addTrace("Errore: Token mancante.");
    return res.status(401).json({ error: "Token non configurato sul server" });
  }

  try {
    const n8nPayload = {
      method: "NewsAI",
      token: finalToken,
      params: params || {},
    };

    const n8nResponse = await fetchWithRetry(
      MCP_TARGET,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${finalToken}`,
        },
        body: JSON.stringify(n8nPayload),
      },
      3,
      addTrace
    );

    const responseText = await n8nResponse.text();
    addTrace(`n8n ha risposto con status ${n8nResponse.status}`);

    res.setHeader("X-Proxy-Full-Trace", toBase64(trace));
    res.status(n8nResponse.status).send(responseText);

  } catch (err: any) {
    addTrace(`Eccezione Proxy: ${err.message}`);
    res.setHeader("X-Proxy-Full-Trace", toBase64(trace));
    res.status(502).json({
      error: "N8N_UNREACHABLE",
      detail: err.message,
      trace: trace
    });
  }
});

export default router;
