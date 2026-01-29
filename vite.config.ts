
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const mcpProxyPlugin = (env: Record<string, string>) => ({
  name: 'mcp-proxy-server',
  configureServer(server: any) {
    server.middlewares.use(async (req: any, res: any, next: any) => {
      const url = req.url || '';
      
      if (url.includes('/api/status')) {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          status: "online",
          mode: "vite-middleware-full-trace",
          env_token_present: !!env.MCP_TOKEN,
          timestamp: new Date().toISOString()
        }));
        return;
      }

      if (url.includes('/api/news') && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk: any) => { body += chunk; });
        req.on('end', async () => {
          const proxyTrace: any[] = [];
          try {
            const data = JSON.parse(body || '{}');
            const finalToken = env.MCP_TOKEN || data.token;
            const params = data.params || {};

            proxyTrace.push(`[PROXY] Richiesta ricevuta per tag: ${JSON.stringify(params.tags || 'TUTTE')}`);

            if (!finalToken) {
              res.statusCode = 401;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: "MCP_TOKEN non trovato", trace: proxyTrace }));
              return;
            }

            const mcpTarget = "https://docker-n8n-xngg.onrender.com/mcp-server/http";
            const n8nPayload = {
              method: "NewsAI",
              token: finalToken,
              params: params
            };

            proxyTrace.push(`[PROXY] Inoltro a n8n: ${mcpTarget}`);

            const n8nResponse = await fetch(mcpTarget, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${finalToken}`
              },
              body: JSON.stringify(n8nPayload)
            });

            const resultText = await n8nResponse.text();
            let resultData;
            try { 
              resultData = JSON.parse(resultText); 
            } catch { 
              resultData = { rawResponse: resultText }; 
            }

            proxyTrace.push(`[PROXY] n8n ha risposto con status ${n8nResponse.status}`);

            res.statusCode = n8nResponse.status;
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('X-Proxy-Full-Trace', Buffer.from(JSON.stringify(proxyTrace)).toString('base64'));
            
            // Garantiamo che la risposta sia sempre un oggetto JSON valido
            const finalBody = typeof resultData === 'object' && resultData !== null 
              ? { ...resultData, _proxy_trace: proxyTrace }
              : { data: resultData, _proxy_trace: proxyTrace };

            res.end(JSON.stringify(finalBody));
          } catch (err: any) {
            proxyTrace.push(`[PROXY] ERRORE CRITICO: ${err.message}`);
            res.statusCode = 502;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: "Proxy Exception", details: err.message, trace: proxyTrace }));
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
