import { useState, useRef } from 'react';
import { X, Camera, Link, FolderOpen, Image, Search, Check, Loader2 } from 'lucide-react';
import { Capacitor } from '@capacitor/core';

const LOCAL_EXERCISE_IMAGES = [
  { category: 'Pecho', images: [
    { name: 'Press Banca', url: '/assets/exercises/chest/press-banca.jpg' },
    { name: 'Aperturas', url: '/assets/exercises/chest/aperturas.jpg' },
    { name: 'Press Inclinado', url: '/assets/exercises/chest/press-inclinado.jpg' },
  ]},
  { category: 'Espalda', images: [
    { name: 'Jalón', url: '/assets/exercises/back/jalon.jpg' },
    { name: 'Remo', url: '/assets/exercises/back/remo.jpg' },
    { name: 'Dominadas', url: '/assets/exercises/back/dominadas.jpg' },
  ]},
  { category: 'Piernas', images: [
    { name: 'Sentadilla', url: '/assets/exercises/legs/sentadilla.jpg' },
    { name: 'Prensa', url: '/assets/exercises/legs/prensa.jpg' },
    { name: 'Curl Femoral', url: '/assets/exercises/legs/curl-femoral.jpg' },
  ]},
  { category: 'Hombros', images: [
    { name: 'Press Militar', url: '/assets/exercises/shoulders/press-militar.jpg' },
    { name: 'Elevaciones', url: '/assets/exercises/shoulders/elevaciones.jpg' },
  ]},
  { category: 'Brazos', images: [
    { name: 'Curl Bíceps', url: '/assets/exercises/arms/curl-biceps.jpg' },
    { name: 'Tríceps', url: '/assets/exercises/arms/triceps.jpg' },
  ]},
];

