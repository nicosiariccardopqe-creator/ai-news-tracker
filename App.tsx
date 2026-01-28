
import React, { useState, useCallback, useMemo } from 'react';
import { AppState, NewsItem, ErrorDetail } from './types';
import { fetchNews, fetchMockNews, MCP_ENDPOINT } from './services/newsService';
import Navbar from './components/Navbar';
import NewsCard from './components/NewsCard';
import DebugModal from './components/DebugModal';
import { CATEGORIES } from './constants';

const App: React.FC = () => {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [status, setStatus] = useState<AppState>(AppState.IDLE);
  const [activeTag, setActiveTag] = useState('TUTTE');
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Debug & Logging State
  const [logHistory, setLogHistory] = useState<ErrorDetail[]>([]);
  const [selectedLog, setSelectedLog] = useState<ErrorDetail | null>(null);
  const [isDebugOpen, setIsDebugOpen] = useState(false);

  const addLog = (message: string, type: string = 'INFO', payload: any = {}, stack?: string) => {
    const newLog: ErrorDetail = {
      message,
      timestamp: new Date().toLocaleTimeString(),
      type,
      payload,
      stack: stack || 'No stack trace available'
    };
    setLogHistory(prev => [newLog, ...prev].slice(0, 50));
  };

  const loadFallback = async (payload: any) => {
    try {
      const fallbackResponse = await fetchMockNews(payload);
      setItems(fallbackResponse.items);
      setStatus(AppState.SUCCESS);
      addLog(`Success: System restored using default local dataset.`, 'WARNING');
    } catch (fallbackError: any) {
      addLog("FATAL: All data providers unreachable.", 'FATAL', {}, fallbackError.stack);
      setStatus(AppState.ERROR);
    }
  };

  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setStatus(AppState.LOADING);
    
    // Configurazione chiamata MCP
    const requestPayload = { tags: [] }; 
    const activeTools = ['news_fetcher_v1']; // Definizione tools utilizzati per la connessione MCP
    const payloadStr = JSON.stringify(requestPayload);
    const toolsStr = activeTools.join(', ');
    
    // Log completo richiesto: URL, Tools, Payload
    addLog(`CALL MCP [${MCP_ENDPOINT}] | TOOLS: [${toolsStr}] | PAYLOAD: ${payloadStr}`, 'NETWORK', { 
      url: MCP_ENDPOINT, 
      tools: activeTools, 
      payload: requestPayload 
    });

    try {
      // TENTATIVO 1: Server MCP (Primary)
      const response = await fetchNews(requestPayload);
      setItems(response.items);
      setStatus(AppState.SUCCESS);
      addLog(`HTTP 200 OK: Data synced from ${MCP_ENDPOINT} using ${toolsStr}.`, 'SUCCESS');
    } catch (error: any) {
      console.error("MCP Connection Error:", error);
      addLog(
        `SYNC FAIL: [${MCP_ENDPOINT}] - ${error.message}`, 
        'ERROR', 
        { url: MCP_ENDPOINT, tools: activeTools, payload: requestPayload }, 
        error.stack || error.originalStack
      );

      addLog("Initializing local engine fallback...", 'SYSTEM');
      await loadFallback(requestPayload);
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing]);

  const handleForceDefault = async () => {
    addLog("MANUAL OVERRIDE: User requested local dataset loading.", 'OVERRIDE');
    setIsRefreshing(false);
    await loadFallback({ tags: [] });
  };

  const handleTagClick = (tag: string) => {
    setActiveTag(tag);
    addLog(`Local Filter Applied: ${tag}`, 'INFO', { tag });
  };

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesSearch = searchQuery === '' || 
        (item.title && item.title.toLowerCase().includes(searchQuery.toLowerCase())) || 
        (item.summary && item.summary.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesTag = activeTag === 'TUTTE' || 
        (item.tags && item.tags.some(t => t.toUpperCase() === activeTag.toUpperCase()));

      return matchesSearch && matchesTag;
    });
  }, [items, searchQuery, activeTag]);

  const openLogDetails = (log: ErrorDetail) => {
    setSelectedLog(log);
    setIsDebugOpen(true);
  };

  return (
    <div className="min-h-screen pb-12 animate-fade-in relative">
      <Navbar />

      <main className="max-w-[1400px] mx-auto px-4 sm:px-8">
        <div className="flex flex-col lg:flex-row gap-8 items-start">
          <div className="flex-1 w-full space-y-6">
            
            {/* News Header & Counter */}
            <section className="bg-white rounded-3xl p-8 card-shadow flex items-center justify-between border border-slate-100">
               <div className="flex items-center gap-4 sm:gap-10">
                  <div className="flex items-baseline gap-3">
                    <span className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tighter">{filteredItems.length}</span>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Articoli</span>
                  </div>
                  <div className="w-px h-12 bg-slate-100 hidden sm:block"></div>
                  <div className="flex flex-col">
                    <span className="text-xl font-black text-slate-900 leading-none mb-1">AI Radar</span>
                    <div className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${status === AppState.IDLE ? 'text-slate-400' : 'text-emerald-500'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full bg-current ${status === AppState.LOADING ? 'animate-ping' : ''}`}></span>
                      {status === AppState.IDLE ? 'System Ready' : 'Engine Active'}
                    </div>
                  </div>
               </div>
               
               <div className="flex gap-3">
                 {isRefreshing && (
                    <button 
                      onClick={handleForceDefault}
                      className="hidden sm:flex px-6 items-center gap-3 bg-amber-500 hover:bg-amber-400 text-black rounded-2xl transition-all shadow-lg shadow-amber-500/20 active:scale-95 group"
                    >
                      <span className="w-2 h-2 bg-black rounded-full animate-ping"></span>
                      <span className="text-[10px] font-black uppercase tracking-widest">Force Local</span>
                    </button>
                 )}
                 <button 
                  onClick={handleRefresh} 
                  disabled={isRefreshing} 
                  className="w-14 h-14 sm:w-16 sm:h-16 bg-slate-900 text-white rounded-2xl flex items-center justify-center hover:bg-black transition-all shadow-xl active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  title={isRefreshing ? "Syncing..." : "Sync News"}
                 >
                   <svg className={`w-6 h-6 sm:w-8 sm:h-8 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                   </svg>
                 </button>
               </div>
            </section>

            {/* Filters & Search */}
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
                    onClick={() => handleTagClick(cat)}
                    className={`px-5 py-2.5 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all border-2 ${
                      activeTag === cat ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-400 border-slate-100 hover:border-slate-300'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </section>

            {/* Feed Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {status === AppState.LOADING ? (
                [1,2,3,4].map(i => <div key={i} className="h-64 bg-white/40 animate-pulse rounded-3xl border border-slate-100"></div>)
              ) : filteredItems.length > 0 ? (
                filteredItems.map(item => <NewsCard key={item.id} item={item} />)
              ) : (
                <div className="col-span-full py-24 text-center bg-white/50 rounded-[3rem] border border-dashed border-slate-200">
                  <div className="mb-4 flex justify-center">
                    <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-300">
                       <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10l4 4v10a2 2 0 01-2 2z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 4v4h4" />
                       </svg>
                    </div>
                  </div>
                  <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">
                    {status === AppState.IDLE ? "Avvia la scansione per visualizzare le news" : "Nessuna notizia trovata con i filtri attuali"}
                  </p>
                </div>
              )}
            </div>

            {/* GRAFICA LOG: System Terminal */}
            <section className="bg-zinc-950 rounded-[2.5rem] border border-white/5 shadow-2xl overflow-hidden mt-12 group">
              <div className="px-8 py-5 border-b border-white/5 bg-zinc-900/50 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/40"></div>
                    <div className="w-3 h-3 rounded-full bg-amber-500/20 border border-amber-500/40"></div>
                    <div className="w-3 h-3 rounded-full bg-emerald-500/20 border border-emerald-500/40"></div>
                  </div>
                  <span className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em] ml-4">System Live Terminal</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="h-4 w-px bg-white/10"></div>
                  <span className="text-[10px] font-bold text-emerald-500 animate-pulse uppercase tracking-widest">Log Monitoring Active</span>
                </div>
              </div>
              <div className="p-6 h-[300px] overflow-y-auto font-mono text-[11px] leading-relaxed no-scrollbar bg-black/40">
                {logHistory.length > 0 ? (
                  logHistory.map((log, i) => (
                    <div 
                      key={i} 
                      onClick={() => openLogDetails(log)}
                      className="flex gap-4 py-1.5 hover:bg-white/5 cursor-pointer px-2 rounded transition-colors group/line border-b border-white/5 last:border-0"
                    >
                      <span className="text-zinc-600 shrink-0">[{log.timestamp}]</span>
                      <span className={`font-bold shrink-0 w-20 ${
                        log.type === 'ERROR' || log.type === 'FATAL' ? 'text-red-500' : 
                        log.type === 'SUCCESS' ? 'text-emerald-500' : 
                        log.type === 'WARNING' || log.type === 'OVERRIDE' ? 'text-amber-500' : 
                        log.type === 'NETWORK' ? 'text-blue-500' : 'text-zinc-400'
                      }`}>
                        {log.type}
                      </span>
                      <span className="text-zinc-300 group-hover/line:text-white truncate max-w-[500px]">{log.message}</span>
                      {log.stack !== 'No stack trace available' && (
                        <span className="bg-red-500/10 text-red-500 px-1.5 py-0.5 rounded text-[8px] font-black uppercase ml-2 border border-red-500/20 animate-pulse">
                          Stack Info
                        </span>
                      )}
                      <span className="ml-auto text-zinc-700 opacity-0 group-hover/line:opacity-100 transition-opacity uppercase font-black text-[8px]">Inspect +</span>
                    </div>
                  ))
                ) : (
                  <div className="h-full flex flex-col items-center justify-center opacity-40">
                    <p className="text-zinc-400 uppercase tracking-[0.5em] font-black mb-2 animate-pulse">Waiting for commands...</p>
                    <p className="text-zinc-700 text-[10px] font-mono uppercase tracking-widest">Telemetry stream idle</p>
                  </div>
                )}
              </div>
              <div className="px-8 py-3 bg-zinc-900/30 border-t border-white/5 flex justify-between items-center">
                <div className="flex items-center gap-2 text-zinc-600 text-[9px] font-bold uppercase">
                  <span>Connection:</span>
                  <span className={status === AppState.IDLE ? 'text-zinc-500' : 'text-emerald-500'}>
                    {status === AppState.IDLE ? 'Offline' : 'Active Channel'}
                  </span>
                </div>
                {isRefreshing && (
                  <button 
                    onClick={handleForceDefault}
                    className="text-amber-500 text-[9px] font-black uppercase tracking-widest hover:underline animate-pulse flex items-center gap-2"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                    Emergency Local Override
                  </button>
                )}
              </div>
            </section>

          </div>

          {/* Sidebar */}
          <aside className="w-full lg:w-[400px]">
            <div className="bg-[#0a0a0a] rounded-[2.5rem] p-10 text-white min-h-[600px] shadow-2xl sticky top-8 border border-white/5 overflow-hidden">
              <h2 className="text-3xl font-black tracking-tighter mb-10">Trending Now</h2>
              <div className="space-y-6 max-h-[700px] overflow-y-auto no-scrollbar">
                {items.length > 0 ? (
                  items.slice(0, 10).map((item, i) => (
                    <div key={item.id} className="flex gap-5 items-center group cursor-pointer">
                      <span className="text-zinc-800 font-black text-2xl group-hover:text-white transition-colors">{(i+1).toString().padStart(2, '0')}</span>
                      <div className="flex-1 truncate">
                        <p className="font-bold text-sm truncate group-hover:text-emerald-400 transition-colors">{item.title}</p>
                        <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">{item.source?.name || 'AI Brief'}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-zinc-700 text-xs font-bold uppercase tracking-widest text-center mt-20">No trends available</p>
                )}
              </div>
            </div>
          </aside>
        </div>
      </main>

      <DebugModal 
        isOpen={isDebugOpen} 
        onClose={() => setIsDebugOpen(false)} 
        error={selectedLog} 
      />
    </div>
  );
};

export default App;
