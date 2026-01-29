
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Il Service Worker è stato rimosso per garantire che il traffico 
// passi attraverso il Proxy Server-Side (Vite Middleware) 
// ed evitare errori di Cross-Origin in ambiente AI Studio.

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
