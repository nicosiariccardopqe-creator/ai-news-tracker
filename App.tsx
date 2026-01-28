
import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { AppState, NewsItem } from './types';
import { fetchNews, trackTelemetry } from './services/newsService';
import Navbar from './components/Navbar';
import NewsCard from './components/NewsCard';
import { CATEGORIES } from './constants';

const ErrorModal: React.FC<{ isOpen: boolean; onClose: () => void; errorDetail: string }> = ({ isOpen, onClose, errorDetail }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-xl overflow-hidden border border-slate-200">
        <div className="bg-red-600 px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            <h3 className="text-white font-bold uppercase tracking-widest text-[11px]">Diagnostica di Connessione</h3>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-xs text-slate-600 font-semibold uppercase tracking-wide">Output tecnico del server:</p>
          <div className="bg-slate-900 p-4 rounded border border-slate-800 font-mono text-[10px] text-emerald-400 break-words whitespace-pre-wrap leading-relaxed shadow-inner overflow-y-auto max-h-64">
            {errorDetail || "Nessun log disponibile."}
          </div>
          <div className="p-3 bg-blue-50 border-l-4 border-blue-400 rounded-r">
            <p className="text-[11px] text-blue-700 leading-relaxed">
              <strong>Consiglio:</strong> L'errore "Failed to fetch" indica solitamente un blocco di sicurezza (CORS) nel tuo browser. Abbiamo tentato un aggiramento automatico, ma se continui a vedere questo messaggio, assicurati che il server n8n su Render sia "Active" e non in pausa.
            </p>
          </div>
        </div>
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
          <button onClick={() => window.location.reload()} className="px-5 py-2 border border-slate-200 text-slate-600 text-[10px] font-bold uppercase tracking-widest rounded hover:bg-white transition-colors">Ricarica Pagina</button>
          <button onClick={onClose} className="px-6 py-2 bg-slate-900 text-white text-[10px] font-bold uppercase tracking-widest rounded hover:bg-black transition-colors shadow-lg">Capito</button>
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
    
    // Pulizia Totale: forziamo lo stato a loading e svuotiamo la lista per garantire che i nuovi dati siano visibili
    if (!isBackground) {
      setItems([]); 
      setStatus(AppState.LOADING);
      setSourceVersion('');
    }
    
    trackTelemetry('cta_refresh_clicked', { isInitial, isBackground });

    try {
      const response = await fetchNews({
        tags: activeTag !== 'TUTTE' ? [activeTag] : [] 
      });
      
      // Se riceviamo nuovi item, li impostiamo. Altrimenti rimarranno i fallback (gestiti da newsService)
      setItems(response.items);
      setLastSync(new Date());
      setSourceVersion(response.source_version);
      setStatus(AppState.SUCCESS);
      
    } catch (error: any) {
      console.error("Critical App Error:", error);
      setStatus(AppState.ERROR);
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
      }, 60000); 
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

  const isLive = sourceVersion.includes('mcp') && !sourceVersion.includes('fallback');

  const getErrorMessage = () => {
    const v = sourceVersion.toLowerCase();
    if (v.includes('timeout')) return 'Timeout (60s)';
    if (v.includes('network-cors')) return 'CORS / Rete';
    if (v.includes('http-status-')) return 'Errore Server';
    if (v.includes('empty')) return 'Nessun Dato';
    return 'Sync Fallito';
  };

  const getDetailedError = () => {
    const parts = sourceVersion.split('::');
    return parts.length > 1 ? parts[1] : sourceVersion;
  };

  return (
    <div className="min-h-screen pb-8">
      <Navbar />
      <ErrorModal isOpen={isErrorModalOpen} onClose={() => setIsErrorModalOpen(false)} errorDetail={getDetailedError()} />

      <main className="max-w-[1400px] mx-auto px-4 sm:px-8">
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-start">
          
          <div className="flex-1 w-full space-y-4 sm:space-y-6">
            
            {status === AppState.SUCCESS && !isLive && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center justify-between gap-4 text-amber-800 shadow-sm animate-in fade-in slide-in-from-top-4 duration-500">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-bold uppercase tracking-tight">Modalità Backup: {getErrorMessage()}</p>
                    <p className="text-[11px] font-medium opacity-80">Connessione n8n non riuscita. Visualizzando dati di emergenza.</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button 
                    onClick={() => setIsErrorModalOpen(true)}
                    className="px-3 py-2 text-amber-700 hover:text-amber-900 text-[10px] font-bold uppercase tracking-widest transition-colors flex items-center gap-1"
                  >
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
                    Log
                  </button>
                  <button 
                    onClick={() => handleRefresh()}
                    disabled={isRefreshing}
                    className="px-4 py-2 bg-amber-600 text-white rounded text-[10px] font-bold uppercase tracking-widest hover:bg-amber-700 transition-colors disabled:opacity-50 shadow-sm"
                  >
                    {isRefreshing ? 'In Corso...' : 'Forza Refresh'}
                  </button>
                </div>
              </div>
            )}

            <section className="bg-white/95 backdrop-blur-md rounded-lg p-3 sm:p-5 card-shadow flex items-center justify-between border border-white/20 min-h-[100px] sm:h-32 text-slate-900">
              <div className="flex items-center gap-4 sm:gap-12 lg:gap-16 px-2 sm:px-6 overflow-x-auto no-scrollbar">
                <div className="flex items-baseline gap-1.5 sm:gap-3 shrink-0">
                  <span className="text-2xl sm:text-3xl font-extrabold tracking-tighter">
                    {isRefreshing && items.length === 0 ? '...' : items.length}
                  </span>
                  <span className="text-[8px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest">News</span>
                </div>
                <div className="w-px h-8 sm:h-10 bg-slate-200 shrink-0"></div>
                <div className="flex flex-col justify-center shrink-0">
                   <div className="flex items-baseline gap-1.5 sm:gap-3">
                    <span className="text-2xl sm:text-3xl font-extrabold tracking-tighter">Live</span>
                    <span className="text-[8px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest">Feed</span>
                  </div>
                  {lastSync && (
                    <span className="text-[9px] font-medium text-slate-400 mt-1">
                      Ultimo: {lastSync.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  )}
                </div>
                <div className="hidden xs:block w-px h-8 sm:h-10 bg-slate-200 shrink-0"></div>
                <div className="hidden xs:flex items-baseline gap-1.5 sm:gap-3 shrink-0">
                  <div className="relative">
                    <span className={`text-2xl sm:text-3xl font-extrabold tracking-tighter transition-colors duration-500 ${isLive ? 'text-emerald-500' : 'text-slate-300'}`}>
                      {isLive ? 'ON' : 'OFF'}
                    </span>
                    {isRefreshing && (
                      <span className="absolute -top-1 -right-3 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                      </span>
                    )}
                  </div>
                  <span className="text-[8px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest">Server</span>
                </div>
              </div>

              <div className="flex items-center gap-4 sm:gap-8 pl-4 border-l border-slate-100 sm:border-none">
                <div className="text-right hidden sm:block">
                  <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">Auto-sync</span>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setIsAutoSyncEnabled(!isAutoSyncEnabled)}
                      className={`w-10 h-5 rounded-sm relative p-1 cursor-pointer transition-colors duration-300 ${isAutoSyncEnabled ? 'bg-emerald-500' : 'bg-slate-200/50'}`}
                    >
                      <div className={`w-3 h-3 bg-white rounded-sm shadow-sm transition-transform duration-300 transform ${isAutoSyncEnabled ? 'translate-x-5' : 'translate-x-0'}`}></div>
                    </button>
                  </div>
                </div>
                <button 
                  onClick={() => handleRefresh()}
                  className={`w-12 h-12 sm:w-14 sm:h-14 bg-slate-900 text-white rounded-md flex items-center justify-center shadow-lg hover:bg-black active:scale-95 transition-all shrink-0 ${isRefreshing ? 'animate-pulse opacity-80' : ''}`}
                  title="Svuota e Aggiorna da n8n"
                  disabled={isRefreshing}
                >
                  <svg className={`w-5 h-5 sm:w-6 sm:h-6 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>
            </section>

            <section className="bg-white/95 backdrop-blur-md rounded-lg p-3 sm:p-5 card-shadow space-y-4 sm:space-y-6 border border-white/20 text-slate-900">
              <div className="flex flex-col md:flex-row justify-between items-stretch sm:items-center gap-4">
                <div className="relative flex-1">
                  <input 
                    type="text" 
                    placeholder="Filtra tra le notizie caricate..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full h-12 sm:h-14 pl-12 sm:pl-14 pr-10 sm:pr-12 bg-slate-50 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-slate-200 transition-all border border-slate-100"
                  />
                  <svg className="absolute left-4 sm:left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 overflow-x-auto no-scrollbar pb-1">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setActiveTag(cat)}
                    className={`px-3 sm:px-4 py-2 rounded-sm text-[9px] sm:text-[10px] font-bold tracking-widest border transition-all whitespace-nowrap ${
                      activeTag === cat 
                        ? 'bg-slate-900 text-white border-slate-900 shadow-md' 
                        : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400 shadow-sm'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </section>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 min-h-[400px]">
              {status === AppState.LOADING ? (
                [1, 2, 3, 4, 5, 6].map(i => (
                  <div key={i} className="h-64 rounded-lg bg-white/40 backdrop-blur-md border border-slate-200 animate-pulse flex flex-col p-6 space-y-4">
                    <div className="w-24 h-4 bg-slate-200 rounded"></div>
                    <div className="w-full h-8 bg-slate-200 rounded"></div>
                    <div className="w-3/4 h-8 bg-slate-200 rounded"></div>
                    <div className="flex-1"></div>
                    <div className="w-1/2 h-6 bg-slate-200 rounded"></div>
                  </div>
                ))
              ) : filteredItems.length > 0 ? (
                filteredItems.map(item => <NewsCard key={item.id} item={item} />)
              ) : (
                <div className="col-span-full py-20 text-center">
                  <div className="bg-white/50 backdrop-blur-sm rounded-lg p-8 border border-white/20 inline-block w-full max-w-sm shadow-sm">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 9.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900">Nessuna notizia trovata</h3>
                    <p className="text-slate-500 mt-2 text-sm leading-relaxed">Prova a resettare i filtri o premi il tasto aggiorna per forzare una nuova sincronizzazione da n8n.</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <aside className="w-full lg:w-[380px] shrink-0 mt-4 lg:mt-0">
            <div className="bg-[#121212] rounded-lg p-4 sm:p-6 text-white min-h-[500px] lg:min-h-[720px] flex flex-col shadow-2xl border border-white/5">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight">Debug Panel</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <div className={`w-2 h-2 rounded-full ${isLive ? 'bg-emerald-500' : 'bg-red-500'} animate-pulse`}></div>
                    <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">
                      {isLive ? 'SYSTEM CONNECTED' : 'SYSTEM DISCONNECTED'}
                    </p>
                  </div>
                </div>
                <span className="text-3xl font-light text-zinc-600">{items.length}</span>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto no-scrollbar">
                {items.length === 0 && status === AppState.LOADING ? (
                   [1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                    <div key={i} className="flex gap-4 items-center p-3 animate-pulse opacity-40">
                      <div className="w-6 h-6 rounded bg-zinc-800"></div>
                      <div className="flex-1 space-y-2">
                        <div className="w-full h-2 bg-zinc-800 rounded"></div>
                        <div className="w-1/3 h-1.5 bg-zinc-800 rounded"></div>
                      </div>
                    </div>
                  ))
                ) : (
                  items.slice(0, 15).map((item, i) => (
                    <div key={item.id} className="flex gap-4 items-center group cursor-pointer p-3 hover:bg-white/5 rounded transition-all duration-200 border border-transparent hover:border-white/5">
                      <div className="w-6 h-6 shrink-0 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-600 group-hover:border-zinc-500 group-hover:text-zinc-300">
                        <span className="text-[9px] font-bold">{i + 1}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-semibold truncate group-hover:text-white transition-colors leading-tight">{item.title}</h4>
                        <p className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest mt-0.5">{item.source.name}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-6 pt-6 border-t border-zinc-800 text-[8px] font-bold text-zinc-600 text-center uppercase tracking-widest flex flex-col gap-2">
                <div>Source ID: {sourceVersion.split('::')[0] || 'local_db'}</div>
                <div className="opacity-50">Polling Interval: 60s</div>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
};

export default App;
