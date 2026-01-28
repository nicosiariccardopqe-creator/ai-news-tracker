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

  if (!token) {
    return res.status(500).json({ error: 'Configurazione Mancante: MCP_TOKEN non impostato sul server.' });
  }

  try {
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Authorization': token.startsWith('Bearer ') ? token : `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json, application/json-rpc'
      },
      body: JSON.stringify(req.body)
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    console.error('[Backend Error]:', error.message);
    res.status(502).json({ error: 'Errore di connessione verso n8n', details: error.message });
  }
});

// Serve i file statici della build di Vite in produzione
app.use(express.static(path.join(__dirname, 'dist')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`[Server] In ascolto sulla porta ${PORT}`);
  console.log(`[Config] Target n8n: ${process.env.N8N_MCP_URL || 'default'}`);
});
