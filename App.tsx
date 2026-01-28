import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { AppState, NewsItem } from './types';
import { fetchNews, trackTelemetry } from './services/newsService';
import Navbar from './components/Navbar';
import NewsCard from './components/NewsCard';
import { CATEGORIES } from './constants';

const ErrorModal: React.FC<{ isOpen: boolean; onClose: () => void; errorData: any }> = ({ isOpen, onClose, errorData }) => {
  if (!isOpen) return null;

  const trace = errorData?.trace || {};
  const is404 = errorData?.status === 404 || errorData?.message?.includes('404');
  
  // Identifichiamo dove si è bloccato il flusso
  const steps = [
    { id: 'BROWSER', label: 'Browser', status: 'success', data: trace.payloadSent },
    { id: 'NODE', label: 'Node Proxy', status: trace.step === 'NODE_PROXY' ? 'error' : 'success', data: { endpoint: '/api/mcp/news' } },
    { id: 'N8N', label: 'n8n Server', status: (trace.step === 'N8N_SERVER' || trace.step === 'N8N_SERVER_TIMEOUT') ? 'error' : (trace.step === 'NETWORK_FAILURE' ? 'warning' : 'pending'), data: { url: trace.targetUrl, response: trace.rawResponse || errorData?.details } }
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-xl animate-in fade-in duration-300 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden border border-slate-200 my-8">
        {/* Header */}
        <div className="bg-red-600 px-8 py-6 flex justify-between items-center text-white">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/20 rounded-2xl">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            </div>
            <div>
              <h3 className="font-black uppercase tracking-widest text-sm">Richiesta Fallita</h3>
              <p className="text-red-100 text-[11px] font-bold opacity-80">Rilevato errore nella catena di comunicazione</p>
            </div>
          </div>
          <button onClick={onClose} className="hover:bg-white/10 p-2 rounded-full transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-8 space-y-8">
          {/* Grafico della Chiamata */}
          <div className="relative">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Traccia della Chiamata:</p>
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 relative">
              {/* Linea di collegamento */}
              <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-100 -translate-y-1/2 hidden md:block"></div>
              
              {steps.map((step, idx) => (
                <div key={step.id} className="relative z-10 flex flex-col items-center group w-full md:w-auto">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg transition-all duration-500 ${
                    step.status === 'success' ? 'bg-emerald-500 text-white' : 
                    step.status === 'error' ? 'bg-red-500 text-white animate-pulse' : 
                    step.status === 'warning' ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-300'
                  }`}>
                    {step.status === 'success' ? (
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                    ) : step.status === 'error' ? (
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                    ) : (
                      <span className="font-black text-xs">{idx + 1}</span>
                    )}
                  </div>
                  <div className="mt-3 text-center">
                    <p className="text-[11px] font-black uppercase tracking-tighter text-slate-900">{step.label}</p>
                    <p className={`text-[9px] font-bold ${step.status === 'error' ? 'text-red-500' : 'text-slate-400'}`}>
                      {step.status === 'success' ? 'OK' : step.status === 'error' ? 'ERRORE' : 'IN SOSPESO'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Dettagli JSON */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-slate-500 font-black uppercase tracking-widest flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                  JSON Inviato (Browser)
                </p>
                <span className="text-[9px] font-mono text-slate-300">POST /api/mcp/news</span>
              </div>
              <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 font-mono text-[11px] text-emerald-400 overflow-x-auto shadow-inner h-48 no-scrollbar">
                <pre>{JSON.stringify(trace.payloadSent || { info: "Dato non disponibile" }, null, 2)}</pre>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-slate-500 font-black uppercase tracking-widest flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                  Risposta Errore (Server)
                </p>
                <span className="text-[9px] font-mono text-red-400 font-bold">{errorData?.status || '502'} ERROR</span>
              </div>
              <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 font-mono text-[11px] text-red-400 overflow-x-auto shadow-inner h-48 no-scrollbar">
                <pre>{JSON.stringify(errorData, null, 2)}</pre>
              </div>
            </div>
          </div>

          {/* Alert Box contextuale */}
          <div className="p-5 bg-slate-50 border border-slate-100 rounded-2xl flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <div>
              <h4 className="text-slate-900 text-xs font-black uppercase tracking-tight mb-1">Analisi del Guasto</h4>
              <p className="text-[12px] text-slate-500 leading-relaxed font-medium">
                {trace.step === 'NODE_PROXY' ? 'Il server Node non ha le credenziali necessarie per contattare n8n.' : 
                 trace.step === 'N8N_SERVER' ? `n8n ha risposto con un errore. L'URL "${trace.targetUrl}" potrebbe essere errato o il workflow non è attivo.` :
                 trace.step === 'N8N_SERVER_TIMEOUT' ? 'n8n sta impiegando troppo tempo per elaborare le notizie (oltre 35s).' :
                 'Impossibile stabilire una connessione di rete con il server di destinazione.'}
              </p>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-50 px-8 py-6 border-t border-slate-100 flex flex-wrap justify-end gap-3">
          <button 
            onClick={() => window.location.reload()} 
            className="px-6 py-3 bg-white border border-slate-200 text-slate-600 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-slate-100 transition-all shadow-sm"
          >
            Riavvia Applicazione
          </button>
          <button 
            onClick={onClose} 
            className="px-10 py-3 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-black transition-all shadow-xl shadow-slate-900/20"
          >
            Ho Analizzato
          </button>
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
  const [errorDetails, setErrorDetails] = useState<any>(null);
  const [isErrorModalOpen, setIsErrorModalOpen] = useState(false);
  
  const autoSyncTimerRef = useRef<number | null>(null);

  const handleRefresh = useCallback(async (isInitial = false, isBackground = false) => {
    if (isRefreshing && !isInitial) return;
    
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
      
      if (response.source_version.includes('fallback-backend-failure')) {
        const errorPart = response.source_version.split('::')[1];
        try {
          setErrorDetails(JSON.parse(errorPart));
        } catch (e) {
          setErrorDetails({ message: errorPart });
        }
        setIsErrorModalOpen(true);
      }
      
    } catch (error: any) {
      console.error("Critical UI Error:", error);
      setStatus(AppState.ERROR);
      setErrorDetails({ message: error.message, trace: { step: 'INTERNAL_UI_ERROR' } });
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

  const isLive = sourceVersion.includes('live') && !sourceVersion.includes('fallback');

  const getStatusLabel = () => {
    if (sourceVersion.includes('fallback')) return 'Modalità Fallback';
    return 'Connessione Live';
  };

  return (
    <div className="min-h-screen pb-12">
      <Navbar />
      <ErrorModal isOpen={isErrorModalOpen} onClose={() => setIsErrorModalOpen(false)} errorData={errorDetails} />

      <main className="max-w-[1400px] mx-auto px-4 sm:px-8">
        <div className="flex flex-col lg:flex-row gap-8 items-start">
          
          <div className="flex-1 w-full space-y-6">
            
            {status === AppState.SUCCESS && !isLive && (
              <div className="bg-amber-100/50 border border-amber-200 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 text-amber-900 shadow-xl animate-in slide-in-from-top-4 duration-500">
                <div className="flex items-center gap-5">
                  <div className="w-14 h-14 rounded-2xl bg-amber-200 flex items-center justify-center shrink-0 shadow-inner">
                    <svg className="w-7 h-7 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  </div>
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-amber-700 mb-1">Backup Mode Attivo</p>
                    <p className="text-[13px] font-medium opacity-90 max-w-lg leading-relaxed text-amber-800/80">Il ponte tra il browser e n8n si è interrotto. Stai visualizzando l'ultimo briefing salvato in locale.</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto">
                  <button 
                    onClick={() => setIsErrorModalOpen(true)}
                    className="flex-1 md:flex-none px-5 py-3 text-amber-800 hover:bg-amber-200 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all border border-amber-300/50"
                  >
                    Dettagli Errore
                  </button>
                  <button 
                    onClick={() => handleRefresh()}
                    disabled={isRefreshing}
                    className="flex-1 md:flex-none px-8 py-3 bg-amber-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-700 transition-all disabled:opacity-50 shadow-lg active:scale-95"
                  >
                    {isRefreshing ? 'Re-Sync...' : 'Riprova Live'}
                  </button>
                </div>
              </div>
            )}

            <section className="bg-white rounded-3xl p-8 card-shadow flex items-center justify-between border border-slate-100 h-36 text-slate-900 group">
              <div className="flex items-center gap-6 sm:gap-12 lg:gap-20 px-4 overflow-x-auto no-scrollbar">
                <div className="flex items-baseline gap-4 shrink-0">
                  <span className="text-5xl font-black tracking-tighter text-slate-900">
                    {isRefreshing && items.length === 0 ? '...' : items.length}
                  </span>
                  <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Briefing</span>
                </div>
                <div className="w-px h-14 bg-slate-100 shrink-0"></div>
                <div className="flex flex-col justify-center shrink-0">
                  <div className="flex items-baseline gap-4">
                    <span className="text-5xl font-black tracking-tighter text-slate-900">Live</span>
                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Status</span>
                  </div>
                  {lastSync && (
                    <span className="text-[11px] font-black text-slate-400 mt-2 flex items-center gap-2 uppercase tracking-tight">
                      <span className={`w-2 h-2 rounded-full animate-pulse ${isLive ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                      {lastSync.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
                <div className="hidden xs:block w-px h-14 bg-slate-100 shrink-0"></div>
                <div className="hidden xs:flex items-baseline gap-4 shrink-0">
                  <div className="relative">
                    <span className={`text-5xl font-black tracking-tighter transition-all duration-700 ${isLive ? 'text-emerald-500' : 'text-slate-200'}`}>
                      {isLive ? 'ON' : 'OFF'}
                    </span>
                  </div>
                  <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Proxy</span>
                </div>
              </div>

              <div className="flex items-center gap-8 pl-8 border-l border-slate-100">
                <div className="text-right hidden md:block">
                  <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Auto-Sync</span>
                  <button 
                    onClick={() => setIsAutoSyncEnabled(!isAutoSyncEnabled)}
                    className={`w-14 h-7 rounded-full relative p-1 transition-all duration-500 shadow-inner ${isAutoSyncEnabled ? 'bg-emerald-500' : 'bg-slate-200'}`}
                  >
                    <div className={`w-5 h-5 bg-white rounded-full shadow-md transition-all duration-500 transform ${isAutoSyncEnabled ? 'translate-x-7' : 'translate-x-0'}`}></div>
                  </button>
                </div>
                <button 
                  onClick={() => handleRefresh()}
                  className={`w-20 h-20 bg-slate-900 text-white rounded-[2rem] flex items-center justify-center shadow-2xl hover:bg-black active:scale-90 transition-all shrink-0 group-hover:rotate-12 ${isRefreshing ? 'animate-spin opacity-50' : ''}`}
                  title="Aggiorna"
                  disabled={isRefreshing}
                >
                  <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                </button>
              </div>
            </section>

            <section className="bg-white/80 backdrop-blur-2xl rounded-3xl p-8 card-shadow border border-white/50">
              <div className="flex flex-col gap-6">
                <div className="relative w-full">
                  <input 
                    type="text" 
                    placeholder="Filtra tra le notizie istantanee..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full h-16 pl-16 pr-12 bg-slate-100/50 rounded-2xl text-base font-medium focus:outline-none focus:ring-4 focus:ring-slate-900/10 transition-all border border-slate-200/30 placeholder:text-slate-400"
                  />
                  <svg className="absolute left-6 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </div>
                
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mr-2">Top Trends:</span>
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat}
                      onClick={() => setActiveTag(cat)}
                      className={`px-6 py-2.5 rounded-xl text-[10px] font-black tracking-widest transition-all whitespace-nowrap border-2 ${
                        activeTag === cat 
                          ? 'bg-slate-900 text-white border-slate-900 shadow-xl' 
                          : 'bg-white text-slate-500 border-slate-100 hover:border-slate-300 hover:bg-slate-50 shadow-sm'
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
                  <div key={i} className="h-80 rounded-3xl bg-white/60 animate-pulse border border-slate-100 p-8 space-y-6">
                    <div className="flex justify-between">
                      <div className="w-28 h-5 bg-slate-200 rounded-lg"></div>
                      <div className="w-14 h-5 bg-slate-200 rounded-lg"></div>
                    </div>
                    <div className="w-full h-12 bg-slate-200 rounded-xl"></div>
                    <div className="w-4/5 h-8 bg-slate-200 rounded-xl"></div>
                    <div className="flex-1"></div>
                    <div className="flex gap-3">
                      <div className="w-24 h-6 bg-slate-200 rounded-lg"></div>
                      <div className="w-24 h-6 bg-slate-200 rounded-lg"></div>
                    </div>
                  </div>
                ))
              ) : filteredItems.length > 0 ? (
                filteredItems.map(item => <NewsCard key={item.id} item={item} />)
              ) : (
                <div className="col-span-full py-32 text-center">
                  <div className="bg-white/70 backdrop-blur-md rounded-[3rem] p-16 border border-white/50 inline-block w-full max-w-xl shadow-2xl">
                    <h3 className="text-3xl font-black text-slate-900 tracking-tight">Vuoto Cosmico</h3>
                    <p className="text-slate-500 mt-6 text-base font-medium max-w-xs mx-auto leading-relaxed">Nessuna notizia corrisponde alla tua ricerca attuale. Prova a espandere i filtri.</p>
                    <button onClick={() => {setActiveTag('TUTTE'); setSearchQuery('');}} className="mt-10 px-10 py-4 bg-slate-900 text-white text-xs font-black uppercase tracking-[0.2em] rounded-2xl hover:bg-black transition-all shadow-xl active:scale-95">Reset Radar</button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <aside className="w-full lg:w-[420px] shrink-0">
            <div className="bg-[#0a0a0a] rounded-[2.5rem] p-10 text-white min-h-[850px] flex flex-col shadow-2xl border border-white/5 lg:sticky lg:top-8 overflow-hidden relative">
              {/* Background gradient subtle */}
              <div className="absolute -top-24 -right-24 w-64 h-64 bg-emerald-500/10 blur-[100px] rounded-full"></div>
              
              <div className="flex justify-between items-start mb-10 relative z-10">
                <div>
                  <h2 className="text-3xl font-black tracking-tighter leading-none mb-3">News Flow</h2>
                  <div className="flex items-center gap-2.5">
                    <div className={`w-2.5 h-2.5 rounded-full ${isLive ? 'bg-emerald-500' : 'bg-amber-500'} animate-pulse shadow-[0_0_10px_currentColor]`}></div>
                    <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.25em]">
                      {getStatusLabel().toUpperCase()}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-6xl font-black text-zinc-900 tracking-tighter block leading-none">{items.length}</span>
                </div>
              </div>

              <div className="flex-1 space-y-5 overflow-y-auto no-scrollbar pr-2 relative z-10">
                {items.length === 0 && status === AppState.LOADING ? (
                   [1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                    <div key={i} className="flex gap-6 items-center p-5 animate-pulse opacity-10">
                      <div className="w-10 h-10 rounded-xl bg-zinc-800"></div>
                      <div className="flex-1 space-y-3">
                        <div className="w-full h-3 bg-zinc-800 rounded"></div>
                        <div className="w-2/3 h-2 bg-zinc-800 rounded"></div>
                      </div>
                    </div>
                  ))
                ) : (
                  items.slice(0, 25).map((item, i) => (
                    <div key={item.id} className="flex gap-6 items-center group cursor-pointer p-5 hover:bg-white/[0.03] rounded-3xl transition-all duration-500 border border-transparent hover:border-white/[0.05]">
                      <div className="w-10 h-10 shrink-0 rounded-2xl bg-zinc-900 border border-zinc-800/50 flex items-center justify-center text-zinc-600 group-hover:text-emerald-400 group-hover:border-emerald-500/30 font-black text-xs transition-all duration-500">
                        {String(i + 1).padStart(2, '0')}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-[14px] font-bold truncate group-hover:text-white leading-tight mb-1.5 transition-colors duration-300">{item.title}</h4>
                        <div className="flex items-center gap-3">
                           <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest group-hover:text-zinc-400 transition-colors duration-300">{item.source.name}</p>
                           <span className="w-1 h-1 rounded-full bg-zinc-800"></span>
                           <p className="text-[9px] font-bold text-zinc-700 uppercase tracking-tighter">Verified</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-10 pt-10 border-t border-zinc-900 relative z-10">
                <div className="bg-zinc-900/40 p-5 rounded-2xl border border-zinc-800/50 text-[10px] text-zinc-500 font-mono truncate shadow-inner">
                  UID: {sourceVersion.split('::')[0].toUpperCase()}
                </div>
                <div className="flex justify-between items-center mt-8">
                   <p className="text-[9px] font-black text-zinc-800 uppercase tracking-[0.3em]">
                     AI Briefing Engine v2.6.0
                   </p>
                   <div className="flex gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-zinc-900"></div>
                      <div className="w-1.5 h-1.5 rounded-full bg-zinc-900"></div>
                      <div className="w-1.5 h-1.5 rounded-full bg-zinc-900"></div>
                   </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
};

export default App;