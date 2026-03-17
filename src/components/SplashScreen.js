import React, { useState, useEffect } from 'react';
import { Zap } from 'lucide-react';

/**
 * 🏆 Logo & Splash Screen - Aparece al cargar
 * Optimizado para carga rápida sin dependencias pesadas
 */
export const AthlpsSplashScreen = () => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(false), 800);
    return () => clearTimeout(timer);
  }, []);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black flex items-center justify-center">
      <div className="text-center">
        <div className="animate-bounce mb-6">
          <div className="text-6xl">⚡</div>
        </div>
        <h1 className="text-5xl font-black text-amber-500">ATHLOS</h1>
        <p className="text-sm text-zinc-500 mt-2">Entrenamiento Premium</p>
      </div>
    </div>
  );
};
