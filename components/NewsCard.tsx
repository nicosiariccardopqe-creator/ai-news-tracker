
import React from 'react';
import { NewsItem } from '../types';
import { trackTelemetry } from '../services/newsService';

interface NewsCardProps {
  item: NewsItem;
}

const NewsCard: React.FC<NewsCardProps> = ({ item }) => {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    trackTelemetry('news_click_out', { id: item.id, url: item.url });
    window.open(item.url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div 
      onClick={handleClick}
      className="group bg-white rounded-lg p-4 sm:p-5 card-shadow hover:shadow-2xl transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] cursor-pointer flex flex-col h-full border border-white hover:-translate-y-2 hover:scale-[1.01] sm:hover:scale-[1.02] active:scale-95"
    >
      <div className="flex justify-between items-center mb-3">
        <div className="px-2.5 py-1 rounded-sm bg-slate-50 border border-slate-100 text-[9px] sm:text-[10px] font-bold text-slate-900 tracking-wider group-hover:bg-slate-900 group-hover:text-white transition-colors duration-300 uppercase">
          {item.source.name}
        </div>
        <div className="flex items-center gap-2 sm:gap-3 text-slate-400 text-[10px] sm:text-xs font-medium">
          LIVE
          <span className="w-2 sm:w-2.5 h-2 sm:h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)] group-hover:scale-125 transition-transform duration-500"></span>
        </div>
      </div>

      <div className="flex-1 mb-4">
        <h3 className="text-xl sm:text-2xl font-bold text-slate-900 mb-2 leading-tight group-hover:text-black transition-colors duration-300">
          {item.title}
        </h3>
        <p className="text-slate-500 text-xs sm:text-sm leading-relaxed group-hover:text-slate-600 transition-colors duration-300 line-clamp-3">
          {item.summary}
        </p>
      </div>

      <div className="flex justify-between items-center gap-2">
        <div className="flex flex-wrap gap-1.5 sm:gap-2">
          {item.tags.slice(0, 2).map(tag => (
            <span key={tag} className="px-2 sm:px-3 py-1 rounded-sm bg-blue-50 text-blue-600 text-[9px] sm:text-[10px] font-bold tracking-wide group-hover:bg-blue-600 group-hover:text-white transition-all duration-300 whitespace-nowrap">
              #{tag.replace(/\s+/g, '')}
            </span>
          ))}
        </div>
        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-sm bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-slate-900 group-hover:text-white transition-all duration-300 shrink-0">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        </div>
      </div>
    </div>
  );
};

export default NewsCard;
