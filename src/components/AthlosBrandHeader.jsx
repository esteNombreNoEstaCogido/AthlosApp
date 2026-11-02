import React, { useState, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';

/**
 * 🏆 ATHLOS - Brand Header Component
 * Features:
 * - Premium logo display with dark background
 * - Daily motivational phrase
 * - Real-time updates from Firestore
 * - Admin-controlled content
 */

const DEFAULT_PHRASES = [
  "La consistencia es la clave del éxito 💪",
  "Cada serie te acerca a tu meta 🎯",
  "Tu cuerpo es capaz de más de lo que crees 🔥",
  "Hoy es el día perfecto para entrenar 💯",
  "La disciplina vence la motivación 🏅",
  "Eres más fuerte de lo que eras ayer 🌟",
  "El dolor es debilidad abandonando su cuerpo 🚀",
  "Entrena como si fuera tu primer día 🎪",
];

export const AthlosBrandHeader = ({ 
  dailyPhrase = null, 
  colorPalette = null,
  isAdmin = false,
  onAdminEditPhrase = null 
}) => {
  const [currentPhrase, setCurrentPhrase] = useState(dailyPhrase || DEFAULT_PHRASES[0]);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(currentPhrase);

  useEffect(() => {
    if (dailyPhrase) {
      setCurrentPhrase(dailyPhrase);
    }
  }, [dailyPhrase]);

  const handleSavePhrase = () => {
    if (editValue.trim() && onAdminEditPhrase) {
      onAdminEditPhrase(editValue);
      setCurrentPhrase(editValue);
      setIsEditing(false);
    }
  };

  const colors = colorPalette || {
    dark: '#0F0F0F',
    accent: '#D4AF37',
    text: '#FFFFFF',
    secondary: '#2A2A2A',
  };

  return (
    <div 
      style={{ backgroundColor: colors.dark, borderBottomColor: colors.accent }}
      className="w-full border-b py-3 shadow-xl"
    >
      {/* Logo Section */}
      <div className="flex justify-center mb-2">
        <div className="relative">
          {/* Glow effect */}
          <div 
            className="absolute inset-0 rounded-full opacity-20 blur-2xl"
            style={{ backgroundColor: colors.accent, width: '96px', height: '96px', left: '-12px', top: '-8px' }}
          />
          {/* Logo container */}
          <div className="relative z-10 flex flex-col items-center">
            <img src="/athlos-logo.png" alt="Athlos" className="h-16 w-16 object-contain drop-shadow-[0_0_16px_rgba(212,175,55,0.35)]" />
            <h1 
              className="-mt-1 text-base font-black tracking-tight text-center"
              style={{ color: colors.accent, letterSpacing: '-0.5px' }}
            >
              Entrenamiento Premium
            </h1>
            <div 
              className="text-[10px] uppercase tracking-widest font-bold"
              style={{ color: colors.text, opacity: 0.6 }}
            >
              by Sebas
            </div>
          </div>
        </div>
      </div>

      {/* Daily Motivational Phrase */}
      <div className="mx-auto max-w-md px-4">
        {isEditing && isAdmin ? (
          <div className="space-y-3">
            <textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="w-full p-3 rounded-lg text-sm text-white bg-opacity-20 border border-amber-500/30 focus:border-amber-500 focus:outline-none resize-none"
              style={{ backgroundColor: colors.secondary }}
              rows="3"
              maxLength="200"
              placeholder="Escribe la frase motivadora..."
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setIsEditing(false)}
                className="px-3 py-1.5 text-xs rounded-lg font-bold uppercase"
                style={{ backgroundColor: colors.secondary, color: colors.text }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSavePhrase}
                className="px-3 py-1.5 text-xs rounded-lg font-bold uppercase text-black"
                style={{ backgroundColor: colors.accent }}
              >
                Guardar
              </button>
            </div>
          </div>
        ) : (
          <div 
            className={`relative rounded-xl px-3 py-2 text-center backdrop-blur transition-all ${isAdmin ? 'group cursor-pointer hover:shadow-lg' : ''}`}
            style={{
              backgroundColor: colors.secondary,
              borderLeft: `2px solid ${colors.accent}`,
            }}
            onClick={() => { if (isAdmin) { setEditValue(currentPhrase); setIsEditing(true); } }}
          >
            <div 
              className="text-sm font-bold leading-snug italic"
              style={{ color: colors.accent }}
            >
              "{currentPhrase}"
            </div>
            {isAdmin && (
              <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <div 
                  className="text-xs font-bold px-2 py-1 rounded"
                  style={{ backgroundColor: colors.accent, color: colors.dark }}
                >
                  ✏️ Editar
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Admin Indicator */}
      {isAdmin && !isEditing && (
        <div className="flex justify-center mt-2">
          <div 
            className="flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full"
            style={{ backgroundColor: colors.secondary, color: colors.accent }}
          >
            <AlertCircle size={12} />
            Panel Admin Activo
          </div>
        </div>
      )}
    </div>
  );
};
