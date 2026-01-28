import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { Buffer } from 'buffer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  // Token per l'autenticazione n8n MCP
  const mcpToken = env.MCP_TOKEN || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJlMWE5NjRkZi02ZDMzLTRkZGUtOTI3Yi05NGQ0ZjMwNmM1Y2YiLCJpc3MiOiJuOG4iLCJhdWQiOiJtY3Atc2VydmVyLWFwaSIsImp0aSI6ImQzMjdmNzkxLTExOWMtNDUzYi1iNmU0LWM4MWFhNGE3MzNkZSIsImlhdCI6MTc2OTUyMzU4N30.7u2MS7h9dhEIQ6LaOciT8xvYUxmeLoRYS4Mw_t9K2C0';

  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
      allowedHosts: true,
      proxy: {
        '/api/news': {
          target: 'https://docker-n8n-xngg.onrender.com',
          changeOrigin: true,
          secure: true,
          // Rimosso il rewrite esterno per gestire tutto via proxyReq per precisione assoluta
          configure: (proxy: any) => {
            proxy.on('proxyReq', (proxyReq: any, req: any) => {
              // Estraiamo la query per il payload MCP
              let searchQuery = 'AI news';
              try {
                const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
                searchQuery = url.searchParams.get('q') || 'AI news';
              } catch (e) {
                searchQuery = 'AI news';
              }

              // Configurazione richiesta POST verso n8n MCP
              proxyReq.method = 'POST';
              
              // Spesso sui server dedicati Render l'MCP bridge risponde sulla root '/'
              // Se '/mcp/http' ha dato problemi, forziamo la root qui
              proxyReq.path = '/'; 
              
              proxyReq.setHeader('Authorization', `Bearer ${mcpToken}`);
              proxyReq.setHeader('Content-Type', 'application/json');
              // Risoluzione errore 406: accettiamo entrambi i tipi richiesti dal server
              proxyReq.setHeader('Accept', 'application/json, application/json-rpc');

              const mcpRequest = {
                jsonrpc: '2.0',
                id: `req_${Date.now()}`,
                method: 'tools/call',
                params: {
                  name: 'get_ai_news',
                  arguments: {
                    query: searchQuery,
                    limit: 30,
                    force_refresh: true
                  }
                }
              };

              const body = JSON.stringify(mcpRequest);
              proxyReq.setHeader('Content-Length', Buffer.byteLength(body));
              
              proxyReq.write(body);
              proxyReq.end();
            });

            proxy.on('error', (err: any, _req: any, res: any) => {
              console.error('[ViteProxy] Errore critico:', err.message);
              if (!res.headersSent) {
                res.writeHead(502, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Proxy Failure', details: err.message }));
              }
            });
          }
        }
      }
    },
    preview: {
      port: 3000,
      host: '0.0.0.0',
      allowedHosts: true,
      proxy: {
        '/api/news': {
          target: 'https://docker-n8n-xngg.onrender.com',
          changeOrigin: true,
          secure: true,
          configure: (proxy: any) => {
            proxy.on('proxyReq', (proxyReq: any, req: any) => {
              proxyReq.method = 'POST';
              proxyReq.path = '/';
              proxyReq.setHeader('Authorization', `Bearer ${mcpToken}`);
              proxyReq.setHeader('Content-Type', 'application/json');
              proxyReq.setHeader('Accept', 'application/json, application/json-rpc');
              const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
              const q = url.searchParams.get('q') || 'AI news';
              const body = JSON.stringify({
                jsonrpc: '2.0', id: Date.now(), method: 'tools/call',
                params: { name: 'get_ai_news', arguments: { query: q, limit: 30 } }
              });
              proxyReq.setHeader('Content-Length', Buffer.byteLength(body));
              proxyReq.write(body);
              proxyReq.end();
            });
          }
        }
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