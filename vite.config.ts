
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Middleware robusto per AI Studio.
 * Intercetta le chiamate /api/ e inoltra a n8n con il token di sessione.
 */
const mcpProxyPlugin = (env: Record<string, string>) => ({
  name: 'mcp-proxy-server',
  configureServer(server: any) {
    server.middlewares.use(async (req: any, res: any, next: any) => {
      const url = req.url || '';
      
      // STEP 1: Browser chiama Endpoint
      if (url.includes('/api/status')) {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          status: "online",
          mode: "vite-middleware-3step",
          env_token_present: !!env.MCP_TOKEN,
          timestamp: new Date().toISOString()
        }));
        return;
      }

      // STEP 2 & 3: Endpoint chiama Proxy -> Proxy chiama n8n
      if (url.includes('/api/news') && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk: any) => { body += chunk; });
        req.on('end', async () => {
          try {
            const data = JSON.parse(body || '{}');
            // Priorità al token in env se disponibile, per sicurezza
            const finalToken = env.MCP_TOKEN || data.token;
            const params = data.params || {};

            if (!finalToken) {
              res.statusCode = 401;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: "MCP_TOKEN non configurato nel server" }));
              return;
            }

            const mcpTarget = "https://docker-n8n-xngg.onrender.com/mcp-server/http";
            
            // LOGICA DI INIEZIONE TOKEN RICHIESTA
            const n8nPayload = {
              method: "NewsAI",
              token: finalToken,
              params: params
            };

            const response = await fetch(mcpTarget, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${finalToken}`
              },
              body: JSON.stringify(n8nPayload)
            });

            const result = await response.text();
            res.statusCode = response.status;
            res.setHeader('Content-Type', 'application/json');
            res.end(result);
          } catch (err: any) {
            res.statusCode = 502;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: "Proxy Exception", details: err.message }));
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
