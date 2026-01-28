import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4000;

app.use(express.json());

// Endpoint API sicuro per il frontend
app.post('/api/mcp/news', async (req, res) => {
  const targetUrl = process.env.N8N_MCP_URL || 'https://docker-n8n-xngg.onrender.com/mcp-server/http';
  const token = process.env.MCP_TOKEN;

  console.log(`[Backend] Ricevuta richiesta per query: ${req.body.params?.arguments?.query || 'N/A'}`);

  if (!token) {
    console.error('[Backend Error] MCP_TOKEN non configurato.');
    return res.status(500).json({ error: 'Configurazione Mancante: MCP_TOKEN non impostato sul server.' });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30 secondi di timeout

    const response = await fetch(targetUrl, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Authorization': token.startsWith('Bearer ') ? token : `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json, application/json-rpc'
      },
      body: JSON.stringify(req.body)
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'No body');
      console.error(`[Backend Error] n8n ha risposto con ${response.status}: ${errorText}`);
      return res.status(response.status).json({ error: 'Errore dal server n8n', details: errorText });
    }

    const data = await response.json();
    console.log(`[Backend] Risposta ricevuta correttamente da n8n.`);
    res.status(response.status).json(data);
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error('[Backend Error] La richiesta a n8n è andata in timeout.');
      res.status(504).json({ error: 'Timeout connessione n8n' });
    } else {
      console.error('[Backend Error] Errore critico di rete:', error.message);
      res.status(502).json({ error: 'Errore di connessione verso n8n', details: error.message });
    }
  }
});

// Serve i file statici della build di Vite in produzione
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

// Rotta catch-all per SPA (Single Page Application)
app.get('*', (req, res) => {
  // Evita di servire index.html se la richiesta cercava un'API non esistente
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API Endpoint not found' });
  }
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`[Server Ready] In ascolto sulla porta ${PORT}`);
  console.log(`[Config Check] Target n8n URL: ${process.env.N8N_MCP_URL || 'https://docker-n8n-xngg.onrender.com/mcp-server/http'}`);
  console.log(`[Config Check] Token Presente: ${process.env.MCP_TOKEN ? 'SI' : 'NO'}`);
});
