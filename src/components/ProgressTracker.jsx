import { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { TrendingUp, TrendingDown, Plus, X, Scale, Loader2 } from 'lucide-react';

const MetricInput = ({ label, value, onChange, unit, placeholder, palette }) => (
  <div className="space-y-1">
    <label className="text-[9px] font-black uppercase" style={{ color: `${palette?.text || '#a1a1aa'}80` }}>{label}</label>
    <div className="flex items-center gap-2">
      <input
        type="number"
        step="0.1"
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="flex-1 p-3 rounded-xl text-sm font-bold outline-none"
        style={{ backgroundColor: palette?.dark || '#09090b', border: `1px solid ${palette?.accent || '#D4AF37'}30`, color: palette?.text || '#fff' }}
      />
      <span className="text-[10px] font-bold w-8" style={{ color: `${palette?.text || '#a1a1aa'}60` }}>{unit}</span>
    </div>
  </div>
);

const CustomTooltip = ({ active, payload, label, palette }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl p-3 border shadow-lg" style={{ backgroundColor: palette?.card || '#18181b', borderColor: `${palette?.accent || '#D4AF37'}30` }}>
      <p className="text-[9px] font-bold mb-1" style={{ color: `${palette?.text || '#fff'}80` }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-xs font-black" style={{ color: p.color }}>
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
};

export const ProgressTracker = ({ stats = [], onAddStats, palette, isAdmin }) => {
  const [showForm, setShowForm] = useState(false);
  const [weight, setWeight] = useState('');
  const [bodyFat, setBodyFat] = useState('');
  const [boneMass, setBoneMass] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [activeMetric, setActiveMetric] = useState('weight');

  const sortedStats = useMemo(() => 
    [...stats].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)),
    [stats]
  );

  const chartData = useMemo(() => 
    sortedStats.map(s => ({
      date: new Date(s.timestamp).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }),
      Peso: s.weight || null,
      'Grasa %': s.bodyFat || null,
      'Masa Ósea': s.boneMass || null,
    })),
    [sortedStats]
  );

  const latest = sortedStats.length > 0 ? sortedStats[sortedStats.length - 1] : null;
  const previous = sortedStats.length > 1 ? sortedStats[sortedStats.length - 2] : null;

  const getDelta = (key) => {
    if (!latest || !previous) return null;
    const diff = (latest[key] || 0) - (previous[key] || 0);
    return diff !== 0 ? diff : null;
  };

  const handleSubmit = async () => {
    const w = parseFloat(weight);
    const bf = parseFloat(bodyFat);
    const bm = parseFloat(boneMass);
    if (!Number.isFinite(w) && !Number.isFinite(bf) && !Number.isFinite(bm)) return;

    setIsSaving(true);
    const entry = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      ...(w > 0 && w < 500 && { weight: w }),
      ...(bf > 0 && bf < 100 && { bodyFat: bf }),
      ...(bm > 0 && bm < 50 && { boneMass: bm }),
    };
    await onAddStats(entry);
    setWeight(''); setBodyFat(''); setBoneMass('');
    setShowForm(false);
    setIsSaving(false);
  };

  const accent = palette?.accent || '#D4AF37';
  const metricConfigs = {
    weight: { label: 'Peso', color: accent, unit: 'kg', key: 'Peso' },
    bodyFat: { label: 'Grasa Corporal', color: '#EF4444', unit: '%', key: 'Grasa %' },
    boneMass: { label: 'Masa Ósea', color: '#3B82F6', unit: 'kg', key: 'Masa Ósea' },
  };

  const metricTabs = [
    { id: 'weight', label: 'Peso' },
    { id: 'bodyFat', label: 'Grasa' },
    { id: 'boneMass', label: 'Ósea' },
  ];

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        {Object.entries(metricConfigs).map(([key, cfg]) => {
          const val = latest?.[key] || '—';
          const delta = getDelta(key);
          return (
            <div key={key} className="p-4 rounded-2xl border text-center" style={{ backgroundColor: palette?.card || '#18181b', borderColor: `${cfg.color}30` }}>
              <p className="text-[8px] font-black uppercase mb-1" style={{ color: `${palette?.text || '#fff'}60` }}>{cfg.label}</p>
              <p className="text-lg font-black" style={{ color: cfg.color }}>{val !== '—' ? val : '—'}</p>
              <p className="text-[9px] font-bold" style={{ color: `${palette?.text || '#fff'}50` }}>{cfg.unit}</p>
              {delta !== null && (
                <div className="flex items-center justify-center gap-1 mt-1">
                  {delta > 0 ? <TrendingUp size={10} style={{ color: key === 'bodyFat' ? '#EF4444' : '#22C55E' }}/> : <TrendingDown size={10} style={{ color: key === 'bodyFat' ? '#22C55E' : '#EF4444' }}/>}
                  <span className="text-[9px] font-bold" style={{ color: delta > 0 ? (key === 'bodyFat' ? '#EF4444' : '#22C55E') : (key === 'bodyFat' ? '#22C55E' : '#EF4444') }}>
                    {delta > 0 ? '+' : ''}{delta.toFixed(1)}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Chart */}
      {chartData.length > 1 && (
        <div className="p-5 rounded-[2rem] border" style={{ backgroundColor: palette?.card || '#18181b', borderColor: `${accent}20` }}>
          {/* Metric Selector */}
          <div className="flex gap-2 p-1 rounded-xl mb-4" style={{ backgroundColor: palette?.dark || '#09090b' }}>
            {metricTabs.map(t => (
              <button
                key={t.id}
                onClick={() => setActiveMetric(t.id)}
                className="flex-1 py-2 text-[10px] font-bold rounded-lg transition-all"
                style={activeMetric === t.id
                  ? { backgroundColor: metricConfigs[t.id].color, color: '#000', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }
                  : { color: `${palette?.text || '#71717a'}60` }
                }
              >{t.label}</button>
            ))}
          </div>

          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={`${palette?.text || '#fff'}10`} />
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: `${palette?.text || '#a1a1aa'}80` }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: `${palette?.text || '#a1a1aa'}60` }} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
              <Tooltip content={<CustomTooltip palette={palette} />} />
              <Line
                type="monotone"
                dataKey={metricConfigs[activeMetric].key}
                stroke={metricConfigs[activeMetric].color}
                strokeWidth={2.5}
                dot={{ r: 4, fill: metricConfigs[activeMetric].color, strokeWidth: 2, stroke: palette?.dark || '#09090b' }}
                activeDot={{ r: 6 }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {chartData.length <= 1 && (
        <div className="text-center py-10 rounded-2xl border" style={{ backgroundColor: palette?.card || '#18181b', borderColor: `${accent}15` }}>
          <Scale size={32} className="mx-auto mb-3" style={{ color: `${palette?.text || '#fff'}30` }}/>
          <p className="text-xs font-bold" style={{ color: `${palette?.text || '#fff'}40` }}>
            {chartData.length === 0 ? 'Registra tus métricas para ver tu evolución' : 'Añade más registros para ver la gráfica'}
          </p>
        </div>
      )}

      {/* Add Button / Form */}
      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="w-full p-4 rounded-2xl border-2 border-dashed flex items-center justify-center gap-2 font-bold text-xs transition-all active:scale-95"
          style={{ borderColor: `${accent}40`, color: accent, backgroundColor: `${accent}08` }}
        >
          <Plus size={18}/> Registrar Métricas
        </button>
      ) : (
        <div className="p-5 rounded-[2rem] border space-y-4 animate-in slide-in-from-bottom" style={{ backgroundColor: palette?.card || '#18181b', borderColor: `${accent}30` }}>
          <div className="flex justify-between items-center">
            <h4 className="text-xs font-black uppercase" style={{ color: accent }}>Nuevo Registro</h4>
            <button onClick={() => setShowForm(false)}><X size={18} style={{ color: `${palette?.text || '#fff'}40` }}/></button>
          </div>
          <MetricInput label="Peso Corporal" value={weight} onChange={setWeight} unit="kg" placeholder="75.0" palette={palette} />
          <MetricInput label="Grasa Corporal" value={bodyFat} onChange={setBodyFat} unit="%" placeholder="18.0" palette={palette} />
          <MetricInput label="Masa Ósea" value={boneMass} onChange={setBoneMass} unit="kg" placeholder="3.2" palette={palette} />
          <button
            onClick={handleSubmit}
            disabled={isSaving || (!weight && !bodyFat && !boneMass)}
            className="w-full py-4 rounded-xl font-black text-[10px] uppercase transition-all active:scale-95 disabled:opacity-40 flex items-center justify-center gap-2"
            style={{ backgroundColor: accent, color: palette?.dark || '#000' }}
          >
            {isSaving ? <Loader2 size={16} className="animate-spin"/> : <Plus size={16}/>}
            Guardar Registro
          </button>
        </div>
      )}
    </div>
  );
};
