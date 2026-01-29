
# Product Requirements Document: AI News Tracker

## 1. Visione del Prodotto
Creare la destinazione definitiva per professionisti e appassionati di AI che desiderano rimanere aggiornati in un mercato che si muove alla velocità della luce. L'app non deve solo aggregare news, ma filtrarle e spiegarle usando l'intelligenza artificiale stessa.

## 2. Pubblico Target
- **Sviluppatori AI/ML**: In cerca di aggiornamenti su nuovi modelli e framework.
- **Tech Enthusiasts**: Persone che vogliono capire l'impatto dell'AI sulla vita quotidiana.
- **Decision Maker**: Professionisti che necessitano di news sulla regolamentazione (AI Act) ed etica.

## 3. Funzionalità Principali (MVP)
### 3.1 Aggregazione Real-time
- Connessione a un server MCP (Model Context Protocol) o n8n per il recupero di news fresche.
- Sistema di fallback con dati locali in caso di assenza di rete.

### 3.2 AI Categorization & Scoring
- Categorizzazione automatica in: Nuovi Modelli, Machine Learning, Etica, Hardware, Regolamentazione.
- Calcolo di uno "Score" basato su: Freschezza, Rilevanza e Popolarità.

### 3.3 Esperienza Utente (UX)
- **Daily Briefing**: Titoli chiari e sommari di 2 righe per una lettura veloce.
- **System Terminal**: Una sezione di diagnostica trasparente che mostra all'utente cosa sta succedendo "sotto il cofano" (chiamate API, latenza, errori).
- **Design Moderno**: Interfaccia pulita, font 'Plus Jakarta Sans', animazioni fluide e supporto per schermi mobili.

## 4. Requisiti Tecnici
- **Frontend**: React 19, Tailwind CSS.
- **API Strategy**: Utilizzo di un Service Worker come Proxy locale per bypassare restrizioni CORS e problemi di configurazione server.
- **Intelligenza Artificiale**: Integrazione con Gemini API per la generazione di riassunti e l'analisi dei trend.

## 5. Roadmap
- **V1 (Corrente)**: Architettura di base, UI reattiva, sistema di diagnostica e integrazione proxy.
- **V2**: Implementazione di Gemini per riassumere i link cliccati in tempo reale.
- **V3**: Notifiche push per news "Breaking" e sistema di salvataggio preferiti (LocalStorage).
