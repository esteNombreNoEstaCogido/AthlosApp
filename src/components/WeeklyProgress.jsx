import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

export const WeeklyProgress = ({
  currentSessions,
  targetSessions,
  onTargetChange,
  disabled = false,
  palette = null,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const safeTarget = Math.max(Number(targetSessions) || 1, 1);
  const safeCurrent = Math.max(Number(currentSessions) || 0, 0);
  const percentage = Math.min((safeCurrent / safeTarget) * 100, 100);
  const sessionsRemaining = Math.max(safeTarget - safeCurrent, 0);
  const completed = percentage >= 100;
  const accent = palette?.accent || '#f59e0b';

  return (
    <div
      className="rounded-2xl border border-zinc-800/80 bg-zinc-900/80 p-4 shadow-lg backdrop-blur-md"
      style={palette ? { backgroundColor: `${palette.card}ee`, borderColor: `${accent}25`, color: palette.text } : undefined}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span aria-hidden="true" className="text-amber-400">📅</span>
          <h3 id="consistency-title" className="text-xs font-bold uppercase tracking-wider" style={{ color: accent }}>
            Tu constancia
          </h3>
        </div>

        {onTargetChange && (
          <label className="shrink-0 text-right">
            <span className="block text-[8px] font-bold uppercase opacity-55">Meta semanal</span>
            <select
              value={safeTarget}
              disabled={disabled}
              onChange={event => onTargetChange(Number(event.target.value))}
              aria-label="Meta semanal de entrenamientos"
              className="mt-1 rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-xs font-bold text-white focus:border-amber-500 focus:outline-none disabled:opacity-70"
              style={palette ? { backgroundColor: palette.dark, color: palette.text, borderColor: `${accent}35` } : undefined}
            >
              {[1, 2, 3, 4, 5, 6, 7].map(num => (
                <option key={num} value={num}>{num} días</option>
              ))}
            </select>
          </label>
        )}
      </div>

      <p className="mb-4 text-[9px] opacity-55">
        Cada sesión cuenta. El calendario no se reinicia ni te penaliza.
      </p>

      <div className="mb-2 flex items-end justify-between gap-3">
        <p className="shrink-0 text-2xl font-black tabular-nums">
          {safeCurrent}
          <span className="ml-1 text-xs font-bold opacity-50">/ {safeTarget} sesiones</span>
        </p>
        <p className="text-right text-[9px] font-bold opacity-60">
          {completed
            ? 'Meta semanal alcanzada. Buen trabajo.'
            : `A tu ritmo: ${sessionsRemaining} ${sessionsRemaining === 1 ? 'sesión' : 'sesiones'} para tu meta`}
        </p>
      </div>

      <div
        className="h-3 w-full overflow-hidden rounded-full border border-zinc-700/50 bg-zinc-800/80 p-0.5"
        role="progressbar"
        aria-label="Progreso del objetivo semanal"
        aria-valuemin={0}
        aria-valuemax={safeTarget}
        aria-valuenow={Math.min(safeCurrent, safeTarget)}
      >
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-amber-500 to-yellow-300 shadow-[0_0_12px_rgba(245,158,11,0.35)]"
          initial={prefersReducedMotion ? false : { width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.8, ease: 'easeOut' }}
          style={palette ? { background: `linear-gradient(to right, ${accent}, #fde047)` } : undefined}
        />
      </div>
    </div>
  );
};
