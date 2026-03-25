import React, { useState, useEffect } from 'react';

export const AthlpsSplashScreen = () => {
  const [phase, setPhase] = useState('enter'); // enter -> visible -> exit -> gone

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('visible'), 100);
    const t2 = setTimeout(() => setPhase('exit'), 1200);
    const t3 = setTimeout(() => setPhase('gone'), 1600);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  if (phase === 'gone') return null;

  return (
    <div 
      className="fixed inset-0 z-[9999] bg-black flex items-center justify-center"
      style={{
        opacity: phase === 'exit' ? 0 : 1,
        transition: 'opacity 0.4s ease-out',
      }}
    >
      <div 
        className="text-center"
        style={{
          opacity: phase === 'enter' ? 0 : 1,
          transform: phase === 'enter' ? 'scale(0.8)' : 'scale(1)',
          transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <div className="relative mx-auto mb-6 w-20 h-20">
          <div className="absolute inset-0 bg-amber-500/20 rounded-full blur-xl animate-pulse" />
          <div className="relative flex items-center justify-center w-20 h-20 bg-amber-500/10 rounded-full border border-amber-500/30">
            <span className="text-4xl">⚡</span>
          </div>
        </div>
        <h1 className="text-5xl font-black text-amber-500 tracking-tight">ATHLOS</h1>
        <p className="text-[10px] text-zinc-500 mt-2 uppercase tracking-[0.3em] font-bold">Entrenamiento Premium</p>
      </div>
    </div>
  );
};
