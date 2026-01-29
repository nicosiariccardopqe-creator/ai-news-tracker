
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
// Importiamo il proxy (Assicurati che l'ambiente supporti il caricamento di file .ts o usa il percorso compilato se necessario)
// In questo ambiente AI Studio, carichiamo direttamente la logica del proxy.
import mcpProxyRouter from './services/mcpProxy.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4000;

app.use(express.json());

// Logger per le richieste API
app.use((req, res, next) => {
  if (req.url.startsWith('/api')) {
    console.log(`[API Request] ${req.method} ${req.url}`);
  }
  next();
});

// Montiamo il router del proxy sulla rotta /api
app.use('/api', mcpProxyRouter);

const distPath = path.resolve(__dirname, 'dist');
const rootPath = path.resolve(__dirname);

app.use(express.static(distPath));
app.use(express.static(rootPath));

app.get('*', (req, res) => {
  const distIndex = path.join(distPath, 'index.html');
  const rootIndex = path.join(rootPath, 'index.html');
  
  if (fs.existsSync(distIndex)) {
    res.sendFile(distIndex);
  } else if (fs.existsSync(rootIndex)) {
    res.sendFile(rootIndex);
  } else {
    res.status(500).send("index.html non trovato.");
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server attivo sulla porta ${PORT}`);
  console.log(`📡 Proxy MCP configurato su /api/news`);
});
