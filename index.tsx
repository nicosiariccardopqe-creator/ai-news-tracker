
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

/**
 * ARCHITETTURA DI SICUREZZA AI STUDIO:
 * Per evitare errori di "origin mismatch" (CORS) con i Service Worker,
 * tutto il traffico è forzato attraverso il Proxy Server-Side (Vite Middleware).
 * Non tentare di registrare sw.js nel browser.
 */

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
