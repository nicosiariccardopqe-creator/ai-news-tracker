import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { AppState, NewsItem } from './types';
import { fetchNews, trackTelemetry } from './services/newsService';
import Navbar from './components/Navbar';
import NewsCard from './components/NewsCard';
import { CATEGORIES } from './constants';

const ErrorModal: React.FC<{ isOpen: boolean; onClose: () => void; errorDetail: string }> = ({ isOpen, onClose, errorDetail }) => {
  if (!isOpen) return null;
  const is404 = errorDetail.includes('404');

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200">
        <div className="bg-red-600 px-6 py-5 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            </div>
            <div>
              <h3 className="text-white font-extrabold uppercase tracking-widest text-[12px]">Errore del Server</h3>
              <p className="text-red-100 text-[10px] font-medium opacity-80">{is404 ? 'Endpoint non trovato' : 'Connessione fallita'}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-full">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="p-8 space-y-6">
          <div className="space-y-2">
            <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Messaggio di Errore:</p>
            <div className="bg-slate-950 p-5 rounded-lg border border-slate-800 font-mono text-[11px] text-emerald-400 break-words whitespace-pre-wrap leading-relaxed shadow-inner overflow-y-auto max-h-72">
              {errorDetail}
            </div>
          </div>
          <div className="p-4 bg-amber-50 border-l-4 border-amber-400 rounded-r-lg">
            <h4 className="text-amber-800 text-xs font-bold mb-1 uppercase tracking-tight">Cosa controllare?</h4>
            <ul className="text-[12px] text-amber-700 leading-relaxed list-disc ml-4 space-y-1">
              {is404 ? (
                <>
                  <li>Assicurati che l'istanza <strong>n8n</strong> su Render sia attiva e non in pausa.</li>
                  <li>Verifica che il path nel workflow n8n sia esattamente <code>/mcp-server/http</code>.</li>
                  <li>Il proxy ha tentato di inviare una POST a quell'indirizzo, ma ha ricevuto un 404.</li>
                </>
              ) : (
                <>
                  <li>Verifica la tua connessione internet.</li>
                  <li>Controlla se il server n8n ha raggiunto il limite di memoria o CPU.</li>
                  <li>Il proxy Vite potrebbe non riuscire a raggiungere il dominio <code>docker-n8n-xngg.onrender.com</code>.</li>
                </>
              )}
            </ul>
          </div>
        </div>
        <div className="bg-slate-50 px-8 py-5 border-t border-slate-100 flex flex-wrap justify-end gap-3">
          <button onClick={() => { localStorage.clear(); window.location.reload(); }} className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 text-[10px] font-bold uppercase tracking-widest rounded-lg hover:bg-slate-100 transition-all">Ricarica Pagina</button>
          <button onClick={onClose} className="px-8 py-2.5 bg-slate-900 text-white text-[10px] font-bold uppercase tracking-widest rounded-lg hover:bg-black transition-all shadow-xl">Ho capito</button>
        </div>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [status, setStatus] = useState<AppState>(AppState.IDLE);
  const [activeTag, setActiveTag] = useState('TUTTE');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAutoSyncEnabled, setIsAutoSyncEnabled] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [sourceVersion, setSourceVersion] = useState<string>('');
  const [isErrorModalOpen, setIsErrorModalOpen] = useState(false);
  
  const autoSyncTimerRef = useRef<number | null>(null);

  const handleRefresh = useCallback(async (isInitial = false, isBackground = false) => {
    if (isRefreshing) return;
    
    setIsRefreshing(true);
    if (!isBackground) {
      setItems([]); 
      setStatus(AppState.LOADING);
      setSourceVersion('SINCRO_IN_CORSO...');
    }
    
    trackTelemetry('cta_refresh_clicked', { isInitial, isBackground });

    try {
      const response = await fetchNews({
        tags: activeTag !== 'TUTTE' ? [activeTag] : [] 
      });
      
      setItems(response.items);
      setLastSync(new Date());
      setSourceVersion(response.source_version);
      setStatus(AppState.SUCCESS);
      
      if (response.source_version.includes('failure')) {
        setIsErrorModalOpen(true);
      }
      
    } catch (error: any) {
      console.error("Critical UI Error:", error);
      setStatus(AppState.ERROR);
      setSourceVersion('error::' + error.message);
      setIsErrorModalOpen(true);
    } finally {
      setIsRefreshing(false);
    }
  }, [activeTag, isRefreshing]);

  useEffect(() => {
    handleRefresh(true);
  }, []);

  useEffect(() => {
    if (isAutoSyncEnabled) {
      autoSyncTimerRef.current = window.setInterval(() => {
        handleRefresh(false, true);
      }, 45000); 
    } else {
      if (autoSyncTimerRef.current) {
        clearInterval(autoSyncTimerRef.current);
        autoSyncTimerRef.current = null;
      }
    }
    return () => {
      if (autoSyncTimerRef.current) clearInterval(autoSyncTimerRef.current);
    };
  }, [isAutoSyncEnabled, handleRefresh]);

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesTag = activeTag === 'TUTTE' || 
        item.tags.some(t => t.toUpperCase() === activeTag.toUpperCase());
      const searchLower = searchQuery.toLowerCase().trim();
      const matchesSearch = searchLower === '' || 
        item.title.toLowerCase().includes(searchLower) ||
        item.summary.toLowerCase().includes(searchLower);
      return matchesTag && matchesSearch;
    });
  }, [items, activeTag, searchQuery]);

  const isLive = sourceVersion.includes('live') && !sourceVersion.includes('failure');

  const getErrorMessage = () => {
    if (sourceVersion.includes('404')) return 'Endpoint 404';
    if (sourceVersion.includes('timeout')) return 'Timeout 60s';
    if (sourceVersion.includes('failure')) return 'Errore Connessione';
    if (sourceVersion.includes('empty')) return 'Nessun Dato';
    return 'Offline';
  };

  const getDetailedError = () => {
    const parts = sourceVersion.split('::');
    return parts.length > 1 ? parts[1] : sourceVersion;
  };

  return (
    <div className="min-h-screen pb-12">
      <Navbar />
      <ErrorModal isOpen={isErrorModalOpen} onClose={() => setIsErrorModalOpen(false)} errorDetail={getDetailedError()} />

      <main className="max-w-[1400px] mx-auto px-4 sm:px-8">
        <div className="flex flex-col lg:flex-row gap-8 items-start">
          
          <div className="flex-1 w-full space-y-6">
            
            {status === AppState.SUCCESS && !isLive && (
              <div className="bg-amber-100/50 border border-amber-200 rounded-xl p-5 flex flex-col md:flex-row items-center justify-between gap-4 text-amber-900 shadow-xl animate-in slide-in-from-top-4 duration-500">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-amber-200 flex items-center justify-center shrink-0">
                    <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  </div>
                  <div>
                    <p className="text-[11px] font-extrabold uppercase tracking-widest text-amber-700">Modalità Fallback Attiva ({getErrorMessage()})</p>
                    <p className="text-[12px] font-medium opacity-90 max-w-lg">Impossibile collegarsi a n8n. Visualizzando dati di backup per garantire la continuità del servizio.</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto">
                  <button 
                    onClick={() => setIsErrorModalOpen(true)}
                    className="flex-1 md:flex-none px-4 py-2 text-amber-800 hover:bg-amber-200 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all border border-amber-300/50"
                  >
                    Vedi Dettagli
                  </button>
                  <button 
                    onClick={() => handleRefresh()}
                    disabled={isRefreshing}
                    className="flex-1 md:flex-none px-6 py-2 bg-amber-600 text-white rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-amber-700 transition-all disabled:opacity-50 shadow-lg active:scale-95"
                  >
                    {isRefreshing ? 'In corso...' : 'Riprova Live'}
                  </button>
                </div>
              </div>
            )}

            <section className="bg-white rounded-2xl p-6 card-shadow flex items-center justify-between border border-slate-100 h-32 text-slate-900 group">
              <div className="flex items-center gap-6 sm:gap-12 lg:gap-20 px-4 overflow-x-auto no-scrollbar">
                <div className="flex items-baseline gap-3 shrink-0">
                  <span className="text-4xl font-extrabold tracking-tighter text-slate-900">
                    {isRefreshing && items.length === 0 ? '...' : items.length}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">News</span>
                </div>
                <div className="w-px h-12 bg-slate-100 shrink-0"></div>
                <div className="flex flex-col justify-center shrink-0">
                  <div className="flex items-baseline gap-3">
                    <span className="text-4xl font-extrabold tracking-tighter text-slate-900">Live</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</span>
                  </div>
                  {lastSync && (
                    <span className="text-[10px] font-bold text-slate-400 mt-1 flex items-center gap-1.5 uppercase tracking-tight">
                      <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${isLive ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                      {lastSync.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
                <div className="hidden xs:block w-px h-12 bg-slate-100 shrink-0"></div>
                <div className="hidden xs:flex items-baseline gap-3 shrink-0">
                  <div className="relative">
                    <span className={`text-4xl font-extrabold tracking-tighter transition-all duration-700 ${isLive ? 'text-emerald-500' : 'text-slate-300'}`}>
                      {isLive ? 'ON' : 'OFF'}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Proxy</span>
                </div>
              </div>

              <div className="flex items-center gap-8 pl-8 border-l border-slate-100">
                <div className="text-right hidden md:block">
                  <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Auto-Sync</span>
                  <button 
                    onClick={() => setIsAutoSyncEnabled(!isAutoSyncEnabled)}
                    className={`w-12 h-6 rounded-full relative p-1 transition-all duration-500 shadow-inner ${isAutoSyncEnabled ? 'bg-emerald-500' : 'bg-slate-200'}`}
                  >
                    <div className={`w-4 h-4 bg-white rounded-full shadow-md transition-all duration-500 transform ${isAutoSyncEnabled ? 'translate-x-6' : 'translate-x-0'}`}></div>
                  </button>
                </div>
                <button 
                  onClick={() => handleRefresh()}
                  className={`w-16 h-16 bg-slate-900 text-white rounded-2xl flex items-center justify-center shadow-2xl hover:bg-black active:scale-90 transition-all shrink-0 group-hover:rotate-12 ${isRefreshing ? 'animate-spin opacity-50' : ''}`}
                  title="Aggiorna"
                  disabled={isRefreshing}
                >
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                </button>
              </div>
            </section>

            <section className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 card-shadow border border-white/40">
              <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                <div className="relative flex-1 w-full">
                  <input 
                    type="text" 
                    placeholder="Filtra tra i risultati..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full h-14 pl-14 pr-12 bg-slate-100/50 rounded-xl text-sm font-medium focus:outline-none focus:ring-4 focus:ring-slate-900/5 transition-all border border-slate-200/50 placeholder:text-slate-400"
                  />
                  <svg className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat}
                      onClick={() => setActiveTag(cat)}
                      className={`px-5 py-2.5 rounded-xl text-[10px] font-extrabold tracking-widest transition-all whitespace-nowrap border-2 ${
                        activeTag === cat 
                          ? 'bg-slate-900 text-white border-slate-900 shadow-xl' 
                          : 'bg-white text-slate-400 border-slate-100 hover:border-slate-300 shadow-sm'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 min-h-[600px] content-start">
              {status === AppState.LOADING ? (
                [1, 2, 3, 4, 5, 6].map(i => (
                  <div key={i} className="h-72 rounded-2xl bg-white/60 animate-pulse border border-slate-100 p-8 space-y-5">
                    <div className="flex justify-between">
                      <div className="w-24 h-4 bg-slate-200 rounded"></div>
                      <div className="w-12 h-4 bg-slate-200 rounded"></div>
                    </div>
                    <div className="w-full h-10 bg-slate-200 rounded"></div>
                    <div className="w-3/4 h-6 bg-slate-200 rounded"></div>
                    <div className="flex-1"></div>
                    <div className="flex gap-2">
                      <div className="w-20 h-5 bg-slate-200 rounded"></div>
                    </div>
                  </div>
                ))
              ) : filteredItems.length > 0 ? (
                filteredItems.map(item => <NewsCard key={item.id} item={item} />)
              ) : (
                <div className="col-span-full py-32 text-center">
                  <div className="bg-white/70 backdrop-blur-md rounded-3xl p-12 border border-white/50 inline-block w-full max-w-md shadow-2xl">
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight">Nessuna Notizia</h3>
                    <p className="text-slate-500 mt-4 text-sm font-medium">I criteri di ricerca o i filtri non hanno prodotto risultati.</p>
                    <button onClick={() => {setActiveTag('TUTTE'); setSearchQuery('');}} className="mt-8 px-8 py-3 bg-slate-900 text-white text-[11px] font-black uppercase tracking-widest rounded-xl hover:bg-black transition-all">Reset Filtri</button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <aside className="w-full lg:w-[400px] shrink-0">
            <div className="bg-[#0f0f0f] rounded-3xl p-8 text-white min-h-[800px] flex flex-col shadow-2xl border border-white/10 sticky top-8">
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h2 className="text-3xl font-black tracking-tighter leading-none">News Log</h2>
                  <div className="flex items-center gap-2 mt-2">
                    <div className={`w-2 h-2 rounded-full ${isLive ? 'bg-emerald-500' : 'bg-amber-500'} animate-pulse`}></div>
                    <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">
                      {isLive ? 'SYSTEM CONNECTED' : 'SYSTEM OFFLINE'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-5xl font-black text-zinc-800 tracking-tighter block">{items.length}</span>
                </div>
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto no-scrollbar pr-2">
                {items.length === 0 && status === AppState.LOADING ? (
                   [1, 2, 3, 4, 5, 6, 7].map(i => (
                    <div key={i} className="flex gap-5 items-center p-4 animate-pulse opacity-20">
                      <div className="w-8 h-8 rounded bg-zinc-800"></div>
                      <div className="flex-1 space-y-2">
                        <div className="w-full h-2.5 bg-zinc-800 rounded"></div>
                        <div className="w-1/2 h-2 bg-zinc-800 rounded"></div>
                      </div>
                    </div>
                  ))
                ) : (
                  items.slice(0, 20).map((item, i) => (
                    <div key={item.id} className="flex gap-5 items-center group cursor-pointer p-4 hover:bg-white/5 rounded-2xl transition-all duration-300 border border-transparent hover:border-white/5">
                      <div className="w-8 h-8 shrink-0 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-600 group-hover:text-emerald-400 font-black text-[10px]">
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-[13px] font-bold truncate group-hover:text-white leading-none mb-1">{item.title}</h4>
                        <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">{item.source.name}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-8 pt-8 border-t border-zinc-800">
                <div className="bg-zinc-900/50 p-4 rounded-2xl border border-zinc-800 text-[10px] text-zinc-500 font-mono truncate">
                  {sourceVersion.split('::')[0]}
                </div>
                <p className="text-[8px] font-bold text-zinc-700 text-center uppercase tracking-widest mt-6 opacity-40">
                  AI Briefing Engine v2.5.0
                </p>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
};

export default App;