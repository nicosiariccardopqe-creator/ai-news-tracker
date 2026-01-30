
import { Router } from "express";

const router = Router();
const MCP_TARGET = "https://docker-n8n-xngg.onrender.com/mcp-server/http";

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function toBase64(obj: any) {
  return Buffer.from(JSON.stringify(obj), "utf8").toString("base64");
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  attempts = 3,
  addTrace: (msg: string) => void
): Promise<Response> {
  let lastErr: any;

  for (let i = 0; i < attempts; i++) {
    const attemptNo = i + 1;
    addTrace(`[Proxy Server] Tentativo ${attemptNo}/${attempts} verso n8n...`);

    try {
      const res = await fetch(url, init);
      if (res.status >= 500 && attemptNo < attempts) {
        addTrace(`[Proxy Server] n8n ha risposto ${res.status}. Ritento...`);
        await sleep(1000 * attemptNo);
        continue;
      }
      return res;
    } catch (err: any) {
      lastErr = err;
      addTrace(`[Proxy Server] Errore di rete verso n8n: ${err.message}`);
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
    console.log(`[NODE-LOG] ${msg}`);
    trace.push(msg);
  };

  addTrace("Richiesta POST ricevuta dal Browser.");
  
  const { params, token } = req.body;
  const finalToken = token || process.env.MCP_TOKEN;

  if (!finalToken) {
    addTrace("Errore: Token non configurato sul server.");
    return res.status(401).json({ error: "Token non configurato sul server" });
  }

  try {
    // Struttura payload conforme a JSON-RPC 2.0 come da curl
    const n8nPayload = {
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: {
        name: "execute_workflow",
        arguments: {
          workflowId: process.env.MCP_WORKFLOWID,
          inputs: {
            type: "chat",
            chatInput: "Dammi le news su tecnologia e AI"
          }
        }
      }
    };

    // Mascheramento per i log: primi 20 caratteri .. ultimi 5
    const maskedToken = finalToken.length > 25 
      ? `${finalToken.substring(0, 20)}..${finalToken.slice(-5)}` 
      : finalToken;

    const headersLog = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${maskedToken}`,
      "Accept": "application/json, text/event-stream"
    };

    const logPayload = {
      ...n8nPayload,
      _debug_auth: `Bearer ${maskedToken}`
    };

    addTrace(`=== PREPARAZIONE CHIAMATA N8N (JSON-RPC) ===`);
    addTrace(`-> JSON-RPC Method: ${n8nPayload.method}`);
    addTrace(`-> Headers: ${JSON.stringify(headersLog)}`);
    addTrace(`-> Full Payload (Masked Token): ${JSON.stringify(logPayload)}`);
    addTrace(`-> Target: ${MCP_TARGET}`);
    addTrace(`=================================`);

    const n8nResponse = await fetchWithRetry(
      MCP_TARGET,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json, text/event-stream",
          "Authorization": `Bearer ${finalToken}`
        },
        body: JSON.stringify(n8nPayload),
      },
      3,
      addTrace
    );

    const responseText = await n8nResponse.text();
    addTrace(`n8n risposta ricevuta. Status: ${n8nResponse.status}`);

    res.setHeader("X-Proxy-Full-Trace", toBase64(trace));
    res.status(n8nResponse.status).send(responseText);

  } catch (err: any) {
    addTrace(`ECCEZIONE NEL PROXY: ${err.message}`);
    res.setHeader("X-Proxy-Full-Trace", toBase64(trace));
    res.status(502).json({
      error: "N8N_UNREACHABLE",
      detail: err.message,
      trace: trace
    });
  }
});

export default router;
