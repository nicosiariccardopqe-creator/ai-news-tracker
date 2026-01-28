import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { AppState, NewsItem, ErrorDetail } from './types';
import { fetchNews } from './services/newsService';
import Navbar from './components/Navbar';
import NewsCard from './components/NewsCard';
import DebugModal from './components/DebugModal';
import { CATEGORIES } from './constants';

const App: React.FC = () => {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [status, setStatus] = useState<AppState>(AppState.IDLE);
  const [activeTag, setActiveTag] = useState('TUTTE');
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceVersion, setSourceVersion] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Debug State
  const [lastError, setLastError] = useState<ErrorDetail | null>(null);
  const [isDebugOpen, setIsDebugOpen] = useState(false);

  const handleRefresh = useCallback(async (isInitial = false) => {
    if (isRefreshing && !isInitial) return;
    setIsRefreshing(true);
    setStatus(AppState.LOADING);
    
    const requestPayload = { tags: activeTag !== 'TUTTE' ? [activeTag] : [] };

    try {
      const response = await fetchNews(requestPayload);
      setItems(response.items);
      setSourceVersion(response.source_version);
      setStatus(AppState.SUCCESS);
      
      // Se abbiamo ricevuto un fallback (es. per timeout), catturiamo il dettaglio tecnico
      if (response.source_version.includes('fallback-')) {
        const reason = response.source_version.split('-')[1]?.split('::')[0] || 'unknown';
        setLastError({
          message: reason === 'timeout' 
            ? "Il server ha impiegato più di 30 secondi. Caricate notizie di archivio." 
            : `Dati di backup caricati. Origine: ${response.source_version}`,
          timestamp: new Date().toISOString(),
          payload: requestPayload,
          type: 'API_WARNING',
          stack: new Error().stack
        });
      }
    } catch (error: any) {
      console.error("Errore durante il refresh:", error);
      setStatus(AppState.ERROR);
      setLastError({
        message: error.message || 'Errore di connessione sconosciuto',
        stack: error.stack,
        payload: requestPayload,
        timestamp: new Date().toISOString(),
        type: 'CRITICAL_ERROR'
      });
      setIsDebugOpen(true);
    } finally {
      setIsRefreshing(false);
    }
  }, [activeTag, isRefreshing]);

  useEffect(() => { 
    handleRefresh(true); 
  }, []);

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesTag = activeTag === 'TUTTE' || item.tags.some(t => t.toUpperCase() === activeTag.toUpperCase());
      const matchesSearch = searchQuery === '' || 
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        item.summary.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesTag && matchesSearch;
    });
  }, [items, activeTag, searchQuery]);

  const isLive = sourceVersion === 'backend-proxy-live';
  const isFallback = sourceVersion.startsWith('fallback-');
  const isTimeout = sourceVersion.includes('fallback-timeout');

  return (
    <div className="min-h-screen pb-12 animate-fade-in relative">
      <Navbar />

      <main className="max-w-[1400px] mx-auto px-4 sm:px-8">
        <div className="flex flex-col lg:flex-row gap-8 items-start">
          <div className="flex-1 w-full space-y-6">
            
            {/* Radar Status & Counter */}
            <section className="bg-white rounded-3xl p-8 card-shadow flex items-center justify-between border border-slate-100">
               <div className="flex items-center gap-4 sm:gap-10">
                  <div className="flex items-baseline gap-3">
                    <span className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tighter">{filteredItems.length}</span>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Risultati</span>
                  </div>
                  <div className="w-px h-12 bg-slate-100 hidden sm:block"></div>
                  <div className="flex flex-col">
                    <span className="text-xl font-black text-slate-900 leading-none mb-1">Status Radar</span>
                    <button 
                      onClick={() => lastError && setIsDebugOpen(true)}
                      className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-opacity ${isLive ? 'text-emerald-500' : 'text-amber-500'} ${lastError ? 'cursor-help hover:opacity-70' : ''}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full bg-current ${isLive ? 'animate-pulse' : ''}`}></span>
                      {isLive ? 'Connessione Live' : isTimeout ? 'Timeout 30s' : 'Notizie Archivio'}
                      {lastError && <span className="bg-amber-100 px-1.5 rounded text-[8px]">INFO</span>}
                    </button>
                  </div>
               </div>
               <button 
                onClick={() => handleRefresh()} 
                disabled={isRefreshing} 
                className="w-14 h-14 sm:w-16 sm:h-16 bg-slate-900 text-white rounded-2xl flex items-center justify-center hover:bg-black transition-all shadow-xl active:scale-95 disabled:opacity-50"
               >
                 <svg className={`w-6 h-6 sm:w-8 sm:h-8 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                 </svg>
               </button>
            </section>

            {/* Barra di ricerca e Tag */}
            <section className="bg-white/80 backdrop-blur-xl rounded-3xl p-8 card-shadow border border-white/50 space-y-6">
              <div className="relative w-full">
                <input 
                  type="text" 
                  placeholder="Cerca tra le ultime notizie di AI..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-16 pl-16 pr-6 bg-slate-100/50 rounded-2xl text-lg font-semibold focus:outline-none focus:ring-4 focus:ring-slate-900/5 border border-slate-200/50"
                />
                <svg className="absolute left-6 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              
              <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setActiveTag(cat)}
                    className={`px-5 py-2.5 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all border-2 ${
                      activeTag === cat ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-400 border-slate-100 hover:border-slate-300'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </section>

            {/* Notifica Errore / Debug */}
            {isFallback && (
              <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                  <p className="text-xs font-bold text-amber-800 uppercase tracking-tight">
                    {isTimeout ? 'Server lento (Timeout 30s raggiunto). Visualizzazione notizie di archivio.' : 'Dati live non disponibili. Visualizzazione notizie di archivio.'}
                  </p>
                </div>
                <button 
                  onClick={() => setIsDebugOpen(true)}
                  className="px-3 py-1 bg-amber-200/50 rounded-lg text-[10px] font-black text-amber-900 uppercase hover:bg-amber-300/50 transition-colors"
                >
                  Dettagli
                </button>
              </div>
            )}

            {/* Feed Notizie */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {status === AppState.LOADING ? (
                [1,2,3,4].map(i => <div key={i} className="h-64 bg-white/40 animate-pulse rounded-3xl border border-slate-100"></div>)
              ) : filteredItems.length > 0 ? (
                filteredItems.map(item => <NewsCard key={item.id} item={item} />)
              ) : (
                <div className="col-span-full py-20 text-center bg-white/50 rounded-[3rem] border border-dashed border-slate-200">
                  <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">Nessuna notizia trovata</p>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <aside className="w-full lg:w-[400px]">
            <div className="bg-[#0a0a0a] rounded-[2.5rem] p-10 text-white min-h-[600px] shadow-2xl sticky top-8 border border-white/5 overflow-hidden">
              <h2 className="text-3xl font-black tracking-tighter mb-10">News Flow</h2>
              <div className="space-y-6 max-h-[700px] overflow-y-auto no-scrollbar">
                {items.slice(0, 15).map((item, i) => (
                  <div key={item.id} className="flex gap-5 items-center group cursor-pointer">
                    <span className="text-zinc-800 font-black text-2xl group-hover:text-white transition-colors">{(i+1).toString().padStart(2, '0')}</span>
                    <div className="flex-1 truncate">
                      <p className="font-bold text-sm truncate group-hover:text-emerald-400 transition-colors">{item.title}</p>
                      <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">{item.source.name}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-12 pt-8 border-t border-zinc-900">
                <p className="text-[9px] font-black text-zinc-700 uppercase tracking-[0.4em]">Briefing Engine v2.1</p>
              </div>
            </div>
          </aside>
        </div>
      </main>

      <DebugModal 
        isOpen={isDebugOpen} 
        onClose={() => setIsDebugOpen(false)} 
        error={lastError} 
      />
    </div>
  );
};

export default App;