// Compress image to reduce Firestore document size
function compressImage(dataUrl, maxWidth = 600, quality = 0.7) {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ratio = Math.min(maxWidth / img.width, maxWidth / img.height, 1);
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

export const ExerciseImageManager = ({ isOpen, onClose, onSelectImage, exerciseName }) => {
  const [activeSource, setActiveSource] = useState('gallery');
  const [urlInput, setUrlInput] = useState('');
  const [urlPreview, setUrlPreview] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  if (!isOpen) return null;

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsLoading(true);
    setError('');
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (ev) => resolve(ev.target.result);
        reader.onerror = () => reject(new Error('Error leyendo archivo'));
        reader.readAsDataURL(file);
      });
      const compressed = await compressImage(dataUrl);
      onSelectImage(compressed);
      onClose();
    } catch {
      setError('Error al procesar la imagen');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCameraCapture = async () => {
    if (!Capacitor.isNativePlatform()) {
      fileRef.current?.click();
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const { Camera: CapCamera } = await import('@capacitor/camera');
      const photo = await CapCamera.getPhoto({
        quality: 80,
        allowEditing: false,
        resultType: 'dataUrl',
        source: 'PROMPT',
        width: 600,
        height: 600,
      });
      if (photo.dataUrl) {
        const compressed = await compressImage(photo.dataUrl);
        onSelectImage(compressed);
        onClose();
      }
    } catch (err) {
      if (err.message !== 'User cancelled photos app') {
        setError('Error al capturar imagen');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleUrlSubmit = async () => {
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    // Basic URL validation
    try {
      const parsed = new URL(trimmed);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        setError('Solo URLs http/https');
        return;
      }
    } catch {
      setError('URL no válida');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      // Try to load as img to validate it works
      const img = new window.Image();
      img.crossOrigin = 'anonymous';
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = trimmed;
      });
      setUrlPreview(trimmed);
    } catch {
      // Even if CORS blocks, URL might still work in img tag
      setUrlPreview(trimmed);
    } finally {
      setIsLoading(false);
    }
  };

  const confirmUrl = () => {
    if (urlPreview) {
      onSelectImage(urlPreview);
      onClose();
    }
  };

  const handleLocalSelect = (url) => {
    onSelectImage(url);
    onClose();
  };

  const sources = [
    { id: 'gallery', label: 'Galería', icon: Camera },
    { id: 'url', label: 'URL', icon: Link },
    { id: 'library', label: 'Biblioteca', icon: FolderOpen },
  ];

  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/90 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-md bg-zinc-900 border-t border-zinc-700 rounded-t-[2rem] p-6 space-y-5 animate-in slide-in-from-bottom duration-300 max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-amber-500 font-black uppercase text-sm flex items-center gap-2">
              <Image size={16}/> Imagen Ejercicio
            </h3>
            <p className="text-zinc-500 text-[10px] mt-1">{exerciseName}</p>
          </div>
          <button onClick={onClose} className="p-2"><X size={20} className="text-zinc-500"/></button>
        </div>

        {/* Source Tabs */}
        <div className="flex gap-2 p-1 bg-zinc-800 rounded-xl">
          {sources.map(s => (
            <button
              key={s.id}
              onClick={() => { setActiveSource(s.id); setError(''); setUrlPreview(null); }}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-[10px] font-black uppercase transition-all"
              style={activeSource === s.id
                ? { backgroundColor: '#D4AF37', color: '#000' }
                : { color: '#71717a' }
              }
            >
              <s.icon size={14}/> {s.label}
            </button>
          ))}
        </div>

        {error && <p className="text-red-500 text-[10px] text-center font-bold">{error}</p>}

        {/* Gallery/Camera Source */}
        {activeSource === 'gallery' && (
          <div className="space-y-4">
            <input type="file" ref={fileRef} className="hidden" accept="image/*" onChange={handleFileSelect} />
            <button
              onClick={handleCameraCapture}
              disabled={isLoading}
              className="w-full p-6 rounded-2xl border-2 border-dashed border-amber-500/30 bg-amber-500/5 flex flex-col items-center gap-3 transition-all active:scale-95"
            >
              {isLoading ? <Loader2 size={32} className="text-amber-500 animate-spin"/>
                : <Camera size={32} className="text-amber-500"/>}
              <span className="text-amber-500 font-bold text-xs">
                {Capacitor.isNativePlatform() ? 'Cámara o Galería' : 'Seleccionar Archivo'}
              </span>
              <span className="text-zinc-500 text-[9px]">JPG, PNG • Máx 600px</span>
            </button>
          </div>
        )}

        {/* URL Source */}
        {activeSource === 'url' && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <input
                type="url"
                placeholder="https://ejemplo.com/imagen.jpg"
                className="flex-1 bg-zinc-800 border border-zinc-700 text-white p-3 rounded-xl text-xs outline-none"
                value={urlInput}
                onChange={e => { setUrlInput(e.target.value); setUrlPreview(null); setError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleUrlSubmit()}
              />
              <button
                onClick={handleUrlSubmit}
                disabled={isLoading || !urlInput.trim()}
                className="px-4 bg-amber-500 text-black rounded-xl font-bold text-xs active:scale-95 disabled:opacity-40"
              >
                {isLoading ? <Loader2 size={16} className="animate-spin"/> : <Search size={16}/>}
              </button>
            </div>
            {urlPreview && (
              <div className="space-y-3">
                <div className="relative h-40 rounded-xl overflow-hidden bg-zinc-800">
                  <img src={urlPreview} alt="Preview" className="w-full h-full object-cover" onError={() => setError('No se pudo cargar la imagen')}/>
                </div>
                <button
                  onClick={confirmUrl}
                  className="w-full bg-amber-500 text-black font-black py-3 rounded-xl text-[10px] uppercase active:scale-95 flex items-center justify-center gap-2"
                >
                  <Check size={16}/> Usar esta imagen
                </button>
              </div>
            )}
          </div>
        )}

        {/* Local Library */}
        {activeSource === 'library' && (
          <div className="space-y-4">
            <p className="text-zinc-500 text-[10px]">Imágenes predefinidas por grupo muscular</p>
            {LOCAL_EXERCISE_IMAGES.map(cat => (
              <div key={cat.category}>
                <h4 className="text-amber-500 text-[10px] font-black uppercase mb-2">{cat.category}</h4>
                <div className="grid grid-cols-3 gap-2">
                  {cat.images.map(img => (
                    <button
                      key={img.url}
                      onClick={() => handleLocalSelect(img.url)}
                      className="relative h-20 rounded-xl overflow-hidden bg-zinc-800 border border-zinc-700 active:scale-95 transition-all group"
                    >
                      <img
                        src={img.url}
                        alt={img.name}
                        className="w-full h-full object-cover opacity-80 group-hover:opacity-100"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent flex items-end p-1.5">
                        <span className="text-white text-[8px] font-bold leading-tight">{img.name}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <p className="text-zinc-600 text-[9px] text-center italic">
              Añade imágenes a /public/assets/exercises/ para que aparezcan aquí
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
