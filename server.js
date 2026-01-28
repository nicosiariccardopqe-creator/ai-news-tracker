import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4000;

app.use(express.json());

// Logger per monitoraggio
app.use((req, res, next) => {
  if (!req.url.startsWith('/assets')) {
    console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
  }
  next();
});

// Health Check per Render
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    node_version: process.version,
    config: {
      hasToken: !!process.env.MCP_TOKEN,
      targetUrl: process.env.N8N_MCP_URL || 'https://docker-n8n-xngg.onrender.com/mcp-server/http'
    }
  });
});

// Proxy verso n8n
app.post('/api/mcp/news', async (req, res) => {
  const targetUrl = process.env.N8N_MCP_URL || 'https://docker-n8n-xngg.onrender.com/mcp-server/http';
  const token = process.env.MCP_TOKEN;
  const requestBody = req.body;

  if (!token) {
    return res.status(500).json({ 
      error: 'Configurazione Mancante', 
      message: 'MCP_TOKEN non definito nel server Node.',
      trace: {
        step: 'NODE_PROXY',
        targetUrl,
        payloadSent: requestBody
      }
    });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 35000);

    const formattedToken = token.startsWith('Bearer ') ? token : `Bearer ${token}`;

    const response = await fetch(targetUrl, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Authorization': formattedToken,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    clearTimeout(timeout);
    const data = await response.json().catch(() => ({ error: 'Risposta n8n non valida (non JSON)' }));

    if (!response.ok) {
      return res.status(response.status).json({ 
        error: 'Errore n8n', 
        details: data,
        trace: {
          step: 'N8N_SERVER',
          status: response.status,
          targetUrl,
          payloadSent: requestBody,
          rawResponse: data
        }
      });
    }

    res.json(data);
  } catch (error) {
    console.error('[PROXY ERROR]:', error.message);
    const isTimeout = error.name === 'AbortError';
    res.status(isTimeout ? 504 : 502).json({ 
      error: isTimeout ? 'Timeout' : 'Connessione Fallita', 
      message: error.message,
      trace: {
        step: isTimeout ? 'N8N_SERVER_TIMEOUT' : 'NETWORK_FAILURE',
        targetUrl,
        payloadSent: requestBody
      }
    });
  }
});

// Risoluzione dinamica: serve da 'dist' se esiste, altrimenti dalla radice
const distPath = path.resolve(__dirname, 'dist');
const rootPath = path.resolve(__dirname);

app.use(express.static(distPath));
app.use(express.static(rootPath)); // Permette di caricare index.tsx e altri file dalla radice

app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
  
  const distIndex = path.join(distPath, 'index.html');
  const rootIndex = path.join(rootPath, 'index.html');
  
  if (fs.existsSync(distIndex)) {
    res.sendFile(distIndex);
  } else if (fs.existsSync(rootIndex)) {
    res.sendFile(rootIndex);
  } else {
    res.status(500).send("File index.html non trovato nella radice del progetto.");
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Proxy attivo sulla porta ${PORT}`);
});