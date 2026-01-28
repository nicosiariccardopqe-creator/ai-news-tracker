import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { Buffer } from 'buffer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const mcpToken = env.MCP_TOKEN || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJlMWE5NjRkZi02ZDMzLTRkZGUtOTI3Yi05NGQ0ZjMwNmM1Y2YiLCJpc3MiOiJuOG4iLCJhdWQiOiJtY3Atc2VydmVyLWFwaSIsImp0aSI6ImQzMjdmNzkxLTExOWMtNDUzYi1iNmU0LWM4MWFhNGE3MzNkZSIsImlhdCI6MTc2OTUyMzU4N30.7u2MS7h9dhEIQ6LaOciT8xvYUxmeLoRYS4Mw_t9K2C0';

    const createProxyConfig = () => ({
      target: 'https://docker-n8n-xngg.onrender.com',
      changeOrigin: true,
      secure: false, // Utile per evitare problemi di certificati self-signed o proxy intermedi
      rewrite: (p: string) => '/mcp-server/http', // Mappa qualsiasi cosa sotto /api/news all'endpoint MCP
      configure: (proxy: any) => {
        proxy.on('proxyReq', (proxyReq: any, req: any) => {
          // Forza il metodo POST richiesto da n8n MCP
          proxyReq.method = 'POST';
          proxyReq.setHeader('Authorization', `Bearer ${mcpToken}`);
          proxyReq.setHeader('Content-Type', 'application/json');
          
          // Estrai la query per passarla al tool n8n
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
              arguments: {
                query: query,
                limit: 30,
                force_refresh: true
              }
            }
          };

          const body = JSON.stringify(mcpRequest);
          proxyReq.setHeader('Content-Length', Buffer.byteLength(body));
          
          // Scrive il body e termina la richiesta per questo "salto" del proxy
          proxyReq.write(body);
          proxyReq.end();
        });

        proxy.on('error', (err: any, req: any, res: any) => {
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
        proxy: {
          '/api/news': createProxyConfig()
        }
      },
      preview: {
        port: 3000,
        host: '0.0.0.0',
        proxy: {
          '/api/news': createProxyConfig()
        }
      },
      plugins: [
        react()
      ],
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