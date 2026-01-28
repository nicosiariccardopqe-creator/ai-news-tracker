import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { AppState, NewsItem } from './types';
import { fetchNews } from './services/newsService';
import Navbar from './components/Navbar';
import NewsCard from './components/NewsCard';
import { CATEGORIES } from './constants';

const ErrorModal: React.FC<{ isOpen: boolean; onClose: () => void; errorData: any }> = ({ isOpen, onClose, errorData }) => {
  if (!isOpen) return null;

  const trace = errorData?.trace || {};
  
  const steps = [
    { id: 'BROWSER', label: 'Browser', status: 'success' },
    { id: 'NODE', label: 'Node Proxy', status: trace.step === 'NODE_PROXY' ? 'error' : 'success' },
    { id: 'N8N', label: 'n8n Server', status: (trace.step?.includes('SERVER') || trace.step?.includes('TIMEOUT')) ? 'error' : 'pending' }
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-xl animate-in fade-in duration-300 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden border border-slate-200 my-8">
        <div className="bg-red-600 px-8 py-6 flex justify-between items-center text-white">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/20 rounded-2xl">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            </div>
            <div>
              <h3 className="font-black uppercase tracking-widest text-sm">Dettaglio Errore Tecnico</h3>
              <p className="text-red-100 text-[11px] font-bold opacity-80">Sequenza: Browser → Node → n8n</p>
            </div>
          </div>
          <button onClick={onClose} className="hover:bg-white/10 p-2 rounded-full transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-8 space-y-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 relative">
            <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-100 -translate-y-1/2 hidden md:block"></div>
            {steps.map((step, idx) => (
              <div key={step.id} className="relative z-10 flex flex-col items-center w-full md:w-auto">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg ${
                  step.status === 'success' ? 'bg-emerald-500 text-white' : 
                  step.status === 'error' ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-100 text-slate-300'
                }`}>
                  <span className="font-black text-xs">{idx + 1}</span>
                </div>
                <p className="mt-3 text-[11px] font-black uppercase tracking-tighter text-slate-900">{step.label}</p>
              </div>
            ))}
          </div>

          <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 font-mono text-[11px] text-red-400 overflow-x-auto shadow-inner max-h-64 no-scrollbar">
            <pre>{JSON.stringify(errorData, null, 2)}</pre>
          </div>
        </div>

        <div className="bg-slate-50 px-8 py-6 border-t border-slate-100 flex justify-end gap-3">
          <button onClick={() => window.location.reload()} className="px-6 py-3 bg-white border border-slate-200 text-slate-600 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-slate-100">Reload App</button>
          <button onClick={onClose} className="px-10 py-3 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-black">Chiudi Log</button>
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
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [sourceVersion, setSourceVersion] = useState<string>('');
  const [errorDetails, setErrorDetails] = useState<any>(null);
  const [isErrorModalOpen, setIsErrorModalOpen] = useState(false);

  const handleRefresh = useCallback(async (isInitial = false) => {
    if (isRefreshing && !isInitial) return;
    setIsRefreshing(true);
    setStatus(AppState.LOADING);
    
    try {
      const response = await fetchNews({ tags: activeTag !== 'TUTTE' ? [activeTag] : [] });
      setItems(response.items);
      setSourceVersion(response.source_version);
      setStatus(AppState.SUCCESS);
      
      if (response.source_version.startsWith('fallback-')) {
        const errorPart = response.source_version.split('::')[1];
        try { setErrorDetails(JSON.parse(errorPart)); } catch { setErrorDetails({ message: errorPart }); }
      }
    } catch (error: any) {
      setStatus(AppState.ERROR);
      setErrorDetails({ message: error.message });
      setIsErrorModalOpen(true);
    } finally {
      setIsRefreshing(false);
    }
  }, [activeTag, isRefreshing]);

  useEffect(() => { handleRefresh(true); }, []);

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

  return (
    <div className="min-h-screen pb-12">
      <Navbar />
      <ErrorModal isOpen={isErrorModalOpen} onClose={() => setIsErrorModalOpen(false)} errorData={errorDetails} />

      <main className="max-w-[1400px] mx-auto px-4 sm:px-8">
        <div className="flex flex-col lg:flex-row gap-8 items-start">
          <div className="flex-1 w-full space-y-6">
            
            {/* Statistiche Radar */}
            <section className="bg-white rounded-3xl p-8 card-shadow flex items-center justify-between border border-slate-100 h-36">
               <div className="flex items-center gap-10">
                  <div className="flex items-baseline gap-3">
                    <span className="text-5xl font-black text-slate-900 tracking-tighter">{filteredItems.length}</span>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Post</span>
                  </div>
                  <div className="w-px h-12 bg-slate-100"></div>
                  <div className="flex flex-col">
                    <span className="text-xl font-black text-slate-900 leading-none mb-1">Status Radar</span>
                    <span className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${isLive ? 'text-emerald-500' : 'text-amber-500'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full bg-current ${isLive ? 'animate-pulse' : ''}`}></span>
                      {isLive ? 'Connessione Live' : isFallback ? 'Dati di Backup' : 'Dati Locali'}
                    </span>
                  </div>
               </div>
               <button onClick={() => handleRefresh()} disabled={isRefreshing} className="w-16 h-16 bg-slate-900 text-white rounded-2xl flex items-center justify-center hover:bg-black transition-all shadow-xl active:scale-95 disabled:opacity-50">
                 <svg className={`w-8 h-8 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
               </button>
            </section>

            {/* Design Ricerca Aggiornato: Barra 100% + Tag sotto */}
            <section className="bg-white/80 backdrop-blur-xl rounded-3xl p-8 card-shadow border border-white/50 space-y-6">
              <div className="relative w-full">
                <input 
                  type="text" 
                  placeholder="Cerca tra le ultime notizie di AI..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-16 pl-16 pr-6 bg-slate-100/50 rounded-2xl text-lg font-semibold focus:outline-none focus:ring-4 focus:ring-slate-900/5 border border-slate-200/50 placeholder:text-slate-400"
                />
                <svg className="absolute left-6 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
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

            {/* Avviso Fallback Timeout/Errore */}
            {isFallback && (
              <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-center justify-between">
                <p className="text-xs font-bold text-amber-800 uppercase tracking-tight flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                  Connessione lenta o backend non disponibile (Timeout 60s). News di archivio caricate.
                </p>
                <button onClick={() => setIsErrorModalOpen(true)} className="text-[10px] font-black uppercase text-amber-600 hover:underline">Log Errore</button>
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
                  <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">Nessun risultato trovato</p>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar Flow */}
          <aside className="w-full lg:w-[400px]">
            <div className="bg-[#0a0a0a] rounded-[2.5rem] p-10 text-white min-h-[600px] shadow-2xl sticky top-8 border border-white/5 overflow-hidden">
              <div className="flex justify-between items-center mb-10">
                <h2 className="text-3xl font-black tracking-tighter">News Flow</h2>
                <span className={`w-2 h-2 rounded-full ${isLive ? 'bg-emerald-500 animate-ping' : 'bg-zinc-700'}`}></span>
              </div>
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
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
};

export default App;