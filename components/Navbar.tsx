
import React from 'react';

const Navbar: React.FC = () => {
  return (
    <header className="max-w-[1400px] mx-auto px-4 sm:px-8 pt-6 pb-6">
      <div className="w-full">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 flex flex-col sm:flex-row sm:items-baseline gap-x-6 gap-y-2">
          <span>Il tuo Daily AI Briefing.</span>
          <span className="text-slate-500 text-xs sm:text-sm font-medium tracking-normal max-w-2xl">
            Le notizie più rilevanti selezionate per te in tempo reale. Un solo click per capire il futuro tecnologico.
          </span>
        </h1>
      </div>
    </header>
  );
};

export default Navbar;
