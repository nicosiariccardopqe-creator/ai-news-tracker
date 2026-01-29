
import React, { useState, useCallback, useMemo, useRef } from 'react';
import { AppState, NewsItem, ErrorDetail } from './types';
import { fetchNews, checkProxyStatus } from './services/newsService';
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
  
  const [logHistory, setLogHistory] = useState<ErrorDetail[]>([]);
  const [selectedLog, setSelectedLog] = useState<ErrorDetail | null>(null);
  const [isDebugOpen, setIsDebugOpen] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);

  const addLog = (message: string, type: string = 'INFO', payload: any = {}) => {
    const newLog: ErrorDetail = {
      message,
      timestamp: new Date().toLocaleTimeString(),
      type: type.toUpperCase(),
      payload
    };
    setLogHistory(prev => [newLog, ...prev].slice(0, 50)); 
  };

  const handleRefresh = useCallback(async () => {
    if (isRefreshing) {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      setIsRefreshing(false);
      return;
    }

    setIsRefreshing(true);
    setStatus(AppState.LOADING);
    addLog("Browser -> Inizio chiamata a Node Server", "NETWORK");

    abortControllerRef.current = new AbortController();

    try {
      // Singola chiamata verso il server Node
      const result = await fetchNews(
        { tags: activeTag === 'TUTTE' ? [] : [activeTag] },
        undefined,
        abortControllerRef.current.signal
      );
      
      // Se il server ha inviato un trace delle operazioni interne (Proxy -> n8n), lo mostriamo
      if (result.serverTrace) {
        result.serverTrace.forEach(msg => addLog(msg, "DEBUG"));
      }

      const newsItems = result.data.items || [];
      setItems(newsItems);
      setStatus(newsItems.length ? AppState.SUCCESS : AppState.EMPTY);
      addLog("Risposta ricevuta con successo dal server Node", "SUCCESS");

    } catch (error: any) {
      if (error.name === 'AbortError') return;
      
      if (error.serverTrace) {
        error.serverTrace.forEach((msg: string) => addLog(msg, "ERROR"));
      }

      addLog(`FALLIMENTO: ${error.message || 'Errore di connessione'}`, "ERROR", error);
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
                      {status === AppState.LOADING ? 'Chiamata Node in corso...' : 'Pronto'}
                    </div>
                  </div>
               </div>
               
               <button 
                onClick={handleRefresh} 
                className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all shadow-xl active:scale-95 ${isRefreshing ? 'bg-red-500' : 'bg-slate-900'} text-white`}
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
              <input 
                type="text" 
                placeholder="Cerca nelle notizie..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-16 px-6 bg-slate-100/50 rounded-2xl text-lg font-semibold focus:outline-none"
              />
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map(cat => (
                  <button key={cat} onClick={() => setActiveTag(cat)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${activeTag === cat ? 'bg-slate-900 text-white' : 'bg-white text-slate-400 border border-slate-100'}`}>{cat}</button>
                ))}
              </div>
            </section>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {filteredItems.map(item => <NewsCard key={item.id} item={item} />)}
            </div>

            {/* TERMINALE DIAGNOSTICO - MOSTRA IL FLUSSO BROWSER -> NODE -> N8N */}
            <section className="bg-[#050505] rounded-[2.5rem] border border-white/5 shadow-2xl overflow-hidden mt-12">
              <div className="px-8 py-5 border-b border-white/5 bg-zinc-900/50 flex items-center gap-4">
                <div className="w-3 h-3 rounded-full bg-emerald-500/20 border border-emerald-500/40"></div>
                <span className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em]">Full-Stack Trace (Browser ➔ Node ➔ n8n)</span>
              </div>
              <div className="p-6 h-[300px] overflow-y-auto font-mono text-[11px] no-scrollbar bg-black/40">
                {logHistory.map((log, i) => (
                  <div key={i} onClick={() => { setSelectedLog(log); setIsDebugOpen(true); }} className="flex items-center gap-4 py-2 hover:bg-white/5 cursor-pointer px-4 rounded-lg">
                    <span className="text-zinc-600 shrink-0">[{log.timestamp}]</span>
                    <span className={`font-black text-[8px] px-1.5 py-0.5 rounded border ${log.type === 'ERROR' ? 'text-red-500 border-red-500/30' : 'text-zinc-500 border-zinc-500/30'}`}>
                      {log.type}
                    </span>
                    <span className="text-zinc-300 truncate">{log.message}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <aside className="w-full lg:w-[400px]">
            <div className="bg-[#0a0a0a] rounded-[2.5rem] p-10 text-white min-h-[600px] sticky top-8 border border-white/5">
              <h2 className="text-3xl font-black tracking-tighter mb-10">Top Stories</h2>
              <div className="space-y-6">
                {items.slice(0, 8).map((item, i) => (
                  <div key={item.id} className="flex gap-5 items-center border-b border-white/5 pb-4 last:border-0">
                    <span className="text-zinc-800 font-black text-2xl">{(i+1).toString().padStart(2, '0')}</span>
                    <p className="font-bold text-sm text-zinc-400 line-clamp-2">{item.title}</p>
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
