import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { Buffer } from 'buffer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Domini consentiti (aggiungi qui il tuo dominio Render)
const ALLOWED_HOSTS = ['ai-news-tracker-ii0l.onrender.com'];

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  // ⚠️ Non mettere il token MCP qui in chiaro (front-end). Lascia vuoto o leggi da env solo in dev.
  const mcpToken = env.MCP_TOKEN || '';

  const createProxyConfig = () => ({
    target: 'https://docker-n8n-xngg.onrender.com',
    changeOrigin: true,
    secure: true, // HTTPS pubblico su Render: tienilo true
    // /api/news sul front → /mcp-server/http su n8n MCP
    rewrite: (_p) => '/mcp-server/http',
    configure: (proxy) => {
      proxy.on('proxyReq', (proxyReq, req) => {
        // MCP richiede POST al singolo endpoint
        proxyReq.method = 'POST';
        if (mcpToken) {
          proxyReq.setHeader('Authorization', `Bearer ${mcpToken}`);
        }
        proxyReq.setHeader('Content-Type', 'application/json');
        proxyReq.setHeader('Accept', 'application/json, text/event-stream');

        // Query → parametro per il tool n8n
        let query = 'AI news';
        try {
          const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
          query = url.searchParams.get('q') || 'AI news';
        } catch (e) {
          console.warn('[ViteProxy] Errore estrazione query:', e);
        }

        const mcpRequest = {
          jsonrpc: '2.0',
          id: `v_${Date.now()}`,
          method: 'tools/call',
          params: {
            name: 'get_ai_news',
            arguments: { query, limit: 30, force_refresh: true }
          }
        };

        const body = JSON.stringify(mcpRequest);
        proxyReq.setHeader('Content-Length', Buffer.byteLength(body));
        proxyReq.write(body);
        proxyReq.end();
      });

      proxy.on('error', (err, _req, res) => {
        console.error('[ViteProxy] Errore:', err.message);
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Proxy Error', details: err.message }));
        }
      });
    }
  });

  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
      // 👇 Consenti l’host di Render
      allowedHosts: ALLOWED_HOSTS,
      proxy: {
        '/api/news': createProxyConfig()
      }
      // (Opzionale) Se ti serve assolutamente un origin fisso nei link generati:
      // origin: 'https://ai-news-tracker-ii0l.onrender.com'
    },
    preview: {
      port: 3000,
      host: '0.0.0.0',
      // 👇 Anche in preview
      allowedHosts: ALLOWED_HOSTS,
      proxy: {
        '/api/news': createProxyConfig()
      }
    },
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});