import { useState } from 'react';
import { CheckCircle2, MessageSquareHeart, Send } from 'lucide-react';

const REACTIONS = [
  { id: 'liked', label: 'Me gusta' },
  { id: 'neutral', label: 'Está bien' },
  { id: 'change', label: 'Prefiero cambiarlo' },
];

const REASONS = [
  { id: 'pain', label: 'Molestia o dolor' },
  { id: 'too_hard', label: 'Muy difícil' },
  { id: 'too_easy', label: 'Muy fácil' },
  { id: 'preference', label: 'No me convence' },
  { id: 'equipment', label: 'No tengo material' },
];

const STATUS_LABELS = {
  new: 'Enviado al entrenador',
  reviewed: 'Revisado por el entrenador',
  resolved: 'Entrenador actualizó el ejercicio',
};

export const ClientExerciseFeedback = ({ exerciseName, dayId, dayTitle, feedback = [], onSubmit, palette }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [reaction, setReaction] = useState('');
  const [reason, setReason] = useState('');
  const [comment, setComment] = useState('');
  const accent = palette?.accent || '#D4AF37';
  const latestFeedback = [...feedback]
    .filter(item => item.exerciseName === exerciseName && item.dayId === dayId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];

  const submit = () => {
    if (!reaction) return;
    onSubmit({
      id: Date.now(),
      exerciseName,
      dayId,
      dayTitle,
      reaction,
      reason,
      comment: comment.trim(),
      createdAt: new Date().toISOString(),
      status: 'new',
    });
    setIsOpen(false);
    setReaction('');
    setReason('');
    setComment('');
  };

  return (
    <div className="mt-4 border-t pt-4" style={{ borderColor: `${palette?.text || '#fff'}15` }}>
      {latestFeedback && (
        <p className="mb-2 flex items-center gap-1.5 text-[9px] font-bold" style={{ color: latestFeedback.status === 'resolved' ? '#34d399' : accent }}>
          <CheckCircle2 size={12}/>{STATUS_LABELS[latestFeedback.status] || STATUS_LABELS.new}
        </p>
      )}
      {!isOpen ? (
        <button type="button" onClick={() => setIsOpen(true)} className="flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-[9px] font-black uppercase" style={{ borderColor: `${accent}30`, color: accent, backgroundColor: `${accent}08` }}>
          <MessageSquareHeart size={14}/> ¿Cómo te fue con este ejercicio?
        </button>
      ) : (
        <div className="space-y-3 rounded-xl border p-3" style={{ borderColor: `${accent}25`, backgroundColor: `${palette?.dark || '#09090b'}cc` }}>
          <p className="text-[9px] font-black uppercase" style={{ color: accent }}>Tu opinión sobre {exerciseName}</p>
          <div className="grid grid-cols-3 gap-1.5">
            {REACTIONS.map(option => (
              <button key={option.id} type="button" aria-pressed={reaction === option.id} onClick={() => setReaction(option.id)} className="min-h-10 rounded-lg border px-2 py-2 text-[8px] font-bold" style={reaction === option.id ? { backgroundColor: accent, color: palette?.dark || '#09090b', borderColor: accent } : { borderColor: `${palette?.text || '#fff'}20`, color: `${palette?.text || '#fff'}90` }}>
                {option.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {REASONS.map(option => (
              <button key={option.id} type="button" aria-pressed={reason === option.id} onClick={() => setReason(reason === option.id ? '' : option.id)} className="rounded-full border px-2.5 py-1.5 text-[8px] font-bold" style={reason === option.id ? { backgroundColor: option.id === 'pain' ? '#7f1d1d' : `${accent}25`, color: option.id === 'pain' ? '#fecaca' : accent, borderColor: option.id === 'pain' ? '#ef4444' : `${accent}50` } : { borderColor: `${palette?.text || '#fff'}15`, color: `${palette?.text || '#fff'}70` }}>
                {option.label}
              </button>
            ))}
          </div>
          {reason === 'pain' && <p role="note" className="text-[9px] leading-relaxed text-red-300">Detén el ejercicio si te causa dolor y avisa al entrenador antes de repetirlo.</p>}
          <textarea value={comment} onChange={event => setComment(event.target.value)} maxLength={240} placeholder="Comentario opcional" aria-label="Comentario sobre el ejercicio" className="min-h-16 w-full resize-y rounded-lg border bg-transparent p-2.5 text-xs outline-none" style={{ borderColor: `${palette?.text || '#fff'}20`, color: palette?.text || '#fff' }}/>
          <div className="flex items-center justify-between gap-2">
            <button type="button" onClick={() => setIsOpen(false)} className="rounded-lg px-3 py-2 text-[9px] font-bold text-zinc-400">Cancelar</button>
            <button type="button" disabled={!reaction} onClick={submit} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-[9px] font-black uppercase disabled:opacity-40" style={{ backgroundColor: accent, color: palette?.dark || '#09090b' }}><Send size={12}/> Enviar al entrenador</button>
          </div>
        </div>
      )}
    </div>
  );
};

const REACTION_LABELS = { liked: 'Le gusta', neutral: 'Le parece bien', change: 'Prefiere cambiarlo' };
const REASON_LABELS = {
  pain: 'Molestia o dolor',
  too_hard: 'Muy difícil',
  too_easy: 'Muy fácil',
  preference: 'No le convence',
  equipment: 'Sin material',
};

export const AdminExerciseFeedbackInbox = ({ items = [], onReview, onResolve, onOpenExercise }) => (
  <div className="space-y-2">
    {items.map(item => (
      <article key={item.id} className={`rounded-xl border p-3 ${item.reason === 'pain' && item.status === 'new' ? 'border-red-500/30 bg-red-500/5' : 'border-zinc-800 bg-zinc-950/80'}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[9px] font-black uppercase text-amber-400">{item.dayTitle || 'Rutina'} · {item.exerciseName}</p>
            <p className="mt-1 text-[10px] font-bold text-zinc-200">{REACTION_LABELS[item.reaction] || 'Feedback'}{item.reason ? ` · ${REASON_LABELS[item.reason] || item.reason}` : ''}</p>
            {item.comment && <p className="mt-1 whitespace-pre-wrap text-[10px] leading-relaxed text-zinc-400">{item.comment}</p>}
            <p className={`mt-1 text-[8px] font-black uppercase ${item.reason === 'pain' && item.status === 'new' ? 'text-red-300' : item.status === 'resolved' ? 'text-emerald-400' : 'text-zinc-600'}`}>
              {item.reason === 'pain' && item.status === 'new' ? 'Requiere atención' : item.status === 'resolved' ? 'Resuelto' : item.status === 'reviewed' ? 'Revisado' : 'Pendiente'} · {new Date(item.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-zinc-800 px-2 py-1 text-[8px] font-bold text-zinc-400">{item.status === 'new' ? 'Nuevo' : item.status === 'resolved' ? 'Resuelto' : 'Visto'}</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => onOpenExercise(item.dayId, item.exerciseName)} disabled={!item.dayId} className="rounded-lg border border-amber-500/20 px-3 py-2 text-[8px] font-black uppercase text-amber-300 disabled:opacity-40">Ir al ejercicio</button>
          {item.status === 'new' && <button type="button" onClick={() => onReview(item.id)} className="rounded-lg border border-zinc-700 px-3 py-2 text-[8px] font-black uppercase text-zinc-300">Marcar revisado</button>}
          {item.status !== 'resolved' && <button type="button" onClick={() => onResolve(item.id)} className="rounded-lg bg-emerald-500/10 px-3 py-2 text-[8px] font-black uppercase text-emerald-300">Marcar resuelto</button>}
        </div>
      </article>
    ))}
  </div>
);
