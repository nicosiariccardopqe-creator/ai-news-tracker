import React from 'react';
import { ErrorDetail } from '../types';

interface DebugModalProps {
  isOpen: boolean;
  onClose: () => void;
  error: ErrorDetail | null;
}

const DebugModal: React.FC<DebugModalProps> = ({ isOpen, onClose, error }) => {
  if (!isOpen || !error) return null;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(JSON.stringify(error, null, 2));
    alert('Log copiato negli appunti!');
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#0f0f0f] w-full max-w-4xl max-h-[85vh] rounded-3xl overflow-hidden border border-white/10 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-6 bg-zinc-900 flex justify-between items-center border-b border-white/5">
          <div className="flex items-center gap-4">
            <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></div>
            <div>
              <h3 className="text-white font-black text-lg uppercase tracking-tight">System Debug Console</h3>
              <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">{error.timestamp}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={copyToClipboard}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold rounded-lg transition-colors border border-white/5"
            >
              COPY LOG
            </button>
            <button 
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center text-zinc-500 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8 no-scrollbar">
          {/* Message Section */}
          <section>
            <h4 className="text-emerald-500 font-bold text-[10px] uppercase tracking-[0.2em] mb-3">Error Message</h4>
            <div className="bg-black/50 p-4 rounded-xl border border-white/5">
              <p className="text-red-400 font-mono text-sm leading-relaxed">{error.message}</p>
            </div>
          </section>

          {/* Payload Section */}
          <section>
            <h4 className="text-blue-500 font-bold text-[10px] uppercase tracking-[0.2em] mb-3">Request Payload</h4>
            <div className="bg-black/50 p-4 rounded-xl border border-white/5 overflow-x-auto">
              <pre className="text-zinc-400 text-xs leading-5">
                {JSON.stringify(error.payload, null, 2)}
              </pre>
            </div>
          </section>

          {/* Stack Trace Section */}
          <section>
            <h4 className="text-zinc-500 font-bold text-[10px] uppercase tracking-[0.2em] mb-3">Call Stack Trace</h4>
            <div className="bg-black/50 p-4 rounded-xl border border-white/5 overflow-x-auto">
              <pre className="text-zinc-600 text-[10px] leading-5 font-mono whitespace-pre">
                {error.stack || 'No stack trace available'}
              </pre>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="p-6 bg-zinc-900 border-t border-white/5 text-center">
          <p className="text-zinc-600 text-[9px] font-black uppercase tracking-[0.3em]">AI News Engine Debugger v2.4.1</p>
        </div>
      </div>
    </div>
  );
};

export default DebugModal;