
import React, { useState, useCallback, useMemo, useRef } from 'react';
import { AppState, NewsItem, ErrorDetail } from './types';
import { fetchNews, checkProxyStatus, MCP_ENDPOINT } from './services/newsService';
import Navbar from './components/Navbar';
import NewsCard from './components/NewsCard';
import DebugModal from './components/DebugModal';
import { CATEGORIES, MOCK_INITIAL_NEWS } from './constants';

const App: React.FC = () => {
  const [items, setItems] = useState<NewsItem[]>(MOCK_INITIAL_NEWS);
  const [status, setStatus] = useState<AppState>(AppState.IDLE);
  const [activeTag, setActiveTag] = useState('TUTTE');
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  
  const [logHistory, setLogHistory] = useState<ErrorDetail[]>([]);
  const [selectedLog, setSelectedLog] = useState<ErrorDetail | null>(null);
  const [isDebugOpen, setIsDebugOpen] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);

  const addLog = (message: string, type: string = 'INFO', payload: any = {}, stack?: string) => {
    const newLog: ErrorDetail = {
      message,
      timestamp: new Date().toLocaleTimeString(),
      type: type.toUpperCase(),
      payload,
      stack: stack || 'Nessun dettaglio extra fornito.'
    };
    setLogHistory(prev => [newLog, ...prev].slice(0, 100)); 
  };

  const handleStopRefresh = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsRefreshing(false);
      setStatus(AppState.IDLE);
      addLog("SINC INTERROTTA DALL'UTENTE", 'SYSTEM', { action: "abort_triggered" });
    }
  };

  const handleRefresh = useCallback(async () => {
    if (isRefreshing) {
      handleStopRefresh();
      return;
    }

    setIsRefreshing(true);
    setStatus(AppState.LOADING);
    
    const params = { tags: activeTag === 'TUTTE' ? [] : [activeTag] };

    // LOG DETTAGLIATO DEL PAYLOAD INIZIALE
    addLog(`Avvio sincronizzazione...`, 'NETWORK', { 
      step: "1. Browser -> Endpoint",
      endpoint: MCP_ENDPOINT,
      payload: { params, token: "REDACTED (Using Server ENV)" },
      info: "Il token MCP_TOKEN verrà iniettato dal Proxy Server-Side."
    });

    abortControllerRef.current = new AbortController();

    try {
      const { data } = await fetchNews(params, undefined, abortControllerRef.current.signal);
      const newsItems = data.items || [];
      setItems(newsItems);
      setStatus(newsItems.length ? AppState.SUCCESS : AppState.EMPTY);
      
      addLog(`Successo: Ricevuti ${newsItems.length} elementi.`, 'SUCCESS', { 
        step: "3. Proxy -> n8n -> Browser",
        items_count: newsItems.length,
        version: data.source_version,
        generated_at: data.generated_at
      });
    } catch (error: any) {
      if (error.name === 'AbortError') return;
     
      addLog(`ERRORE FLOW: ${error.message}`, 'ERROR', { 
        error_details: error.message,
        hint: "Verifica che MCP_TOKEN sia impostato correttamente nel server. Parametri: " + params.tags.toString
      }, error.stack);
      setStatus(AppState.ERROR);
    } finally {
      setIsRefreshing(false);
      abortControllerRef.current = null;
    }
  }, [isRefreshing, activeTag]);

  const handleRunDiagnostics = async () => {
    if (isDiagnosing) return;
    setIsDiagnosing(true);
    addLog("ESECUZIONE TEST STACK (3-STEP)...", "SYSTEM");

    try {
      // STEP 1: Browser -> Endpoint
      addLog("STEP 1: Chiamata Endpoint Browser...", "DEBUG");
      const statusRes = await checkProxyStatus();
      addLog("Step 1 OK: Endpoint locale raggiungibile.", "SUCCESS", { endpoint: "/api/status", response: statusRes });

      // STEP 2: Endpoint -> Proxy
      addLog("STEP 2: Endpoint chiama il Proxy (Verifica Token)...", "DEBUG");
      if (statusRes.env_token_present) {
        addLog("Step 2 OK: Proxy configurato con MCP_TOKEN.", "SUCCESS", { token_present: true, mode: statusRes.mode });
      } else {
        addLog("Step 2 FAILED: MCP_TOKEN mancante nel Proxy.", "ERROR");
        throw new Error("Token mancante nel server/middleware.");
      }

      // STEP 3: Proxy -> n8n
      addLog("STEP 3: Il Proxy chiama n8n...", "DEBUG");
      const diagParams = { tags: ["DIAG"] };
      const { data } = await fetchNews(diagParams);
      addLog("Step 3 OK: Risposta valida da n8n!", "SUCCESS", { 
        data_count: data.items?.length || 0,
        n8n_timestamp: data.generated_at 
      });

    } catch (err: any) {
      addLog(`DIAGNOSTICA FALLITA: ${err.message}`, "FATAL", { error: err.message }, err.stack);
    } finally {
      setIsDiagnosing(false);
    }
  };

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesSearch = !searchQuery || item.title.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesTag = activeTag === 'TUTTE' || item.tags.some(t => t.toUpperCase() === activeTag.toUpperCase());
      return matchesSearch && matchesTag;
    });
  }, [items, searchQuery, activeTag]);

  return (
    <div className="min-h-screen pb-12 animate-fade-in relative">
      <Navbar />

      <main className="max-w-[1400px] mx-auto px-4 sm:px-8">
        <div className="flex flex-col lg:flex-row gap-8">
          <div className="flex-1 space-y-6">
            
            <section className="bg-white rounded-3xl p-8 card-shadow flex items-center justify-between border border-slate-100">
               <div className="flex items-center gap-10">
                  <div className="flex items-baseline gap-3">
                    <span className="text-5xl font-black text-slate-900 tracking-tighter">{filteredItems.length}</span>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Feed Attivo</span>
                  </div>
                  <div className="w-px h-12 bg-slate-100 hidden sm:block"></div>
                  <div className="flex flex-col">
                    <span className="text-xl font-black text-slate-900 leading-none mb-1">AI News Engine</span>
                    <div className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${status === AppState.SUCCESS ? 'text-emerald-500' : 'text-slate-400'}`}>
                      <span className={`w-2 h-2 rounded-full bg-current ${status === AppState.LOADING ? 'animate-ping' : ''}`}></span>
                      {status === AppState.LOADING ? 'In sincronizzazione...' : (status === AppState.SUCCESS ? 'Sincronizzato' : 'Pronto')}
                    </div>
                  </div>
               </div>
               
               <button 
                onClick={handleRefresh} 
                className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all shadow-xl active:scale-95 ${isRefreshing ? 'bg-red-500 hover:bg-red-600' : 'bg-slate-900 hover:bg-black'} text-white shadow-2xl`}
               >
                 {isRefreshing ? (
                   <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                   </svg>
                 ) : (
                   <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                   </svg>
                 )}
               </button>
            </section>

            <section className="bg-white/80 backdrop-blur-xl rounded-3xl p-8 card-shadow border border-white/50 space-y-6">
              <div className="relative w-full">
                <input 
                  type="text" 
                  placeholder="Cerca nelle notizie di oggi..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-16 pl-16 pr-6 bg-slate-100/50 rounded-2xl text-lg font-semibold focus:outline-none border border-slate-200/50"
                />
                <svg className="absolute left-6 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
                {CATEGORIES.map(cat => (
                  <button key={cat} onClick={() => setActiveTag(cat)} className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all border-2 ${activeTag === cat ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-400 border-slate-100'}`}>{cat}</button>
                ))}
              </div>
            </section>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {status === AppState.LOADING && items.length === 0 ? (
                [1,2,3,4].map(i => <div key={i} className="h-64 bg-white/40 animate-pulse rounded-3xl border border-slate-100"></div>)
              ) : filteredItems.length > 0 ? (
                filteredItems.map(item => <NewsCard key={item.id} item={item} />)
              ) : (
                <div className="col-span-full py-32 text-center bg-white/50 rounded-[3rem] border border-dashed border-slate-200">
                  <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Nessun risultato disponibile</p>
                </div>
              )}
            </div>

            {/* TERMINALE DIAGNOSTICO - ORA ALLINEATO AI 3 STEP */}
            <section className="bg-[#050505] rounded-[2.5rem] border border-white/5 shadow-2xl overflow-hidden mt-12">
              <div className="px-8 py-5 border-b border-white/5 bg-zinc-900/50 flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/40"></div>
                    <div className="w-3 h-3 rounded-full bg-emerald-500/20 border border-emerald-500/40"></div>
                  </div>
                  <span className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em]">System Stack Terminal</span>
                </div>
                <button onClick={handleRunDiagnostics} disabled={isDiagnosing} className="px-4 py-1.5 bg-blue-600 text-white text-[9px] font-black uppercase rounded-lg">
                  {isDiagnosing ? 'DIAG IN CORSO...' : 'RUN 3-STEP TEST'}
                </button>
              </div>
              <div className="p-6 h-[350px] overflow-y-auto font-mono text-[11px] leading-relaxed no-scrollbar bg-black/40">
                {logHistory.length === 0 && <div className="text-zinc-700 italic px-4 py-2">Clicca "RUN 3-STEP TEST" per verificare il flusso: Browser → Endpoint → Proxy → n8n</div>}
                {logHistory.map((log, i) => (
                  <div key={i} onClick={() => { setSelectedLog(log); setIsDebugOpen(true); }} className="flex items-center gap-4 py-2.5 hover:bg-white/5 cursor-pointer px-4 rounded-xl transition-all border-b border-white/5 last:border-0">
                    <span className="text-zinc-600 shrink-0">[{log.timestamp}]</span>
                    <span className={`font-black text-[8px] px-1.5 py-0.5 rounded border ${log.type === 'ERROR' || log.type === 'FATAL' ? 'text-red-500 border-red-500/30 bg-red-500/5' : log.type === 'SUCCESS' ? 'text-emerald-500 border-emerald-500/30 bg-emerald-500/5' : 'text-zinc-500 border-zinc-500/30'}`}>
                      {log.type}
                    </span>
                    <span className="text-zinc-300 truncate flex-1">{log.message}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <aside className="w-full lg:w-[400px]">
            <div className="bg-[#0a0a0a] rounded-[2.5rem] p-10 text-white min-h-[600px] shadow-2xl sticky top-8 border border-white/5">
              <h2 className="text-3xl font-black tracking-tighter mb-10">Top Stories</h2>
              <div className="space-y-6">
                {items.slice(0, 10).map((item, i) => (
                  <div key={item.id} className="flex gap-5 items-center group cursor-pointer border-b border-white/5 pb-4 last:border-0">
                    <span className="text-zinc-800 group-hover:text-emerald-500 transition-colors font-black text-2xl">{(i+1).toString().padStart(2, '0')}</span>
                    <p className="font-bold text-sm text-zinc-400 group-hover:text-white transition-colors line-clamp-2">{item.title}</p>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </main>

      <DebugModal isOpen={isDebugOpen} onClose={() => setIsDebugOpen(false)} error={selectedLog} />
    </div>
  );
};

export default App;
