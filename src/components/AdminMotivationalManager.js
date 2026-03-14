import React, { useState, useEffect } from 'react';
import { Save, Trash2, Plus, Clock } from 'lucide-react';

/**
 * 📝 Admin Motivational Phrase Manager
 * Protected component for admins to manage daily phrases
 * Features:
 * - Create and edit motivational phrases
 * - Schedule phrases for specific dates
 * - Real-time sync to Firestore
 * - View phrase history
 */

export const AdminMotivationalManager = ({ 
  currentPhrase = '',
  allPhrases = [],
  onSavePhrase = () => {},
  onDeletePhrase = () => {},
  colorPalette = null,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [newPhrase, setNewPhrase] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');

  const colors = colorPalette || {
    dark: '#0F0F0F',
    accent: '#D4AF37',
    text: '#FFFFFF',
    secondary: '#2A2A2A',
  };

  const handleAddPhrase = () => {
    if (newPhrase.trim()) {
      onSavePhrase({
        text: newPhrase,
        timestamp: new Date().toISOString(),
        active: true,
      });
      setNewPhrase('');
    }
  };

  const handleEditPhrase = (id, text) => {
    setEditingId(id);
    setEditValue(text);
  };

  const handleSaveEdit = (id) => {
    if (editValue.trim()) {
      onSavePhrase({
        id,
        text: editValue,
        timestamp: new Date().toISOString(),
        active: true,
      });
      setEditingId(null);
      setEditValue('');
    }
  };

  return (
    <div 
      className="rounded-xl overflow-hidden border-l-4 shadow-lg"
      style={{ 
        backgroundColor: colors.secondary,
        borderLeftColor: colors.accent,
      }}
    >
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-center justify-between hover:opacity-80 transition-opacity"
        style={{ backgroundColor: colors.secondary }}
      >
        <div className="flex items-center gap-3">
          <div className="text-2xl">📝</div>
          <div className="text-left">
            <h3 className="font-bold" style={{ color: colors.accent }}>
              Panel Admin: Frases Motivadoras
            </h3>
            <p className="text-xs opacity-70" style={{ color: colors.text }}>
              Gestiona las frases diarias para tus clientes
            </p>
          </div>
        </div>
        <div style={{ color: colors.accent }}>
          {isExpanded ? '▼' : '▶'}
        </div>
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="p-4 space-y-4 border-t" style={{ borderTopColor: colors.accent, opacity: 0.2 }}>
          
          {/* Current Phrase Display */}
          {currentPhrase && (
            <div 
              className="p-3 rounded-lg text-center"
              style={{ backgroundColor: colors.dark }}
            >
              <div className="text-xs uppercase tracking-widest mb-2 opacity-60" style={{ color: colors.text }}>
                Frase Actual
              </div>
              <div 
                className="text-base font-bold italic"
                style={{ color: colors.accent }}
              >
                "{currentPhrase}"
              </div>
            </div>
          )}

          {/* Add New Phrase */}
          <div className="space-y-2">
            <label className="text-sm font-bold" style={{ color: colors.text }}>
              ✍️ Nueva Frase Motivadora
            </label>
            <textarea
              value={newPhrase}
              onChange={(e) => setNewPhrase(e.target.value)}
              placeholder="Escribe una frase inspiradora para tus clientes..."
              maxLength={200}
              rows="3"
              className="w-full p-3 rounded-lg text-sm resize-none focus:outline-none focus:ring-2"
              style={{
                backgroundColor: colors.dark,
                color: colors.text,
                borderColor: colors.accent,
                focusRing: colors.accent,
              }}
            />
            <div className="flex justify-between items-center">
              <span className="text-xs opacity-60" style={{ color: colors.text }}>
                {newPhrase.length}/200 caracteres
              </span>
              <button
                onClick={handleAddPhrase}
                disabled={!newPhrase.trim()}
                className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold uppercase text-xs transition-opacity disabled:opacity-50"
                style={{
                  backgroundColor: colors.accent,
                  color: colors.dark,
                }}
              >
                <Plus size={16} />
                Agregar
              </button>
            </div>
          </div>

          {/* Phrase History */}
          {allPhrases && allPhrases.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-bold" style={{ color: colors.text }}>
                📚 Historial de Frases ({allPhrases.length})
              </label>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {allPhrases.map((phrase, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg space-y-2"
                    style={{ backgroundColor: colors.dark }}
                  >
                    {editingId === idx ? (
                      <>
                        <textarea
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          rows="2"
                          className="w-full p-2 rounded text-sm resize-none"
                          style={{
                            backgroundColor: colors.secondary,
                            color: colors.text,
                          }}
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSaveEdit(idx)}
                            className="flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded text-xs font-bold"
                            style={{
                              backgroundColor: colors.accent,
                              color: colors.dark,
                            }}
                          >
                            <Save size={14} />
                            Guardar
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="flex-1 px-2 py-1 rounded text-xs font-bold opacity-60 hover:opacity-100"
                            style={{ color: colors.text }}
                          >
                            Cancelar
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <p 
                          className="text-sm font-semibold italic"
                          style={{ color: colors.accent }}
                        >
                          "{phrase.text || phrase}"
                        </p>
                        <div className="flex items-center gap-2 text-xs opacity-60">
                          <Clock size={12} />
                          <span>{typeof phrase === 'object' && phrase.timestamp ? new Date(phrase.timestamp).toLocaleDateString('es-ES') : 'Sin fecha'}</span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEditPhrase(idx, phrase.text || phrase)}
                            className="flex-1 text-xs font-bold px-2 py-1 rounded opacity-60 hover:opacity-100"
                            style={{ color: colors.accent }}
                          >
                            ✏️ Editar
                          </button>
                          <button
                            onClick={() => onDeletePhrase(idx)}
                            className="flex-1 text-xs font-bold px-2 py-1 rounded opacity-60 hover:opacity-100 flex items-center justify-center gap-1"
                            style={{ color: '#FF6B6B' }}
                          >
                            <Trash2 size={12} />
                            Eliminar
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Info Box */}
          <div 
            className="p-3 rounded-lg text-xs"
            style={{ 
              backgroundColor: 'rgba(212, 175, 55, 0.1)',
              color: colors.accent,
            }}
          >
            💡 Las frases se actualizan en tiempo real para todos tus clientes. Usa un lenguaje motivador y positivo.
          </div>
        </div>
      )}
    </div>
  );
};
