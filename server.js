import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4000;

app.use(express.json());

// Logger per monitoraggio delle chiamate
app.use((req, res, next) => {
  if (!req.url.startsWith('/assets') && !req.url.includes('.')) {
    console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
  }
  next();
});

// Health Check per monitoraggio stato server
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    config: {
      hasToken: !!process.env.MCP_TOKEN,
      targetUrl: process.env.N8N_MCP_URL || 'https://docker-n8n-xngg.onrender.com/mcp-server/http'
    }
  });
});

// Proxy verso n8n con tracciamento dettagliato per il Log Errori
app.post('/api/mcp/news', async (req, res) => {
  const targetUrl = process.env.N8N_MCP_URL || 'https://docker-n8n-xngg.onrender.com/mcp-server/http';
  const token = process.env.MCP_TOKEN;
  const requestBody = req.body;

  if (!token) {
    return res.status(500).json({ 
      error: 'Configurazione Mancante', 
      message: 'Il token MCP_TOKEN non è configurato sul server Node.',
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
    
    let data;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      data = { error: 'Risposta non JSON ricevuta da n8n', raw: text.substring(0, 200) };
    }

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

// Gestione file statici
const distPath = path.resolve(__dirname, 'dist');
const rootPath = path.resolve(__dirname);

// Serve i file dalla cartella di build se disponibile, altrimenti dalla radice
app.use(express.static(distPath));
app.use(express.static(rootPath));

// Catch-all: serve index.html per le Single Page Application
app.get('*', (req, res) => {
  // Se è una chiamata API non trovata, rispondi 404
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Endpoint API non trovato' });
  }
  
  const distIndex = path.join(distPath, 'index.html');
  const rootIndex = path.join(rootPath, 'index.html');
  
  if (fs.existsSync(distIndex)) {
    res.sendFile(distIndex);
  } else if (fs.existsSync(rootIndex)) {
    res.sendFile(rootIndex);
  } else {
    res.status(500).send("Errore Critico: index.html non trovato nel server.");
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Proxy Server in esecuzione sulla porta ${PORT}`);
  console.log(`🔗 Target n8n: ${process.env.N8N_MCP_URL || 'Default URL'}`);
});