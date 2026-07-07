import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Dumbbell, FileText, HeartPulse, Loader2, MoonStar, Sparkles, Target } from 'lucide-react';

const DEFAULT_FORM = {
  name: '',
  age: '',
  weightKg: '',
  heightCm: '',
  occupation: '',
  dailyActivityLevel: '',
  mainObjective: '',
  deadline: '',
  commitmentLevel: '',
  injuries: '',
  surgeries: '',
  medicalConditions: '',
  medication: '',
  trainingDays: '',
  sessionMinutes: '',
  trainingPlace: '',
  equipment: '',
  trainingExperience: '',
  basicTechnique: '',
  mobilityLimits: '',
  favoriteExercises: '',
  priorityMuscles: '',
  sleepHours: '',
  sleepQuality: '',
  stressLevel: '',
  extraActivity: '',
  nutritionState: '',
  forbiddenExercises: '',
  stepsDaily: '',
  additionalNotes: '',
};

const QUESTION_SECTIONS = [
  {
    title: 'Datos personales',
    icon: FileText,
    fields: [
      { name: 'name', label: 'Nombre y apellidos', type: 'text', placeholder: 'Ej. Ana Pérez', span: 2 },
      { name: 'age', label: 'Edad', type: 'number', placeholder: '28' },
      { name: 'weightKg', label: 'Peso actual (kg)', type: 'number', placeholder: '68.5' },
      { name: 'heightCm', label: 'Altura (cm)', type: 'number', placeholder: '170' },
      { name: 'occupation', label: 'Ocupación', type: 'textarea', placeholder: 'Trabajo de oficina, tienda, de pie, etc.', span: 2, rows: 2 },
      { name: 'dailyActivityLevel', label: 'Actividad diaria', type: 'select', options: ['Muy sedentario', 'Sedentario', 'Activo moderado', 'Muy activo'] },
    ],
  },
  {
    title: 'Objetivos y motivación',
    icon: Target,
    fields: [
      { name: 'mainObjective', label: 'Objetivo principal', type: 'select', options: ['Ganancia de masa', 'Pérdida de grasa', 'Fuerza', 'Salud / longevidad', 'Recomposición', 'Rendimiento deportivo'] },
      { name: 'deadline', label: 'Fecha límite / evento', type: 'text', placeholder: 'Ej. verano, boda, competición', span: 2 },
      { name: 'commitmentLevel', label: 'Compromiso actual (1-10)', type: 'number', placeholder: '8' },
      { name: 'priorityMuscles', label: 'Grupo muscular a priorizar', type: 'text', placeholder: 'Glúteo, espalda, torso...', span: 2 },
    ],
  },
  {
    title: 'Salud y seguridad',
    icon: HeartPulse,
    fields: [
      { name: 'injuries', label: 'Lesiones o dolor recurrente', type: 'textarea', placeholder: 'Lumbar, rodillas, hombros...', span: 2, rows: 2 },
      { name: 'surgeries', label: 'Cirugías o fracturas previas', type: 'textarea', placeholder: 'Detalles y fechas si aplica', span: 2, rows: 2 },
      { name: 'medicalConditions', label: 'Condiciones médicas', type: 'textarea', placeholder: 'Hipertensión, diabetes, asma...', span: 2, rows: 2 },
      { name: 'medication', label: 'Medicación relevante', type: 'textarea', placeholder: 'Medicamentos que puedan afectar fatiga o rendimiento', span: 2, rows: 2 },
    ],
  },
  {
    title: 'Entrenamiento',
    icon: Dumbbell,
    fields: [
      { name: 'trainingDays', label: 'Días por semana', type: 'number', placeholder: '3' },
      { name: 'sessionMinutes', label: 'Minutos por sesión', type: 'number', placeholder: '60' },
      { name: 'trainingPlace', label: 'Dónde entrenas', type: 'select', options: ['Gimnasio completo', 'Casa', 'Parque', 'Mixto'] },
      { name: 'equipment', label: 'Material disponible', type: 'textarea', placeholder: 'Mancuernas, bandas, máquinas, peso corporal...', span: 2, rows: 2 },
      { name: 'trainingExperience', label: 'Experiencia entrenando con cargas', type: 'text', placeholder: 'Ej. 8 meses, 3 años', span: 2 },
      { name: 'basicTechnique', label: 'Técnica en básicos', type: 'textarea', placeholder: 'Sentadilla, peso muerto, presses...', span: 2, rows: 2 },
      { name: 'mobilityLimits', label: 'Limitaciones de movilidad', type: 'textarea', placeholder: 'Tobillos rígidos, cadera, hombros...', span: 2, rows: 2 },
      { name: 'favoriteExercises', label: 'Ejercicios que disfrutas o evitas', type: 'textarea', placeholder: 'Qué te gusta y qué te resulta incómodo', span: 2, rows: 2 },
      { name: 'forbiddenExercises', label: 'Ejercicios que no quieres repetir', type: 'textarea', placeholder: 'Por dolor, aburrimiento o mala sensación', span: 2, rows: 2 },
    ],
  },
  {
    title: 'Recuperación y estilo de vida',
    icon: MoonStar,
    fields: [
      { name: 'sleepHours', label: 'Horas de sueño medias', type: 'number', placeholder: '7.5' },
      { name: 'sleepQuality', label: 'Calidad del sueño', type: 'select', options: ['Muy mala', 'Mala', 'Correcta', 'Buena', 'Muy buena'] },
      { name: 'stressLevel', label: 'Estrés diario (1-10)', type: 'number', placeholder: '6' },
      { name: 'extraActivity', label: 'Actividad adicional', type: 'textarea', placeholder: 'Cardio, deportes, caminar, etc.', span: 2, rows: 2 },
      { name: 'nutritionState', label: 'Situación nutricional', type: 'select', options: ['Superávit', 'Déficit', 'Mantenimiento', 'No lo sé'] },
      { name: 'stepsDaily', label: 'Pasos al día aprox.', type: 'number', placeholder: '8000' },
      { name: 'additionalNotes', label: 'Notas adicionales', type: 'textarea', placeholder: 'Observaciones, miedos, preferencias o contexto', span: 2, rows: 3 },
    ],
  },
];

