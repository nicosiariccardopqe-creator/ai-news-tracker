
const N8N_TARGET = "https://docker-n8n-xngg.onrender.com/mcp-server/http";

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Intercettazione rotta STATUS
  if (url.pathname.endsWith('/api/status')) {
    event.respondWith(
      new Response(JSON.stringify({
        status: "online",
        mode: "service-worker-proxy",
        timestamp: new Date().toISOString()
      }), {
        headers: { 'Content-Type': 'application/json' }
      })
    );
    return;
  }

  // Intercettazione rotta NEWS
  if (url.pathname.endsWith('/api/news') && event.request.method === 'POST') {
    event.respondWith(
      (async () => {
        try {
          const body = await event.request.json();
          const token = body.token;
          const params = body.params || {};

          if (!token) {
            return new Response(JSON.stringify({ error: "Token mancante" }), { 
              status: 401, 
              headers: { 'Content-Type': 'application/json' } 
            });
          }

          const response = await fetch(N8N_TARGET, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              method: "NewsAI",
              token: token,
              params: params
            })
          });

          const data = await response.text();
          return new Response(data, {
            status: response.status,
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (err) {
          return new Response(JSON.stringify({ error: "SW Proxy Exception", detail: err.message }), {
            status: 502,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      })()
    );
    return;
  }
});
