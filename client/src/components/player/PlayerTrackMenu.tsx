import { Subtitles, Languages, X } from 'lucide-react';
import { tvFocusClass } from '../android/focus';

interface AudioOption {
  index: number;
  label: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  variant: 'mobile' | 'tv' | 'web';
  audioOptions: AudioOption[];
  subtitleOptions: { index: number; label: string }[];
  activeAudio: number;
  activeSub: number;
  onAudio: (i: number) => void;
  onSub: (i: number) => void;
}

function itemClass(active: boolean, variant: Props['variant']) {
  const base = variant === 'tv'
    ? `w-full text-left px-6 py-4 text-lg rounded-xl min-h-[56px] flex items-center justify-between ${tvFocusClass}`
    : 'w-full text-left px-4 py-3.5 text-sm min-h-[48px] flex items-center justify-between rounded-lg';
  return `${base} ${active ? 'text-accent-glow bg-accent/15 ring-1 ring-accent/30' : 'text-white/90 hover:bg-white/10'}`;
}

export default function PlayerTrackMenu({
  open, onClose, variant, audioOptions, subtitleOptions,
  activeAudio, activeSub, onAudio, onSub,
}: Props) {
  if (!open) return null;

  const isTv = variant === 'tv';
  const isMobile = variant === 'mobile';

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div
        className={
          isTv
            ? 'fixed inset-x-0 top-1/2 -translate-y-1/2 z-[70] mx-auto w-[min(640px,92vw)] rounded-2xl border border-white/10 bg-black/95 shadow-2xl overflow-hidden'
            : isMobile
              ? 'fixed inset-x-0 bottom-0 z-[70] rounded-t-3xl border-t border-white/10 bg-black/95 shadow-2xl overflow-hidden max-h-[75vh] safe-bottom'
              : 'absolute bottom-full right-0 mb-3 z-50 w-[min(320px,calc(100vw-2rem))] rounded-2xl border border-white/10 bg-black/95 backdrop-blur-xl shadow-2xl overflow-hidden'
        }
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-label="Audio y subtítulos"
      >
        <div className={`flex items-center justify-between border-b border-white/10 ${isTv ? 'px-6 py-4' : 'px-4 py-3'}`}>
          <span className={`font-semibold text-white/90 flex items-center gap-2 ${isTv ? 'text-xl' : 'text-sm'}`}>
            <Languages size={isTv ? 22 : 16} className="text-accent-glow" />
            Audio y subtítulos
          </span>
          <button
            type="button"
            onClick={onClose}
            className={isTv ? `p-3 rounded-xl hover:bg-white/10 ${tvFocusClass}` : 'p-2 rounded-lg hover:bg-white/10 min-h-[44px] min-w-[44px]'}
            aria-label="Cerrar"
          >
            <X size={isTv ? 24 : 20} />
          </button>
        </div>

        <div className={`overflow-y-auto ${isTv ? 'max-h-[60vh]' : 'max-h-[50vh]'}`}>
          {audioOptions.length > 0 && (
            <div className="py-2 border-b border-white/10">
              <p className={`px-4 py-2 font-semibold text-gray-400 uppercase tracking-widest ${isTv ? 'text-sm px-6' : 'text-[11px]'}`}>
                Audio
              </p>
              {audioOptions.map(a => (
                <button key={a.index} type="button" onClick={() => onAudio(a.index)} className={itemClass(activeAudio === a.index, variant)}>
                  <span>{a.label}</span>
                  {activeAudio === a.index && <span className="text-accent-glow font-bold">●</span>}
                </button>
              ))}
            </div>
          )}

          <div className="py-2">
            <p className={`px-4 py-2 font-semibold text-gray-400 uppercase tracking-widest flex items-center gap-1.5 ${isTv ? 'text-sm px-6' : 'text-[11px]'}`}>
              <Subtitles size={isTv ? 16 : 12} /> Subtítulos
            </p>
            <button type="button" onClick={() => onSub(-1)} className={itemClass(activeSub === -1, variant)}>
              <span>Desactivados</span>
              {activeSub === -1 && <span className="text-accent-glow font-bold">●</span>}
            </button>
            {subtitleOptions.map(t => (
              <button key={t.index} type="button" onClick={() => onSub(t.index)} className={itemClass(activeSub === t.index, variant)}>
                <span>{t.label}</span>
                {activeSub === t.index && <span className="text-accent-glow font-bold">●</span>}
              </button>
            ))}
            {subtitleOptions.length === 0 && (
              <p className={`text-gray-500 ${isTv ? 'px-6 py-3 text-base' : 'px-4 py-2 text-xs'}`}>Sin subtítulos</p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
