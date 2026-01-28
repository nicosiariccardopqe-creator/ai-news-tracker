import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { Buffer } from 'buffer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  // Il token viene usato solo lato server dal proxy di Vite
  const mcpToken = env.MCP_TOKEN || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJlMWE5NjRkZi02ZDMzLTRkZGUtOTI3Yi05NGQ0ZjMwNmM1Y2YiLCJpc3MiOiJuOG4iLCJhdWQiOiJtY3Atc2VydmVyLWFwaSIsImp0aSI6ImQzMjdmNzkxLTExOWMtNDUzYi1iNmU0LWM4MWFhNGE3MzNkZSIsImlhdCI6MTc2OTUyMzU4N30.7u2MS7h9dhEIQ6LaOciT8xvYUxmeLoRYS4Mw_t9K2C0';

  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
      allowedHosts: true, // Risolve "Host Blocked" su Render
      proxy: {
        '/api/news': {
          target: 'https://docker-n8n-xngg.onrender.com',
          changeOrigin: true,
          secure: false,
          // Forza il path esatto verso l'endpoint MCP di n8n, 
          // ignorando i parametri query originali nel path inoltrato
          rewrite: () => '/mcp-server/http',
          configure: (proxy: any) => {
            proxy.on('proxyReq', (proxyReq: any, req: any) => {
              // Estraiamo la query dall'URL originale (req.url) prima che venga riscritta
              let searchQuery = 'AI news';
              try {
                const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
                searchQuery = url.searchParams.get('q') || 'AI news';
              } catch (e) {
                console.warn('[ViteProxy] Errore estrazione query:', e);
              }

              // Trasformiamo la GET in POST per l'interfaccia MCP
              proxyReq.method = 'POST';
              proxyReq.setHeader('Authorization', `Bearer ${mcpToken}`);
              proxyReq.setHeader('Content-Type', 'application/json');
              proxyReq.setHeader('Accept', 'application/json');

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
              
              // Scriviamo il body direttamente nel proxy stream.
              // Poiché la richiesta originale è una GET, non ci sono dati che collidono.
              proxyReq.write(body);
              // Non chiamiamo proxyReq.end() qui se vogliamo che il middleware gestisca il piping standard,
              // ma per una GET->POST con body iniettato, è sicuro farlo o lasciare che finisca.
              // node-http-proxy lo gestirà correttamente.
            });

            proxy.on('error', (err: any, _req: any, res: any) => {
              console.error('[ViteProxy] Errore di inoltro:', err.message);
              if (!res.headersSent) {
                res.writeHead(502, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Proxy Gateway Error', details: err.message }));
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
          secure: false,
          rewrite: () => '/mcp-server/http',
          configure: (proxy: any) => {
            // Stessa configurazione del server dev
            proxy.on('proxyReq', (proxyReq: any, req: any) => {
              proxyReq.method = 'POST';
              proxyReq.setHeader('Authorization', `Bearer ${mcpToken}`);
              proxyReq.setHeader('Content-Type', 'application/json');
              const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
              const q = url.searchParams.get('q') || 'AI news';
              const body = JSON.stringify({
                jsonrpc: '2.0', id: Date.now(), method: 'tools/call',
                params: { name: 'get_ai_news', arguments: { query: q, limit: 30 } }
              });
              proxyReq.setHeader('Content-Length', Buffer.byteLength(body));
              proxyReq.write(body);
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
