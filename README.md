
<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# AI News Tracker

Questa applicazione monitora le ultime notizie nel campo dell'Intelligenza Artificiale in tempo reale e le salva su un database Supabase per garantirne la persistenza.

## Configurazione Database Supabase

Per far funzionare la persistenza, esegui il seguente comando SQL nel "SQL Editor" del tuo progetto Supabase:

```sql
CREATE TABLE news (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  summary TEXT,
  url TEXT NOT NULL,
  source_name TEXT,
  source_domain TEXT,
  published_at TIMESTAMPTZ,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  tags JSONB
);

-- Abilita l'accesso pubblico (solo se necessario, altrimenti configura RLS)
ALTER TABLE news ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read" ON news FOR SELECT USING (true);
CREATE POLICY "Allow public upsert" ON news FOR ALL USING (true);
```

## Esecuzione Locale

**Prerequisiti:** Node.js

1. Installa le dipendenze:
   `npm install`
2. Imposta le variabili nel file `.env`:
   - `MCP_TOKEN`: Il tuo token n8n.
   - `MCP_WORKFLOWID`: L'ID del tuo workflow (es: `rvpkrwvBbd5NWLMt`).
3. Avvia l'app:
   `npm run dev`

Visualizza l'app in AI Studio: https://ai.studio/apps/drive/1aHjLwqHYB5e9OSpmp2gaudixUF_us56T
