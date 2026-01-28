import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4000;

app.use(express.json());

// Logger per il monitoraggio delle richieste
app.use((req, res, next) => {
  if (!req.url.startsWith('/assets')) {
    console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
  }
  next();
});

// Endpoint di Health Check e Debug
app.get('/api/health', (req, res) => {
  try {
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      node_version: process.version,
      config: {
        hasToken: !!process.env.MCP_TOKEN,
        tokenPrefix: process.env.MCP_TOKEN ? process.env.MCP_TOKEN.substring(0, 10) + '...' : 'null',
        targetUrl: process.env.N8N_MCP_URL || 'https://docker-n8n-xngg.onrender.com/mcp-server/http'
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Health check failed', details: err.message });
  }
});

// Endpoint proxy principale
app.post('/api/mcp/news', async (req, res) => {
  const targetUrl = process.env.N8N_MCP_URL || 'https://docker-n8n-xngg.onrender.com/mcp-server/http';
  const token = process.env.MCP_TOKEN;

  if (!token) {
    console.error('[BACKEND ERROR] MCP_TOKEN non configurato.');
    return res.status(500).json({ 
      error: 'Configurazione Mancante', 
      message: 'Il server Node non ha la variabile d\'ambiente MCP_TOKEN.' 
    });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);

    const formattedToken = token.startsWith('Bearer ') ? token : `Bearer ${token}`;

    const response = await fetch(targetUrl, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Authorization': formattedToken,
        'Content-Type': 'application/json',
        'Accept': 'application/json, application/json-rpc'
      },
      body: JSON.stringify(req.body)
    });

    clearTimeout(timeout);

    const data = await response.json().catch(() => ({ error: 'Invalid JSON response from n8n' }));

    if (!response.ok) {
      console.error(`[N8N ERROR] ${response.status}:`, data);
      return res.status(response.status).json({ 
        error: 'Errore n8n', 
        details: data,
        status: response.status 
      });
    }

    res.status(200).json(data);

  } catch (error) {
    console.error('[FETCH ERROR]:', error.message);
    res.status(502).json({ 
      error: 'Connessione Fallita', 
      message: 'Impossibile raggiungere n8n. Controlla l\'URL.',
      details: error.message 
    });
  }
});

const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 PROXY SERVER RUNNING ON PORT ${PORT}`);
  console.log(`🔗 TARGET: ${process.env.N8N_MCP_URL || 'https://docker-n8n-xngg.onrender.com/mcp-server/http'}`);
  console.log(`🔑 TOKEN: ${process.env.MCP_TOKEN ? 'CONFIGURATO ✅' : 'MANCANTE ❌'}\n`);
});