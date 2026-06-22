import { Settings } from 'lucide-react';
import { tvFocusClass } from '../android/focus';

interface Props {
  open: boolean;
  onClose: () => void;
  variant: 'mobile' | 'tv' | 'web';
  playbackRate: number;
  onRate: (r: number) => void;
}

const RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];

export default function PlayerSettingsMenu({ open, onClose, variant, playbackRate, onRate }: Props) {
  if (!open) return null;

  const isTv = variant === 'tv';
  const isMobile = variant === 'mobile';

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/70" onClick={onClose} aria-hidden />
      <div
        className={
          isTv
            ? 'fixed right-8 bottom-28 z-[70] bg-black/95 border border-white/10 rounded-2xl py-3 min-w-[220px] shadow-2xl'
            : isMobile
              ? 'fixed inset-x-4 bottom-24 z-[70] bg-black/95 border border-white/10 rounded-2xl py-2 shadow-2xl'
              : 'absolute right-0 bottom-full mb-3 z-50 bg-black/95 border border-white/10 rounded-xl py-2 min-w-[150px] shadow-2xl'
        }
        onClick={e => e.stopPropagation()}
      >
        <p className={`px-4 py-2 font-semibold text-gray-400 uppercase flex items-center gap-2 ${isTv ? 'text-sm' : 'text-[11px]'}`}>
          <Settings size={isTv ? 16 : 12} /> Velocidad
        </p>
        {RATES.map(r => (
          <button
            key={r}
            type="button"
            onClick={() => { onRate(r); onClose(); }}
            className={
              isTv
                ? `w-full text-left px-5 py-3 text-lg min-h-[52px] hover:bg-white/10 ${tvFocusClass} ${playbackRate === r ? 'text-accent-glow font-semibold' : ''}`
                : `w-full text-left px-4 py-3 text-sm min-h-[48px] hover:bg-white/10 ${playbackRate === r ? 'text-accent-glow font-medium' : ''}`
            }
          >
            {r === 1 ? 'Normal' : `${r}x`}
          </button>
        ))}
      </div>
    </>
  );
}
