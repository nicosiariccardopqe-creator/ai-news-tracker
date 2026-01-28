
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4000;

app.use(express.json());

// Logger semplificato
app.use((req, res, next) => {
  if (!req.url.startsWith('/assets') && !req.url.includes('.')) {
    console.log(`[Static Server] ${req.method} ${req.url}`);
  }
  next();
});

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
  console.log(`🚀 Web Server statico attivo sulla porta ${PORT}`);
});
