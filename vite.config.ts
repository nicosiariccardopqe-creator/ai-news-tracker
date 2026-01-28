import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
      allowedHosts: true,
    },
    preview: {
      port: 3000,
      host: '0.0.0.0',
      allowedHosts: true,
    },
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.MCP_TOKEN': JSON.stringify(env.MCP_TOKEN || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJlMWE5NjRkZi02ZDMzLTRkZGUtOTI3Yi05NGQ0ZjMwNmM1Y2YiLCJpc3MiOiJuOG4iLCJhdWQiOiJtY3Atc2VydmVyLWFwaSIsImp0aSI6ImQzMjdmNzkxLTExOWMtNDUzYi1iNmU0LWM4MWFhNGE3MzNkZSIsImlhdCI6MTc2OTUyMzU4N30.7u2MS7h9dhEIQ6LaOciT8xvYUxmeLoRYS4Mw_t9K2C0'),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});