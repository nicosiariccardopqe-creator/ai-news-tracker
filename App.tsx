
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
  const autoSyncTimerRef = useRef<number | null>(null);

  // Fetch news from "API"
  const handleRefresh = useCallback(async (isInitial = false) => {
    if (status === AppState.LOADING) return;
    setStatus(AppState.LOADING);
    trackTelemetry('cta_refresh_clicked', { isInitial });

    try {
      const response = await fetchNews({
        tags: [] 
      });
      setItems(response.items);
      setStatus(AppState.SUCCESS);
    } catch (error: any) {
      console.error("Fetch error:", error);
      setStatus(AppState.ERROR);
    }
  }, [status]);

  useEffect(() => {
    handleRefresh(true);
  }, []);

  // Auto-sync Logic
  useEffect(() => {
    if (isAutoSyncEnabled) {
      autoSyncTimerRef.current = window.setInterval(() => {
        handleRefresh();
      }, 30000);
    } else {
      if (autoSyncTimerRef.current) {
        clearInterval(autoSyncTimerRef.current);
      }
    }

    return () => {
      if (autoSyncTimerRef.current) {
        clearInterval(autoSyncTimerRef.current);
      }
    };
  }, [isAutoSyncEnabled, handleRefresh]);

  // Real-time filtering logic
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesTag = activeTag === 'TUTTE' || item.tags.some(t => t.toUpperCase() === activeTag.toUpperCase());
      
      const searchLower = searchQuery.toLowerCase().trim();
      const matchesSearch = searchLower === '' || 
        item.title.toLowerCase().includes(searchLower) ||
        item.summary.toLowerCase().includes(searchLower) ||
        item.tags.some(t => t.toLowerCase().includes(searchLower));

      return matchesTag && matchesSearch;
    });
  }, [items, activeTag, searchQuery]);

  return (
    <div className="min-h-screen pb-8">
      <Navbar />

      <main className="max-w-[1400px] mx-auto px-4 sm:px-8">
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-start">
          
          {/* Left Column: Stats, Filters, and News Grid */}
          <div className="flex-1 w-full space-y-4 sm:space-y-6">
            
            {/* Top Header Bar: Stats & Controls */}
            <section className="bg-white/95 backdrop-blur-md rounded-lg p-3 sm:p-5 card-shadow flex items-center justify-between border border-white/20 min-h-[100px] sm:h-32 text-slate-900">
              <div className="flex items-center gap-4 sm:gap-12 lg:gap-16 px-2 sm:px-6 overflow-x-auto no-scrollbar">
                <div className="flex items-baseline gap-1.5 sm:gap-3 shrink-0">
                  <span className="text-2xl sm:text-3xl font-extrabold tracking-tighter">78</span>
                  <span className="text-[8px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest">Fonti</span>
                </div>
                <div className="w-px h-8 sm:h-10 bg-slate-200 shrink-0"></div>
                <div className="flex items-baseline gap-1.5 sm:gap-3 shrink-0">
                  <span className="text-2xl sm:text-3xl font-extrabold tracking-tighter">203</span>
                  <span className="text-[8px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest">Trend</span>
                </div>
                <div className="hidden xs:block w-px h-8 sm:h-10 bg-slate-200 shrink-0"></div>
                <div className="hidden xs:flex items-baseline gap-1.5 sm:gap-3 shrink-0">
                  <span className={`text-2xl sm:text-3xl font-extrabold tracking-tighter transition-colors duration-500 ${isAutoSyncEnabled ? 'text-emerald-500' : 'text-slate-300'}`}>Live</span>
                  <span className="text-[8px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</span>
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
                      {isAutoSyncEnabled ? 'Active' : 'Idle'}
                    </span>
                  </div>
                </div>
                <button 
                  onClick={() => handleRefresh()}
                  className={`w-12 h-12 sm:w-14 sm:h-14 bg-slate-900 text-white rounded-md flex items-center justify-center shadow-lg hover:bg-black active:scale-95 transition-all shrink-0 ${status === AppState.LOADING ? 'animate-spin opacity-50' : ''}`}
                  title="Aggiorna le news"
                  disabled={status === AppState.LOADING}
                >
                  <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </button>
              </div>
            </section>

            {/* Search & Filters Section */}
            <section className="bg-white/95 backdrop-blur-md rounded-lg p-3 sm:p-5 card-shadow space-y-4 sm:space-y-6 border border-white/20 text-slate-900">
              <div className="flex flex-col md:flex-row justify-between items-stretch sm:items-center gap-4">
                <div className="relative flex-1">
                  <input 
                    type="text" 
                    placeholder="Filtra per testo o tag..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full h-12 sm:h-14 pl-12 sm:pl-14 pr-10 sm:pr-12 bg-slate-50 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-slate-200 transition-all border border-slate-100"
                  />
                  <svg className="absolute left-4 sm:left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  {searchQuery && (
                    <button 
                      onClick={() => setSearchQuery('')}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
                
                <div className="bg-slate-50 p-1.5 sm:p-2 rounded-md flex gap-2 border border-slate-100 overflow-x-auto no-scrollbar">
                  {['TUTTE', 'OGGI', 'SETTIMANA'].map(t => (
                    <button 
                      key={t}
                      className={`px-3 sm:px-4 py-1.5 rounded-sm text-[9px] sm:text-[10px] font-bold tracking-widest transition-all whitespace-nowrap ${t === 'TUTTE' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-900'}`}
                    >
                      {t}
                    </button>
                  ))}
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

            {/* News Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              {status === AppState.LOADING && items.length === 0 ? (
                [1, 2, 3, 4].map(i => <div key={i} className="h-64 rounded-lg bg-white/40 backdrop-blur-md border border-slate-900/5 animate-pulse"></div>)
              ) : status === AppState.ERROR && items.length === 0 ? (
                <div className="col-span-full py-12 sm:py-20 text-center">
                  <div className="bg-white/50 backdrop-blur-sm rounded-lg p-6 sm:p-8 border border-red-100 inline-block w-full max-w-sm">
                    <svg className="w-10 h-10 sm:w-12 sm:h-12 text-red-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <h3 className="text-lg sm:text-xl font-bold text-slate-900">Errore di Sincronizzazione</h3>
                    <p className="text-slate-500 mt-2 text-sm">Non siamo riusciti a contattare il server. Riprova tra poco.</p>
                    <button 
                      onClick={() => handleRefresh()}
                      className="mt-6 px-6 py-2 bg-slate-900 text-white rounded-md text-[10px] sm:text-xs font-bold tracking-widest hover:bg-black transition-all"
                    >
                      RIPROVA ORA
                    </button>
                  </div>
                </div>
              ) : filteredItems.length > 0 ? (
                filteredItems.map(item => <NewsCard key={item.id} item={item} />)
              ) : (
                <div className="col-span-full py-12 sm:py-20 text-center">
                  <div className="bg-white/50 backdrop-blur-sm rounded-lg p-6 sm:p-8 border border-white/20 inline-block w-full max-w-sm">
                    <svg className="w-10 h-10 sm:w-12 sm:h-12 text-slate-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 9.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h3 className="text-lg sm:text-xl font-bold text-slate-900">Nessun risultato</h3>
                    <p className="text-slate-500 mt-2 text-sm">Prova a cambiare i filtri o la query di ricerca.</p>
                    <button 
                      onClick={() => { setSearchQuery(''); setActiveTag('TUTTE'); }}
                      className="mt-6 px-6 py-2 bg-slate-900 text-white rounded-md text-[10px] sm:text-xs font-bold tracking-widest hover:bg-black transition-all"
                    >
                      RESET FILTRI
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Sidebar Feed */}
          <aside className="w-full lg:w-[380px] shrink-0 mt-4 lg:mt-0">
            <div className="bg-[#1a1a1a] rounded-lg p-4 sm:p-6 text-white min-h-[500px] lg:min-h-[720px] flex flex-col shadow-2xl border border-white/5">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl sm:text-3xl font-medium tracking-tight">Live Feed</h2>
                  <p className="text-[9px] sm:text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">Live Sync {isAutoSyncEnabled ? 'ACTIVE' : 'READY'}</p>
                </div>
                <span className="text-3xl sm:text-4xl font-light text-zinc-500">{filteredItems.length > 0 ? filteredItems.length : items.length}/50</span>
              </div>

              <div className="flex-1 space-y-3 sm:space-y-4 overflow-y-auto no-scrollbar">
                {[
                  { title: "OpenAI lancia 'SearchGPT' in closed beta", source: "TECHCRUNCH", hot: true, time: "2m fa" },
                  { title: "Meta rilascia Llama 3.1: 405B parametri open", source: "THE VERGE", hot: true, time: "15m fa" },
                  { title: "UE: Primi test tecnici per l'AI Act Regulation", source: "REUTERS", hot: false, time: "1h fa" },
                  { title: "DeepMind scopre nuovi materiali per batterie", source: "NATURE", hot: false, time: "2h fa" },
                  { title: "NVIDIA H200: Prime spedizioni ai data center", source: "BLOOMBERG", hot: false, time: "3h fa" },
                  { title: "Grok-2: Primi benchmark superano GPT-4o", source: "X.COM", hot: true, time: "4h fa" },
                  { title: "Apple Intelligence: Nuove API per sviluppatori", source: "9TO5MAC", hot: false, time: "5h fa" },
                  { title: "Mistral Large 2: Il nuovo re europeo dell'AI", source: "MEDIUM", hot: true, time: "6h fa" },
                ].map((feed, i) => (
                  <div key={i} className="flex gap-4 items-center group cursor-pointer p-3 hover:bg-white/10 hover:translate-x-1 rounded-md transition-all duration-300 ease-out border border-transparent hover:border-white/5">
                    <div className="w-10 h-10 shrink-0 rounded-sm border border-zinc-800 flex items-center justify-center text-zinc-600 group-hover:border-zinc-400 group-hover:text-zinc-200 transition-all duration-300">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold truncate group-hover:text-white transition-colors duration-300 leading-tight">{feed.title}</h4>
                      <div className="flex items-center gap-3 mt-1">
                        <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest group-hover:text-zinc-400 transition-colors duration-300">{feed.source}</p>
                        <span className="text-[9px] text-zinc-600">•</span>
                        <p className="text-[9px] font-medium text-zinc-600 italic group-hover:text-zinc-500 transition-colors duration-300">{feed.time}</p>
                      </div>
                    </div>
                    {feed.hot && (
                      <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-yellow-400 shadow-[0_0_12px_rgba(250,204,21,0.8)] group-hover:scale-125 transition-transform duration-300"></div>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-6 pt-6 border-t border-zinc-800">
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-[9px] sm:text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-1">Performance</p>
                    <h3 className="text-xl sm:text-2xl font-medium">Daily Inflow</h3>
                  </div>
                  <span className="text-xl sm:text-2xl font-medium text-emerald-400">+12%</span>
                </div>
                
                <div className="flex justify-between mt-4 text-[8px] font-bold text-zinc-700 uppercase tracking-widest px-1">
                  <span>L</span><span>M</span><span>M</span><span>G</span><span>V</span><span>S</span><span>D</span>
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
