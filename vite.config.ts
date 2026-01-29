
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Middleware robusto per AI Studio.
 * Intercetta le chiamate /api/ anche se l'URL viene manipolato dai proxy esterni.
 */
const mcpProxyPlugin = (env: Record<string, string>) => ({
  name: 'mcp-proxy-server',
  configureServer(server: any) {
    server.middlewares.use(async (req: any, res: any, next: any) => {
      const url = req.url || '';
      
      // Log per debug nel terminale di Vite
      if (url.includes('/api/')) {
        console.log(`[Vite Middleware] Richiesta rilevata: ${req.method} ${url}`);
      }

      // Gestione flessibile di /api/status
      if (url.includes('/api/status')) {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-store');
        res.end(JSON.stringify({
          status: "online",
          mode: "vite-middleware-robust",
          env_token_present: !!env.MCP_TOKEN,
          timestamp: new Date().toISOString(),
          requested_path: url
        }));
        return;
      }

      // Gestione flessibile di /api/news
      if (url.includes('/api/news') && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk: any) => { body += chunk; });
        req.on('end', async () => {
          try {
            const data = JSON.parse(body || '{}');
            const finalToken = data.token || env.MCP_TOKEN;
            const params = data.params || {};

            if (!finalToken) {
              res.statusCode = 401;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: "MCP_TOKEN mancante nel file .env o nel payload" }));
              return;
            }

            const mcpTarget = "https://docker-n8n-xngg.onrender.com/mcp-server/http";
            const response = await fetch(mcpTarget, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${finalToken}`
              },
              body: JSON.stringify({
                method: "NewsAI",
                token: finalToken,
                params: params
              })
            });

            const result = await response.text();
            res.statusCode = response.status;
            res.setHeader('Content-Type', 'application/json');
            res.end(result);
          } catch (err: any) {
            console.error("[Middleware Error]", err.message);
            res.statusCode = 502;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: "Errore durante l'inoltro a n8n", details: err.message }));
          }
        });
        return;
      }
      
      next();
    });
  }
});

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
      allowedHosts: true,
      strictPort: true,
    },
    plugins: [
      react(),
      mcpProxyPlugin(env)
    ],
    define: {
      'process.env.MCP_TOKEN': JSON.stringify(env.MCP_TOKEN),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
