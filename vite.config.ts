
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
            
            proxyTrace.push(`[PROXY] Richiesta ricevuta dal browser.`);
            
            if (!finalToken) {
              proxyTrace.push(`[PROXY] ERRORE: Token non configurato.`);
              res.statusCode = 401;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: "MCP_TOKEN mancante nel proxy", trace: proxyTrace }));
              return;
            }

            const mcpTarget = "https://docker-n8n-xngg.onrender.com/mcp-server/http";
            const workflowId = env.MCP_WORKFLOWID || "rvpkrwvBbd5NWLMt";

            const n8nPayload = {
              jsonrpc: "2.0",
              id: 4,
              method: "tools/call",
              params: {
                name: "execute_workflow",
                arguments: {
                  workflowId: workflowId,
                  inputs: {
                    type: "chat",
                    chatInput: "Dammi le news su tecnologia e AI"
                  }
                }
              }
            };

            const n8nResponse = await fetch(mcpTarget, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${finalToken}`,
                'Accept': 'application/json, text/event-stream'
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

            res.statusCode = n8nResponse.status;
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('X-Proxy-Full-Trace', Buffer.from(JSON.stringify(proxyTrace)).toString('base64'));
            
            res.end(JSON.stringify({
              ...resultData,
              _proxy_trace: proxyTrace
            }));
          } catch (err: any) {
            res.statusCode = 502;
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
      'process.env.MCP_WORKFLOWID': JSON.stringify(env.MCP_WORKFLOWID || "rvpkrwvBbd5NWLMt"),
      'process.env.SUPABASE_URL': JSON.stringify(env.SUPABASE_URL || 'https://nmpotlkfefjmouceihyv.supabase.co'),
      'process.env.SUPABASE_ANON_KEY': JSON.stringify(env.SUPABASE_ANON_KEY || 'sb_publishable_jmcHWXQAkszRcXBlJgU1Ww_vNyZg2-O'),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
