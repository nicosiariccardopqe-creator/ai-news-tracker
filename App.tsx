
import React, { useState, useCallback, useMemo, useRef } from 'react';
import { AppState, NewsItem, ErrorDetail } from './types';
import { fetchNews } from './services/newsService';
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
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(new Date().toLocaleString('it-IT'));
  
  const [logHistory, setLogHistory] = useState<ErrorDetail[]>([]);
  const [selectedLog, setSelectedLog] = useState<ErrorDetail | null>(null);
  const [isDebugOpen, setIsDebugOpen] = useState(false);
  const [isLogCollapsed, setIsLogCollapsed] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);

  const addLog = (message: string, type: string = 'INFO', payload: any = {}) => {
    const newLog: ErrorDetail = {
      message,
      timestamp: new Date().toLocaleTimeString(),
      type: type.toUpperCase(),
      payload
    };
    setLogHistory(prev => [newLog, ...prev].slice(0, 100)); 
  };

  const clearLogs = () => setLogHistory([]);

  const handleLoadDefault = (e: React.MouseEvent) => {
    e.preventDefault();
    setItems(MOCK_INITIAL_NEWS);
    setStatus(AppState.SUCCESS);
    setLastSyncTime(new Date().toLocaleString('it-IT'));
    addLog("Caricati dati di default (Locale)", "SYSTEM");
  };

  const handleRefresh = useCallback(async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (isRefreshing) {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      setIsRefreshing(false);
      return;
    }

    setIsRefreshing(true);
    setStatus(AppState.LOADING);
    
    addLog(`INVIO RICHIESTA JSON-RPC 2.0`, "NETWORK", {
      method: "tools/call",
      params: { name: "execute_workflow", workflowId: "rvpkrwvBbd5NWLMt" }
    });

    abortControllerRef.current = new AbortController();

    try {
      const result = await fetchNews(
        { tags: activeTag === 'TUTTE' ? [] : [activeTag] },
        undefined,
        abortControllerRef.current.signal
      );
      
      const responseData: any = result.data;
      addLog(`RISPOSTA RICEVUTA (Grezza)`, "NETWORK", responseData);

      let rawItems: any[] = [];

      // ESTRAZIONE ROBUSTA BASATA SUL LOG FORNITO
      try {
        // 1. Cerchiamo la stringa JSON dentro content[0].text
        const contentPart = responseData?.result?.content?.find((c: any) => c.type === 'text');
        const innerJsonString = contentPart?.text;

        if (innerJsonString) {
          const parsedInner = JSON.parse(innerJsonString);
          
          // 2. Percorriamo l'albero: result -> runData -> Combine All Posts
          const runData = parsedInner?.result?.runData;
          const combineNode = runData?.['Combine All Posts'];
          
          if (combineNode && combineNode.length > 0) {
            // 3. data -> main -> [0] -> [0] -> json -> data
            const mainData = combineNode[0]?.data?.main;
            if (mainData && mainData[0] && mainData[0][0]) {
              const dataArray = mainData[0][0].json?.data;
              if (Array.isArray(dataArray)) {
                rawItems = dataArray;
                addLog(`Estratte ${rawItems.length} notizie dal percorso specifico n8n`, "SUCCESS");
              }
            }
          }
        } else {
          // Fallback se la struttura è leggermente diversa (es. structuredContent come indicato dall'utente)
          const dataArray = responseData?.result?.structuredContent?.result?.runData?.['Combine All Posts']?.[0]?.data?.main?.[0]?.[0]?.json?.data;
          if (Array.isArray(dataArray)) {
            rawItems = dataArray;
          }
        }
      } catch (parseError) {
        addLog("Errore durante il parsing dei dati annidati", "ERROR", parseError);
      }

      // MAPPING DEI CAMPI RICHIESTO:
      // 1. title -> title
      // 2. link -> url
      // 3. contentSnippet -> summary
      // 4. puibbDate -> published_at
      // 5. categories -> tags
      const mappedItems: NewsItem[] = rawItems.map((raw: any, index: number) => ({
        id: raw.id || `n8n-${Date.now()}-${index}`,
        title: raw.title || "Senza Titolo",
        url: raw.link || "#",
        summary: raw.contentSnippet || raw.summary || "Nessun sommario disponibile.",
        published_at: raw.puibbDate || raw.pubDate || new Date().toISOString(),
        tags: Array.isArray(raw.categories) ? raw.categories : (raw.tags || ["AI"]),
        source: { 
          name: (raw.source && typeof raw.source === 'string' ? raw.source : (raw.source?.name || 'N8N FEED')), 
          domain: (raw.source?.domain || 'n8n.io') 
        },
        fetched_at: new Date().toISOString(),
        language: 'it',
        score: { freshness: 1, relevance: 1, popularity: 1 }
      }));

      setItems(mappedItems);
      setStatus(mappedItems.length ? AppState.SUCCESS : AppState.EMPTY);
      setLastSyncTime(new Date().toLocaleString('it-IT'));
      addLog(`Mapping completato: ${mappedItems.length} notizie visualizzate.`, "SUCCESS");

    } catch (error: any) {
      if (error.name === 'AbortError') {
        addLog("Richiesta annullata.", "SYSTEM");
        return;
      }
      addLog(`ERRORE PIPELINE: ${error.message || 'Errore di connessione'}`, "ERROR", error);
      setStatus(AppState.ERROR);
    } finally {
      setIsRefreshing(false);
      abortControllerRef.current = null;
    }
  }, [isRefreshing, activeTag]);

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesSearch = !searchQuery || item.title.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesTag = activeTag === 'TUTTE' || item.tags.some(t => t.toUpperCase() === activeTag.toUpperCase());
      return matchesSearch && matchesTag;
    });
  }, [items, searchQuery, activeTag]);

  return (
    <div className="min-h-screen pb-12 animate-fade-in relative selection:bg-slate-900 selection:text-white">
      <Navbar />

      <main className="max-w-[1400px] mx-auto px-4 sm:px-8">
        <div className="flex flex-col lg:flex-row gap-8">
          <div className="flex-1 space-y-6">
            
            <section className="bg-white rounded-3xl p-8 card-shadow flex flex-col sm:flex-row items-center justify-between border border-slate-100 gap-6">
               <div className="flex items-center gap-10">
                  <div className="flex items-baseline gap-3">
                    <span className="text-5xl font-black text-slate-900 tracking-tighter">{filteredItems.length}</span>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Risultati</span>
                  </div>
                  <div className="w-px h-12 bg-slate-100 hidden md:block"></div>
                  <div className="flex flex-col">
                    <span className="text-xl font-black text-slate-900 leading-none mb-1">AI News Engine</span>
                    <div className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${status === AppState.SUCCESS ? 'text-emerald-500' : 'text-slate-400'}`}>
                      <span className={`w-2 h-2 rounded-full bg-current ${status === AppState.LOADING ? 'animate-ping' : ''}`}></span>
                      {status === AppState.LOADING ? 'Sincronizzazione...' : 'Pronto'}
                    </div>
                    {lastSyncTime && (
                      <span className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-tighter">
                        Ultimo Update: {lastSyncTime}
                      </span>
                    )}
                  </div>
               </div>
               
               <div className="flex items-center gap-3">
                 <button 
                  type="button"
                  onClick={handleLoadDefault}
                  className="w-12 h-12 rounded-xl flex items-center justify-center transition-all bg-slate-100 hover:bg-slate-200 text-slate-500 border border-slate-200"
                  title="Carica dati default"
                 >
                   <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 15l-3-3m0 0l3-3m-3 3h8M3 12a9 9 0 1118 0 9 9 0 01-18 0z" />
                   </svg>
                 </button>

                 <button 
                  type="button"
                  onClick={handleRefresh} 
                  className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all shadow-xl active:scale-95 ${isRefreshing ? 'bg-red-500' : 'bg-slate-900'} text-white group`}
                  title={isRefreshing ? "Annulla" : "Sincronizza con n8n"}
                 >
                   {isRefreshing ? (
                     <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                     </svg>
                   ) : (
                     <svg className="w-8 h-8 group-hover:rotate-180 transition-transform duration-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357-2H15" />
                     </svg>
                   )}
                 </button>
               </div>
            </section>

            <section className="bg-white/80 backdrop-blur-xl rounded-3xl p-8 card-shadow border border-white/50 space-y-6">
              <input 
                type="text" 
                placeholder="Cerca nelle notizie di oggi..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-16 px-6 bg-slate-100/50 rounded-2xl text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-slate-900/5 transition-all"
              />
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map(cat => (
                  <button 
                    key={cat} 
                    type="button"
                    onClick={() => setActiveTag(cat)} 
                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all border ${activeTag === cat ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-400 border-slate-100 hover:border-slate-300'}`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </section>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 min-h-[400px]">
              {filteredItems.length > 0 ? (
                filteredItems.map(item => <NewsCard key={item.id} item={item} />)
              ) : (
                <div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-400 bg-white/30 rounded-3xl border border-dashed border-slate-200">
                  <p className="font-black uppercase tracking-widest text-xs">Nessuna notizia trovata</p>
                </div>
              )}
            </div>
          </div>

          <aside className="w-full lg:w-[400px]">
            <div className="bg-[#0a0a0a] rounded-[2.5rem] p-10 text-white min-h-[600px] sticky top-8 border border-white/5 shadow-2xl">
              <div className="flex items-center justify-between mb-10">
                <h2 className="text-3xl font-black tracking-tighter">Trending Now</h2>
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></span>
              </div>
              <div className="space-y-6">
                {items.slice(0, 8).map((item, i) => (
                  <div key={item.id} className="group flex gap-5 items-center border-b border-white/5 pb-4 last:border-0 cursor-pointer">
                    <span className="text-zinc-800 font-black text-2xl group-hover:text-emerald-500 transition-colors">{(i+1).toString().padStart(2, '0')}</span>
                    <p className="font-bold text-sm text-zinc-400 group-hover:text-white transition-colors line-clamp-2">{item.title}</p>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>

        {/* Console di Debug */}
        <section className="bg-[#050505] rounded-[2.5rem] border border-white/5 shadow-2xl overflow-hidden mt-12 transition-all duration-500">
          <div className="px-8 py-5 border-b border-white/5 bg-zinc-900/50 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-2 h-2 rounded-full ${isRefreshing ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`}></div>
              <span className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em]">Full-Stack Data Pipeline & Server Tracking</span>
            </div>
            <div className="flex items-center gap-4">
               <button onClick={clearLogs} className="text-[9px] font-black text-zinc-500 hover:text-white uppercase tracking-widest transition-colors">Clear</button>
               <button onClick={() => setIsLogCollapsed(!isLogCollapsed)} className="p-2 text-zinc-500 hover:text-white transition-colors">
                {isLogCollapsed ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg> : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 15l7-7 7 7" /></svg>}
               </button>
            </div>
          </div>
          
          {!isLogCollapsed && (
            <div className="p-6 h-[350px] overflow-y-auto font-mono text-[11px] no-scrollbar bg-black/40 animate-fade-in">
              {logHistory.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-zinc-800 space-y-2">
                  <p className="italic font-bold tracking-widest uppercase text-[9px]">In attesa di dati...</p>
                </div>
              )}
              {logHistory.map((log, i) => (
                <div key={i} onClick={() => { setSelectedLog(log); setIsDebugOpen(true); }} className="flex items-center gap-4 py-2.5 hover:bg-white/5 cursor-pointer px-4 rounded-lg transition-colors border-b border-white/5 last:border-0 group">
                  <span className="text-zinc-600 shrink-0 tabular-nums">[{log.timestamp}]</span>
                  <span className={`font-black text-[8px] px-2 py-0.5 rounded border transition-all ${log.type === 'ERROR' ? 'text-red-500 border-red-500/30 bg-red-500/5' : log.type === 'SUCCESS' ? 'text-emerald-500 border-emerald-500/30 bg-emerald-500/5' : log.type === 'SYSTEM' ? 'text-blue-400 border-blue-400/30 bg-blue-400/5' : log.type === 'NETWORK' ? 'text-amber-400 border-amber-400/30 bg-amber-400/5' : 'text-zinc-500 border-zinc-500/30'}`}>{log.type}</span>
                  <span className="text-zinc-300 truncate group-hover:text-white">{log.message}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      <DebugModal isOpen={isDebugOpen} onClose={() => setIsDebugOpen(false)} error={selectedLog} />
    </div>
  );
};

export default App;