const mergeInitialData = (initialData, clientName) => ({
  ...DEFAULT_FORM,
  ...Object.fromEntries(Object.entries(initialData || {}).map(([key, value]) => [key, value ?? ''])),
  name: String((initialData && initialData.name) || clientName || ''),
});

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
    <path fill="currentColor" d="M9.55 18.2 4.8 13.45l1.75-1.75 3 3 7.9-7.9 1.75 1.75z" />
  </svg>
);

const Field = ({ field, value, onChange }) => {
  const baseClass = 'w-full rounded-2xl border px-4 py-3 text-sm outline-none transition-colors focus:border-amber-400';
  const style = { backgroundColor: '#111113', borderColor: 'rgba(245, 158, 11, 0.18)', color: '#fff' };

  if (field.type === 'select') {
    return (
      <select value={value} onChange={onChange} className={baseClass} style={style}>
        <option value="">Selecciona una opción</option>
        {field.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    );
  }

  if (field.type === 'textarea') {
    return (
      <textarea value={value} onChange={onChange} placeholder={field.placeholder} rows={field.rows || 2} className={`${baseClass} resize-none`} style={style} />
    );
  }

  return (
    <input type={field.type || 'text'} value={value} onChange={onChange} placeholder={field.placeholder} className={baseClass} style={style} />
  );
};

export const ClientQuestionnaire = ({ isOpen, clientName = '', initialData = {}, required = true, onSubmit = async () => {} }) => {
  const [form, setForm] = useState(() => mergeInitialData(initialData, clientName));
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setForm(mergeInitialData(initialData, clientName));
  }, [isOpen, initialData, clientName]);

  const completionCount = useMemo(() => Object.entries(form).filter(([key, value]) => key !== 'additionalNotes' && String(value || '').trim()).length, [form]);

  const handleChange = (field) => (e) => {
    const nextValue = e.target.value;
    setForm(prev => ({ ...prev, [field]: nextValue }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    try {
      await onSubmit(form);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] overflow-y-auto bg-black/90 backdrop-blur-md px-4 py-6 sm:px-6">
      <div className="mx-auto flex min-h-full w-full max-w-5xl items-center">
        <form onSubmit={handleSubmit} className="w-full overflow-hidden rounded-[2.25rem] border border-amber-500/20 bg-zinc-950 text-white shadow-[0_30px_120px_rgba(0,0,0,0.55)]">
          <div className="relative overflow-hidden border-b border-white/5 bg-gradient-to-br from-amber-500/18 via-zinc-950 to-zinc-900 px-6 py-6 sm:px-8">
            <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-amber-500/20 blur-3xl" />
            <div className="relative flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="max-w-2xl space-y-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.28em] text-amber-300">
                  <Sparkles size={12} /> Cuestionario de Evaluación
                </div>
                <div>
                  <h2 className="text-3xl font-black tracking-tight sm:text-4xl">Antes de entrenar, necesito tus datos</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-300">{clientName ? `Hola, ${clientName}. ` : ''}Este formulario me ayuda a ajustar la rutina a tu objetivo, tu seguridad y tu contexto real de entrenamiento.</p>
                </div>
              </div>

              <div className="grid gap-3 rounded-3xl border border-white/10 bg-black/30 p-4 backdrop-blur-sm sm:min-w-64">
                <div className="flex items-center gap-3 rounded-2xl bg-white/5 p-3">
                  <Target className="shrink-0 text-amber-400" size={18} />
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.22em] text-zinc-400">Estado</p>
                    <p className="text-sm font-bold text-white">{required ? 'Obligatorio al iniciar' : 'Edición disponible'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-2xl bg-white/5 p-3">
                  <CalendarDays className="shrink-0 text-emerald-400" size={18} />
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.22em] text-zinc-400">Campos completados</p>
                    <p className="text-sm font-bold text-white">{completionCount}/{Object.keys(DEFAULT_FORM).length}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-8 px-4 py-5 sm:px-6 sm:py-6">
            {QUESTION_SECTIONS.map(section => {
              const Icon = section.icon;
              return (
                <section key={section.title} className="overflow-hidden rounded-[1.75rem] border border-white/8 bg-white/[0.03]">
                  <div className="flex items-center gap-3 border-b border-white/5 px-5 py-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-300"><Icon size={18} /></div>
                    <div>
                      <h3 className="text-sm font-black uppercase tracking-[0.22em] text-white">{section.title}</h3>
                      <p className="text-xs text-zinc-400">Completa esta parte con la mayor precisión posible.</p>
                    </div>
                  </div>

                  <div className="grid gap-4 p-5 sm:grid-cols-2">
                    {section.fields.map(field => (
                      <label key={field.name} className={`${field.span === 2 ? 'sm:col-span-2' : ''} space-y-2`}>
                        <span className="block text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">{field.label}</span>
                        <Field field={field} value={form[field.name]} onChange={handleChange(field.name)} />
                      </label>
                    ))}
                  </div>
                </section>
              );
            })}

            <div className="rounded-[1.5rem] border border-emerald-500/20 bg-emerald-500/8 px-5 py-4 text-sm text-emerald-100">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-full bg-emerald-500/20 p-2 text-emerald-200"><Sparkles size={14} /></div>
                <p className="leading-relaxed">Los datos se guardan en tu perfil dentro de la app para que puedas reutilizarlos en el seguimiento y en la planificación de objetivos.</p>
              </div>
            </div>

            <button type="submit" disabled={isSaving} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 px-5 py-4 text-xs font-black uppercase tracking-[0.22em] text-black transition-all active:scale-[0.99] disabled:opacity-60">
              {isSaving ? <Loader2 size={16} className="animate-spin" /> : <CheckIcon />}
              {required ? 'Guardar y continuar' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};