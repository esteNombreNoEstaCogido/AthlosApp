import { useState, useRef, useMemo } from 'react';
import { Camera, X, Plus, ChevronLeft, ChevronRight, User, Loader2 } from 'lucide-react';
import { Capacitor } from '@capacitor/core';

const ANGLES = [
  { id: 'front', label: 'Frontal' },
  { id: 'side', label: 'Lateral' },
  { id: 'back', label: 'Espalda' },
];

// Compress photo before saving
function compressPhoto(dataUrl, maxWidth = 800, quality = 0.7) {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ratio = Math.min(maxWidth / img.width, 1);
      canvas.width = img.width * ratio;
      canvas.height = img.height * ratio;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

const PhotoSlot = ({ angle, photo, onCapture, palette, isLoading }) => {
  const fileRef = useRef(null);

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const compressed = await compressPhoto(ev.target.result);
      onCapture(angle.id, compressed);
    };
    reader.readAsDataURL(file);
  };

  const handleCapture = async () => {
    if (!Capacitor.isNativePlatform()) {
      fileRef.current?.click();
      return;
    }
    try {
      const { Camera: CapCamera } = await import('@capacitor/camera');
      const result = await CapCamera.getPhoto({
        quality: 80,
        allowEditing: false,
        resultType: 'dataUrl',
        source: 'PROMPT',
        width: 800,
      });
      if (result.dataUrl) {
        const compressed = await compressPhoto(result.dataUrl);
        onCapture(angle.id, compressed);
      }
    } catch (err) {
      if (err.message !== 'User cancelled photos app') {
        fileRef.current?.click();
      }
    }
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-[9px] font-black uppercase" style={{ color: `${palette?.text || '#fff'}60` }}>{angle.label}</p>
      <button
        onClick={handleCapture}
        disabled={isLoading}
        className="w-full aspect-[3/4] rounded-2xl border-2 overflow-hidden transition-all active:scale-95 relative"
        style={{
          borderColor: photo ? `${palette?.accent || '#D4AF37'}50` : `${palette?.text || '#fff'}15`,
          borderStyle: photo ? 'solid' : 'dashed',
          backgroundColor: palette?.dark || '#09090b',
        }}
      >
        {photo ? (
          <img src={photo} alt={angle.label} className="w-full h-full object-cover" />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            {isLoading ? <Loader2 size={24} className="animate-spin" style={{ color: `${palette?.text || '#fff'}30` }}/> : <Camera size={24} style={{ color: `${palette?.text || '#fff'}30` }}/>}
            <span className="text-[8px] font-bold" style={{ color: `${palette?.text || '#fff'}25` }}>Añadir</span>
          </div>
        )}
        <input type="file" ref={fileRef} className="hidden" accept="image/*" onChange={handleFileSelect} />
      </button>
    </div>
  );
};

