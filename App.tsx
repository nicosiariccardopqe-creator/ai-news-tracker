
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Navbar from './components/Navbar';
import NewsCard from './components/NewsCard';
import { CATEGORIES } from './constants';
import { AppState, NewsItem } from './types';
import { fetchNews, trackTelemetry } from './services/newsService';

const App: React.FC = () => {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [status, setStatus] = useState<AppState>(AppState.IDLE);
  const [activeTag, setActiveTag] = useState('TUTTE');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAutoSyncEnabled, setIsAutoSyncEnabled] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isFallbackMode, setIsFallbackMode] = useState(false);
  
  const autoSyncTimerRef = useRef<number | null>(null);

  const handleRefresh = useCallback(async (isInitial = false, isBackground = false) => {
    if (isRefreshing) return;
    
    setIsRefreshing(true);
    if (!isBackground || items.length === 0) {
      setStatus(AppState.LOADING);
    }
    
    trackTelemetry('cta_refresh_clicked', { isInitial, isBackground });

    try {
      const response = await fetchNews({
        tags: activeTag !== 'TUTTE' ? [activeTag] : [] 
      });
      
      setItems(response.items);
      setLastSync(new Date());
      setIsFallbackMode(response.source_version.includes('fallback'));
      setStatus(response.items.length > 0 ? AppState.SUCCESS : AppState.EMPTY);
    } catch (error: any) {
      console.error("Critical App Error:", error);
      if (items.length === 0) setStatus(AppState.ERROR);
    } finally {
      setIsRefreshing(false);
    }
  }, [activeTag, items.length, isRefreshing]);

  useEffect(() => {
    handleRefresh(true);
  }, []);

  useEffect(() => {
    if (isAutoSyncEnabled) {
      autoSyncTimerRef.current = window.setInterval(() => {
        handleRefresh(false, true);
      }, 30000);
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

  return (
    <div className="min-h-screen pb-8">
      <Navbar />

      <main className="max-w-[1400px] mx-auto px-4 sm:px-8">
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-start">
          
          <div className="flex-1 w-full space-y-4 sm:space-y-6">
            
            {isFallbackMode && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-3 text-amber-800 text-xs font-medium">
                <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span>Connessione n8n limitata. Visualizzazione dati in modalità provvisoria (Mock). Controlla i permessi CORS sul server.</span>
              </div>
            )}

            <section className="bg-white/95 backdrop-blur-md rounded-lg p-3 sm:p-5 card-shadow flex items-center justify-between border border-white/20 min-h-[100px] sm:h-32 text-slate-900">
              <div className="flex items-center gap-4 sm:gap-12 lg:gap-16 px-2 sm:px-6 overflow-x-auto no-scrollbar">
                <div className="flex items-baseline gap-1.5 sm:gap-3 shrink-0">
                  <span className="text-2xl sm:text-3xl font-extrabold tracking-tighter">
                    {status === AppState.LOADING ? '...' : items.length}
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
                      Aggiornato: {lastSync.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  )}
                </div>
                <div className="hidden xs:block w-px h-8 sm:h-10 bg-slate-200 shrink-0"></div>
                <div className="hidden xs:flex items-baseline gap-1.5 sm:gap-3 shrink-0">
                  <div className="relative">
                    <span className={`text-2xl sm:text-3xl font-extrabold tracking-tighter transition-colors duration-500 ${status === AppState.SUCCESS && !isFallbackMode ? 'text-emerald-500' : 'text-slate-300'}`}>
                      {status === AppState.SUCCESS && !isFallbackMode ? 'ON' : 'OFF'}
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
                    <span className={`text-xs font-bold uppercase transition-colors duration-300 ${isAutoSyncEnabled ? 'text-emerald-600' : 'text-slate-400'}`}>
                      {isAutoSyncEnabled ? 'Attivo' : 'Pausa'}
                    </span>
                  </div>
                </div>
                <button 
                  onClick={() => handleRefresh()}
                  className={`w-12 h-12 sm:w-14 sm:h-14 bg-slate-900 text-white rounded-md flex items-center justify-center shadow-lg hover:bg-black active:scale-95 transition-all shrink-0 ${isRefreshing ? 'animate-pulse opacity-80' : ''}`}
                  title="Sincronizza con n8n"
                  disabled={isRefreshing}
                >
                  <svg className={`w-5 h-5 sm:w-6 sm:h-6 ${isRefreshing ? 'animate-spin' : ''}`} fill="currentColor" viewBox="0 0 24 24">
                    <path d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </button>
              </div>
            </section>

            <section className="bg-white/95 backdrop-blur-md rounded-lg p-3 sm:p-5 card-shadow space-y-4 sm:space-y-6 border border-white/20 text-slate-900">
              <div className="flex flex-col md:flex-row justify-between items-stretch sm:items-center gap-4">
                <div className="relative flex-1">
                  <input 
                    type="text" 
                    placeholder="Filtra tra i risultati..."
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              {status === AppState.LOADING && items.length === 0 ? (
                [1, 2, 3, 4].map(i => <div key={i} className="h-64 rounded-lg bg-white/40 backdrop-blur-md border border-slate-900/5 animate-pulse"></div>)
              ) : filteredItems.length > 0 ? (
                filteredItems.map(item => <NewsCard key={item.id} item={item} />)
              ) : (
                <div className="col-span-full py-12 sm:py-20 text-center">
                  <div className="bg-white/50 backdrop-blur-sm rounded-lg p-6 sm:p-8 border border-white/20 inline-block w-full max-w-sm">
                    <h3 className="text-lg sm:text-xl font-bold text-slate-900">Nessun dato</h3>
                    <p className="text-slate-500 mt-2 text-sm">Controlla la connessione al server n8n o cambia filtri.</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <aside className="w-full lg:w-[380px] shrink-0 mt-4 lg:mt-0">
            <div className="bg-[#1a1a1a] rounded-lg p-4 sm:p-6 text-white min-h-[500px] lg:min-h-[720px] flex flex-col shadow-2xl border border-white/5">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl sm:text-3xl font-medium tracking-tight">n8n Inflow</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <div className={`w-2 h-2 rounded-full ${isAutoSyncEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-600'}`}></div>
                    <p className="text-[9px] sm:text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                      {isAutoSyncEnabled ? 'Auto-sync ON' : 'Sync manuale'}
                    </p>
                  </div>
                </div>
                <span className="text-3xl sm:text-4xl font-light text-zinc-500">{items.length}</span>
              </div>

              <div className="flex-1 space-y-3 sm:space-y-4 overflow-y-auto no-scrollbar">
                {items.slice(0, 10).map((item, i) => (
                  <div key={item.id} className="flex gap-4 items-center group cursor-pointer p-3 hover:bg-white/10 hover:translate-x-1 rounded-md transition-all duration-300 ease-out border border-transparent hover:border-white/5">
                    <div className="w-8 h-8 shrink-0 rounded-sm border border-zinc-800 flex items-center justify-center text-zinc-600 group-hover:border-zinc-400 group-hover:text-zinc-200">
                      <span className="text-[10px] font-bold">{i + 1}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold truncate group-hover:text-white transition-colors duration-300 leading-tight">{item.title}</h4>
                      <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mt-1">{item.source.name}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 pt-6 border-t border-zinc-800 text-[9px] font-bold text-zinc-500 text-center uppercase tracking-widest">
                {isFallbackMode ? '⚠️ MODALITÀ FALLBACK' : 'Data via n8n MCP Server'}
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
};

export default App;
