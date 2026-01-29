
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Registrazione del Service Worker per simulare il Backend/Proxy
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(registration => {
      console.log('SW Proxy registrato con successo:', registration.scope);
    }).catch(err => {
      console.error('Errore registrazione SW:', err);
    });
  });
}

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
