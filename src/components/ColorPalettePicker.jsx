import React from 'react';
import { Palette, Check } from 'lucide-react';
import { COLOR_PALETTES, getPaletteById } from '../utils/colorPalettes';

/**
 * 🎨 Color Palette Picker Component
 * Allows users to select their preferred color theme
 */

export const ColorPalettePicker = ({ 
  selectedPaletteId = 'premium-dark',
  onPaletteSelect = () => {},
  isCompact = false 
}) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Palette size={20} className="text-amber-500" />
        <h3 className="text-lg font-bold">🎨 Personaliza tu Tema</h3>
      </div>

      <div className={`grid gap-3 ${isCompact ? 'grid-cols-2' : 'grid-cols-3'}`}>
        {COLOR_PALETTES.map((palette) => {
          const isSelected = palette.id === selectedPaletteId;
          return (
            <button
              key={palette.id}
              onClick={() => onPaletteSelect(palette.id)}
              className="group relative overflow-hidden rounded-lg p-4 transition-all hover:shadow-lg hover:scale-105 active:scale-95"
              style={{
                backgroundColor: palette.dark,
                border: isSelected ? `2px solid ${palette.accent}` : '1px solid rgba(255,255,255,0.1)',
              }}
            >
              {/* Color preview bars */}
              <div className="flex gap-1 mb-3 h-8 rounded-md overflow-hidden">
                <div style={{ backgroundColor: palette.dark, flex: 1 }} />
                <div style={{ backgroundColor: palette.card, flex: 1 }} />
                <div style={{ backgroundColor: palette.accent, flex: 1 }} />
              </div>

              {/* Palette name */}
              <div 
                className="text-sm font-bold mb-1"
                style={{ color: palette.accent }}
              >
                {palette.name}
              </div>

              {/* Description */}
              <div 
                className="text-xs opacity-70"
                style={{ color: palette.text }}
              >
                {palette.description}
              </div>

              {/* Selected indicator */}
              {isSelected && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                  <div 
                    className="rounded-full p-2"
                    style={{ backgroundColor: palette.accent }}
                  >
                    <Check size={20} className="text-black" strokeWidth={3} />
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div 
        className="p-3 rounded-lg text-sm text-center"
        style={{ backgroundColor: 'rgba(212, 175, 55, 0.1)', color: '#D4AF37' }}
      >
        💡 Selecciona un tema para personalizar tu experiencia
      </div>
    </div>
  );
};