export const PhotoComparator = ({ progressPhotos = [], onSavePhotos, palette }) => {
  const [showUpload, setShowUpload] = useState(false);
  const [currentPhotos, setCurrentPhotos] = useState({ front: null, side: null, back: null });
  const [isLoading, setIsLoading] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [dateA, setDateA] = useState(null);
  const [dateB, setDateB] = useState(null);

  const sortedEntries = useMemo(() =>
    [...progressPhotos].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)),
    [progressPhotos]
  );

  const handleCapture = (angleId, dataUrl) => {
    setCurrentPhotos(prev => ({ ...prev, [angleId]: dataUrl }));
  };

  const handleSave = async () => {
    const hasAny = currentPhotos.front || currentPhotos.side || currentPhotos.back;
    if (!hasAny) return;
    setIsLoading(true);
    const entry = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      ...currentPhotos,
    };
    await onSavePhotos(entry);
    setCurrentPhotos({ front: null, side: null, back: null });
    setShowUpload(false);
    setIsLoading(false);
  };

  const accent = palette?.accent || '#D4AF37';

  const entryA = dateA !== null ? sortedEntries[dateA] : null;
  const entryB = dateB !== null ? sortedEntries[dateB] : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black uppercase" style={{ color: palette?.text || '#fff' }}>
          Fotos de Progreso
        </h3>
        {sortedEntries.length >= 2 && (
          <button
            onClick={() => {
              setCompareMode(!compareMode);
              if (!compareMode && sortedEntries.length >= 2) {
                setDateA(sortedEntries.length - 1);
                setDateB(0);
              }
            }}
            className="text-[10px] font-black uppercase px-3 py-1.5 rounded-lg transition-all active:scale-95"
            style={compareMode
              ? { backgroundColor: accent, color: palette?.dark || '#000' }
              : { backgroundColor: `${accent}15`, color: accent, border: `1px solid ${accent}30` }
            }
          >
            {compareMode ? 'Cerrar' : 'Comparar'}
          </button>
        )}
      </div>

      {/* Compare Mode */}
      {compareMode && sortedEntries.length >= 2 && (
        <div className="space-y-4 animate-in fade-in">
          {/* Date Selectors */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[9px] font-black uppercase mb-2" style={{ color: `${palette?.text || '#fff'}60` }}>Antes</p>
              <select
                value={dateA ?? ''}
                onChange={e => setDateA(parseInt(e.target.value))}
                className="w-full p-2 rounded-xl text-xs font-bold outline-none"
                style={{ backgroundColor: palette?.dark || '#09090b', border: `1px solid ${accent}30`, color: palette?.text || '#fff' }}
              >
                {sortedEntries.map((entry, i) => (
                  <option key={entry.id} value={i}>
                    {new Date(entry.timestamp).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: '2-digit' })}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <p className="text-[9px] font-black uppercase mb-2" style={{ color: `${palette?.text || '#fff'}60` }}>Después</p>
              <select
                value={dateB ?? ''}
                onChange={e => setDateB(parseInt(e.target.value))}
                className="w-full p-2 rounded-xl text-xs font-bold outline-none"
                style={{ backgroundColor: palette?.dark || '#09090b', border: `1px solid ${accent}30`, color: palette?.text || '#fff' }}
              >
                {sortedEntries.map((entry, i) => (
                  <option key={entry.id} value={i}>
                    {new Date(entry.timestamp).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: '2-digit' })}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Side-by-Side Comparison */}
          {entryA && entryB && ANGLES.map(angle => {
            const photoA = entryA[angle.id];
            const photoB = entryB[angle.id];
            if (!photoA && !photoB) return null;
            return (
              <div key={angle.id}>
                <p className="text-[10px] font-black uppercase text-center mb-2" style={{ color: accent }}>{angle.label}</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="aspect-[3/4] rounded-xl overflow-hidden border" style={{ borderColor: `${palette?.text || '#fff'}15`, backgroundColor: palette?.dark || '#09090b' }}>
                    {photoA ? <img src={photoA} alt={`${angle.label} antes`} className="w-full h-full object-cover" />
                      : <div className="flex items-center justify-center h-full"><User size={32} style={{ color: `${palette?.text || '#fff'}15` }}/></div>}
                    <div className="text-[8px] font-bold text-center py-1" style={{ color: `${palette?.text || '#fff'}50` }}>
                      {new Date(entryA.timestamp).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                    </div>
                  </div>
                  <div className="aspect-[3/4] rounded-xl overflow-hidden border" style={{ borderColor: `${accent}30`, backgroundColor: palette?.dark || '#09090b' }}>
                    {photoB ? <img src={photoB} alt={`${angle.label} después`} className="w-full h-full object-cover" />
                      : <div className="flex items-center justify-center h-full"><User size={32} style={{ color: `${palette?.text || '#fff'}15` }}/></div>}
                    <div className="text-[8px] font-bold text-center py-1" style={{ color: `${palette?.text || '#fff'}50` }}>
                      {new Date(entryB.timestamp).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Photo Timeline */}
      {!compareMode && sortedEntries.length > 0 && (
        <div className="space-y-4">
          {sortedEntries.map(entry => (
            <div key={entry.id} className="p-4 rounded-2xl border" style={{ backgroundColor: palette?.card || '#18181b', borderColor: `${accent}15` }}>
              <p className="text-[10px] font-bold mb-3" style={{ color: `${palette?.text || '#fff'}70` }}>
                {new Date(entry.timestamp).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}
              </p>
              <div className="grid grid-cols-3 gap-2">
                {ANGLES.map(angle => (
                  <div key={angle.id} className="aspect-[3/4] rounded-xl overflow-hidden" style={{ backgroundColor: palette?.dark || '#09090b' }}>
                    {entry[angle.id] ? (
                      <img src={entry[angle.id]} alt={angle.label} className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <User size={18} style={{ color: `${palette?.text || '#fff'}15` }}/>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload New Photos */}
      {!compareMode && !showUpload && (
        <button
          onClick={() => setShowUpload(true)}
          className="w-full p-4 rounded-2xl border-2 border-dashed flex items-center justify-center gap-2 font-bold text-xs transition-all active:scale-95"
          style={{ borderColor: `${accent}40`, color: accent, backgroundColor: `${accent}08` }}
        >
          <Camera size={18}/> Subir Fotos de Progreso
        </button>
      )}

      {!compareMode && showUpload && (
        <div className="p-5 rounded-[2rem] border space-y-4 animate-in slide-in-from-bottom" style={{ backgroundColor: palette?.card || '#18181b', borderColor: `${accent}30` }}>
          <div className="flex justify-between items-center">
            <h4 className="text-xs font-black uppercase" style={{ color: accent }}>Nuevas Fotos</h4>
            <button onClick={() => { setShowUpload(false); setCurrentPhotos({ front: null, side: null, back: null }); }}>
              <X size={18} style={{ color: `${palette?.text || '#fff'}40` }}/>
            </button>
          </div>
          <p className="text-[9px]" style={{ color: `${palette?.text || '#fff'}50` }}>
            Captura fotos desde 3 ángulos para seguir tu transformación
          </p>
          <div className="grid grid-cols-3 gap-3">
            {ANGLES.map(angle => (
              <PhotoSlot
                key={angle.id}
                angle={angle}
                photo={currentPhotos[angle.id]}
                onCapture={handleCapture}
                palette={palette}
                isLoading={isLoading}
              />
            ))}
          </div>
          <button
            onClick={handleSave}
            disabled={isLoading || (!currentPhotos.front && !currentPhotos.side && !currentPhotos.back)}
            className="w-full py-4 rounded-xl font-black text-[10px] uppercase transition-all active:scale-95 disabled:opacity-40 flex items-center justify-center gap-2"
            style={{ backgroundColor: accent, color: palette?.dark || '#000' }}
          >
            {isLoading ? <Loader2 size={16} className="animate-spin"/> : <Plus size={16}/>}
            Guardar Fotos
          </button>
        </div>
      )}
    </div>
  );
};
