import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Camera } from 'lucide-react';

export const ClientHeaderCard = ({
  name,
  plan,
  avatar,
  onAvatarClick,
  onBackToAdmin,
  isAdminViewing = false,
}) => {
  const displayName = String(name || '').trim();
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: prefersReducedMotion ? 0 : 0.3, ease: 'easeOut' }}
      className="relative overflow-hidden rounded-2xl border border-amber-500/20 bg-gradient-to-br from-zinc-900 via-zinc-900/90 to-black p-5 text-white shadow-xl"
    >
      <div className="pointer-events-none absolute -bottom-8 -right-8 h-28 w-28 rounded-full bg-amber-500/10 blur-2xl" />

      <div className="relative z-10 flex min-w-0 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-4">
          <button
            type="button"
            onClick={onAvatarClick}
            disabled={!onAvatarClick}
            aria-label={onAvatarClick ? 'Cambiar avatar' : undefined}
            className="group relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-amber-500/30 bg-amber-500/10 text-xl font-black text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.15)] disabled:cursor-default"
          >
            {avatar ? (
              <img src={avatar} alt="" className="h-full w-full object-cover" />
            ) : (
              displayName.charAt(0).toUpperCase() || 'U'
            )}
            {onAvatarClick && (
              <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-white opacity-0 transition-opacity group-hover:opacity-100">
                <Camera size={14} />
              </span>
            )}
          </button>
          <div className="min-w-0">
            <h2 className="truncate text-xl font-black uppercase tracking-wide sm:text-2xl">
              {displayName || 'Usuario'}
            </h2>
            <p className="mt-0.5 line-clamp-2 break-words text-xs font-medium text-zinc-400">
              {String(plan || '')}
            </p>
          </div>
        </div>

        {isAdminViewing && onBackToAdmin && (
          <button
            type="button"
            onClick={onBackToAdmin}
            className="shrink-0 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-400 shadow-sm transition-colors hover:bg-amber-500/20 active:scale-95"
          >
            ← Volver Admin
          </button>
        )}
      </div>
    </motion.div>
  );
};
