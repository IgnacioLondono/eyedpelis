import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, Play, Pause, Volume2, VolumeX, Maximize, Minimize,
  Subtitles, Loader2, SkipBack, SkipForward, Settings, Languages,
} from 'lucide-react';

interface SubtitleOption {
  index: number;
  label: string;
  src: string;
  language: string;
}

interface AudioOption {
  index: number;
  label: string;
  language: string;
}

interface ProbeAudioTrack {
  index: number;
  codec: string;
  codecLabel: string;
  language: string;
}

interface VideoAudioTrack {
  enabled: boolean;
  label: string;
  language: string;
}

interface VideoAudioTrackList {
  length: number;
  [index: number]: VideoAudioTrack;
}

type VideoWithAudioTracks = HTMLVideoElement & { audioTracks?: VideoAudioTrackList };

interface Props {
  src: string;
  compatSrc?: string;
  title: string;
  subtitles?: SubtitleOption[];
  probeAudioTracks?: ProbeAudioTrack[];
  onBack: () => void;
  poster?: string;
  useCompat?: boolean;
  audioWarning?: string | null;
  preferredAudioIndex?: number;
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

const LANG_LABELS: Record<string, string> = {
  es: 'Español', spa: 'Español', esp: 'Español',
  en: 'English', eng: 'English',
  ja: 'Japonés', jpn: 'Japonés',
  fr: 'Francés', fre: 'Francés', fra: 'Francés',
  de: 'Alemán', ger: 'Alemán', deu: 'Alemán',
  it: 'Italiano', ita: 'Italiano',
  pt: 'Portugués', por: 'Portugués',
  und: 'Desconocido',
};

function langLabel(code: string, fallback?: string): string {
  const c = code.toLowerCase();
  return LANG_LABELS[c] || fallback || code.toUpperCase();
}

function buildCompatUrl(base: string, audioIndex: number): string {
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}audio=${audioIndex}`;
}

function TrackMenu({
  open,
  onClose,
  audioOptions,
  subtitleOptions,
  activeAudio,
  activeSub,
  onSelectAudio,
  onSelectSubtitle,
  canSwitchAudio,
}: {
  open: boolean;
  onClose: () => void;
  audioOptions: AudioOption[];
  subtitleOptions: { index: number; label: string }[];
  activeAudio: number;
  activeSub: number;
  onSelectAudio: (i: number) => void;
  onSelectSubtitle: (i: number) => void;
  canSwitchAudio: boolean;
}) {
  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} aria-hidden />
      <div
        className="absolute bottom-full right-0 mb-3 z-50 w-[min(320px,calc(100vw-2rem))] rounded-2xl border border-white/10 bg-black/95 backdrop-blur-xl shadow-2xl shadow-black/60 overflow-hidden animate-fade-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
          <span className="text-sm font-semibold text-white/90">Audio y subtítulos</span>
          <Languages size={16} className="text-accent-glow" />
        </div>

        <div className="max-h-[50vh] overflow-y-auto">
          <div className="py-2 border-b border-white/10">
            <p className="px-4 py-1.5 text-[11px] font-semibold text-gray-400 uppercase tracking-widest">Audio</p>
            {audioOptions.length > 0 ? audioOptions.map(a => (
              <button
                key={a.index}
                type="button"
                disabled={!canSwitchAudio && audioOptions.length > 1}
                className={`w-full text-left px-4 py-3 text-sm flex items-center justify-between gap-3 transition-colors ${
                  canSwitchAudio || audioOptions.length === 1
                    ? 'hover:bg-white/10 cursor-pointer'
                    : 'opacity-60 cursor-default'
                } ${activeAudio === a.index ? 'text-accent-glow bg-white/5' : 'text-white/90'}`}
                onClick={() => canSwitchAudio && onSelectAudio(a.index)}
              >
                <span>{a.label}</span>
                {activeAudio === a.index && <span className="text-accent-glow text-xs font-bold">●</span>}
              </button>
            )) : (
              <p className="px-4 py-2 text-xs text-gray-500">Pista de audio principal</p>
            )}
            {audioOptions.length > 1 && !canSwitchAudio && (
              <p className="px-4 pb-2 text-[11px] text-amber-400/80">Cambiando pista de audio…</p>
            )}
          </div>

          <div className="py-2">
            <p className="px-4 py-1.5 text-[11px] font-semibold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
              <Subtitles size={12} /> Subtítulos
            </p>
            <button
              type="button"
              className={`w-full text-left px-4 py-3 text-sm hover:bg-white/10 flex items-center justify-between transition-colors ${
                activeSub === -1 ? 'text-accent-glow bg-white/5' : 'text-white/90'
              }`}
              onClick={() => onSelectSubtitle(-1)}
            >
              <span>Desactivados</span>
              {activeSub === -1 && <span className="text-accent-glow text-xs font-bold">●</span>}
            </button>
            {subtitleOptions.map(t => (
              <button
                key={t.index}
                type="button"
                className={`w-full text-left px-4 py-3 text-sm hover:bg-white/10 flex items-center justify-between gap-3 transition-colors ${
                  activeSub === t.index ? 'text-accent-glow bg-white/5' : 'text-white/90'
                }`}
                onClick={() => onSelectSubtitle(t.index)}
              >
                <span>{t.label}</span>
                {activeSub === t.index && <span className="text-accent-glow text-xs font-bold">●</span>}
              </button>
            ))}
            {subtitleOptions.length === 0 && (
              <p className="px-4 py-2 text-xs text-gray-500">No hay subtítulos para este archivo</p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default function VideoPlayer({
  src, compatSrc, title, subtitles = [], probeAudioTracks = [], onBack, poster,
  useCompat = false, audioWarning = null, preferredAudioIndex = 0,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>();
  const initialSubApplied = useRef(false);
  const userMutedRef = useRef(false);
  const compatAttempted = useRef(useCompat);

  const [activeSrc, setActiveSrc] = useState(useCompat && compatSrc ? compatSrc : src);
  const [compatMode, setCompatMode] = useState(useCompat);
  const [audioNotice, setAudioNotice] = useState<string | null>(audioWarning);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(() => {
    const saved = localStorage.getItem('eyedpelis_volume');
    const parsed = saved ? parseFloat(saved) : 1;
    return Number.isFinite(parsed) ? Math.max(0, Math.min(1, parsed)) : 1;
  });
  const [muted, setMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [buffering, setBuffering] = useState(true);
  const [activeSub, setActiveSub] = useState(-1);
  const [activeAudio, setActiveAudio] = useState(preferredAudioIndex);
  const [textTracks, setTextTracks] = useState<{ index: number; label: string }[]>([]);
  const [browserAudioTracks, setBrowserAudioTracks] = useState<AudioOption[]>([]);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferProgress = duration > 0 ? (buffered / duration) * 100 : 0;

  const probeAudioOptions = useMemo(() =>
    probeAudioTracks.map(t => ({
      index: t.index,
      label: `${langLabel(t.language)}${t.codecLabel ? ` · ${t.codecLabel}` : ''}`,
      language: t.language,
    })),
  [probeAudioTracks]);

  const audioOptions = browserAudioTracks.length > 0 ? browserAudioTracks : probeAudioOptions;

  const subtitleOptions = textTracks.length > 0
    ? textTracks
    : subtitles.map(s => ({ index: s.index, label: s.label }));

  const canSwitchAudioBrowser = browserAudioTracks.length > 1;
  const canSwitchAudioCompat = !canSwitchAudioBrowser && probeAudioOptions.length > 1 && !!compatSrc;
  const canSwitchAudio = canSwitchAudioBrowser || canSwitchAudioCompat;
  const tracksActive = activeSub >= 0 || (audioOptions.length > 1 && activeAudio >= 0);

  const revealControls = useCallback(() => {
    setShowControls(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (playing) {
      hideTimer.current = setTimeout(() => setShowControls(false), 4000);
    }
  }, [playing]);

  const applySubtitleTrack = useCallback((trackIndex: number) => {
    const v = videoRef.current;
    if (!v) return;
    for (let i = 0; i < v.textTracks.length; i++) {
      v.textTracks[i].mode = i === trackIndex ? 'showing' : 'hidden';
    }
    setActiveSub(trackIndex);
  }, []);

  const applyBrowserAudioTrack = useCallback((trackIndex: number) => {
    const v = videoRef.current as VideoWithAudioTracks;
    if (!v?.audioTracks || v.audioTracks.length === 0) return false;
    const idx = Math.max(0, Math.min(trackIndex, v.audioTracks.length - 1));
    for (let i = 0; i < v.audioTracks.length; i++) {
      v.audioTracks[i].enabled = i === idx;
    }
    setActiveAudio(idx);
    return true;
  }, []);

  const switchCompatAudio = useCallback((trackIndex: number) => {
    if (!compatSrc) return;
    compatAttempted.current = true;
    setCompatMode(true);
    setActiveSrc(buildCompatUrl(compatSrc, trackIndex));
    setActiveAudio(trackIndex);
    setBuffering(true);
  }, [compatSrc]);

  const ensureAudioOutput = useCallback(() => {
    const v = videoRef.current;
    if (!v || userMutedRef.current || volume <= 0) return;
    v.muted = false;
    v.volume = volume;
    setMuted(false);
  }, [volume]);

  const ensureAudioTrackEnabled = useCallback((preferred = preferredAudioIndex) => {
    if (applyBrowserAudioTrack(preferred)) return;
    setActiveAudio(preferred);
  }, [applyBrowserAudioTrack, preferredAudioIndex]);

  const refreshTracks = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;

    const subs: { index: number; label: string }[] = [];
    for (let i = 0; i < v.textTracks.length; i++) {
      const t = v.textTracks[i];
      if (t.kind !== 'subtitles' && t.kind !== 'captions') continue;
      const label = t.label || langLabel(t.language, `Subtítulo ${i + 1}`);
      subs.push({ index: i, label });
    }
    setTextTracks(subs);

    const audios: AudioOption[] = [];
    const at = (v as VideoWithAudioTracks).audioTracks;
    if (at && at.length > 0) {
      for (let i = 0; i < at.length; i++) {
        const t = at[i];
        audios.push({
          index: i,
          label: t.label || langLabel(t.language, `Audio ${i + 1}`),
          language: t.language || 'und',
        });
        if (t.enabled) setActiveAudio(i);
      }
    }
    setBrowserAudioTracks(audios);
    if (audios.length === 0) setActiveAudio(preferredAudioIndex);
    else ensureAudioTrackEnabled(preferredAudioIndex);

    if (!initialSubApplied.current && subs.length > 0) {
      initialSubApplied.current = true;
      if (localStorage.getItem('eyedpelis_prefer_subs') !== 'off') {
        const esIdx = subs.findIndex(s => {
          const tt = v.textTracks[s.index];
          const lang = (tt.language || '').toLowerCase();
          return lang === 'es' || lang === 'spa' || lang.startsWith('es');
        });
        if (esIdx >= 0) {
          applySubtitleTrack(subs[esIdx].index);
          return;
        }
      }
    }
  }, [applySubtitleTrack, ensureAudioTrackEnabled, preferredAudioIndex]);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play().catch(() => setError('No se pudo reproducir el video'));
    } else {
      v.pause();
    }
  }, []);

  const seek = useCallback((time: number) => {
    const v = videoRef.current;
    if (!v || !duration) return;
    v.currentTime = Math.max(0, Math.min(time, duration));
  }, [duration]);

  const seekRelative = useCallback((delta: number) => {
    seek(currentTime + delta);
  }, [currentTime, seek]);

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const bar = progressRef.current;
    if (!bar || !duration) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    seek(ratio * duration);
  };

  const toggleFullscreen = useCallback(async () => {
    const el = containerRef.current;
    if (!el) return;
    try {
      if (!document.fullscreenElement) await el.requestFullscreen();
      else await document.exitFullscreen();
    } catch { /* ignore */ }
  }, []);

  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    userMutedRef.current = v.muted;
    setMuted(v.muted);
  }, []);

  const changeVolume = (val: number) => {
    const v = videoRef.current;
    if (!v) return;
    const clamped = Math.max(0, Math.min(1, val));
    v.volume = clamped;
    if (clamped > 0) {
      v.muted = false;
      userMutedRef.current = false;
      setMuted(false);
    } else {
      v.muted = true;
      userMutedRef.current = true;
      setMuted(true);
    }
    setVolume(clamped);
    localStorage.setItem('eyedpelis_volume', String(clamped));
  };

  const switchToCompatStream = useCallback((audioIndex = preferredAudioIndex) => {
    if (!compatSrc || compatAttempted.current) return;
    compatAttempted.current = true;
    setCompatMode(true);
    setActiveSrc(buildCompatUrl(compatSrc, audioIndex));
    setActiveAudio(audioIndex);
    setAudioNotice('Audio convertido a AAC para compatibilidad con el navegador.');
    setBuffering(true);
  }, [compatSrc, preferredAudioIndex]);

  const selectSubtitle = (trackIndex: number) => {
    if (trackIndex === -1) {
      const v = videoRef.current;
      if (v) {
        for (let i = 0; i < v.textTracks.length; i++) {
          v.textTracks[i].mode = 'hidden';
        }
      }
      setActiveSub(-1);
      localStorage.setItem('eyedpelis_prefer_subs', 'off');
    } else {
      applySubtitleTrack(trackIndex);
      localStorage.setItem('eyedpelis_prefer_subs', 'on');
    }
    setShowLangMenu(false);
  };

  const selectAudio = (trackIndex: number) => {
    if (!applyBrowserAudioTrack(trackIndex)) {
      if (canSwitchAudioCompat) {
        switchCompatAudio(trackIndex);
      } else if (probeAudioOptions.length > 1 && compatSrc) {
        switchCompatAudio(trackIndex);
      }
    }
    setShowLangMenu(false);
  };

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.volume = volume;
    v.playbackRate = playbackRate;
  }, [volume, playbackRate]);

  useEffect(() => {
    initialSubApplied.current = false;
    setTextTracks([]);
    setBrowserAudioTracks([]);
    setActiveSub(-1);
    setActiveAudio(preferredAudioIndex);
    setActiveSrc(useCompat && compatSrc ? buildCompatUrl(compatSrc, preferredAudioIndex) : src);
    setCompatMode(useCompat);
    setAudioNotice(audioWarning);
    compatAttempted.current = useCompat;
  }, [src, compatSrc, useCompat, audioWarning, preferredAudioIndex]);

  useEffect(() => {
    setAudioNotice(audioWarning);
  }, [audioWarning]);

  useEffect(() => {
    if (compatMode || !compatSrc || compatAttempted.current) return;

    const timer = window.setInterval(() => {
      const v = videoRef.current as HTMLVideoElement & { webkitAudioDecodedByteCount?: number };
      if (!v || v.paused || v.currentTime < 2) return;

      const decoded = v.webkitAudioDecodedByteCount;
      if (typeof decoded === 'number' && decoded === 0) {
        switchToCompatStream();
      }
    }, 1500);

    return () => window.clearInterval(timer);
  }, [compatMode, compatSrc, switchToCompatStream, activeSrc]);

  useEffect(() => {
    const onFs = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          seekRelative(-10);
          break;
        case 'ArrowRight':
          e.preventDefault();
          seekRelative(10);
          break;
        case 'ArrowUp':
          e.preventDefault();
          changeVolume(volume + 0.1);
          break;
        case 'ArrowDown':
          e.preventDefault();
          changeVolume(volume - 0.1);
          break;
        case 'f':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'm':
          e.preventDefault();
          toggleMute();
          break;
        case 'c':
          e.preventDefault();
          setShowLangMenu(s => !s);
          setShowSettings(false);
          break;
        case 'Escape':
          if (showLangMenu) setShowLangMenu(false);
          else if (showSettings) setShowSettings(false);
          break;
      }
      revealControls();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [togglePlay, seekRelative, toggleFullscreen, toggleMute, volume, revealControls, showLangMenu, showSettings]);

  useEffect(() => {
    revealControls();
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
  }, [playing, revealControls]);

  const controlBtn = 'p-2.5 rounded-xl hover:bg-white/15 active:bg-white/20 transition-all duration-200 hover:scale-105 active:scale-95';

  return (
    <div
      ref={containerRef}
      className="relative w-full h-screen bg-black overflow-hidden select-none"
      onMouseMove={revealControls}
      onMouseLeave={() => playing && setShowControls(false)}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('[data-controls]')) return;
        togglePlay();
        revealControls();
      }}
    >
      <video
        ref={videoRef}
        key={activeSrc}
        src={activeSrc}
        poster={poster}
        className="w-full h-full object-contain"
        playsInline
        autoPlay
        onPlay={() => {
          setPlaying(true);
          setBuffering(false);
          ensureAudioOutput();
        }}
        onPause={() => { setPlaying(false); setShowControls(true); }}
        onTimeUpdate={() => {
          const v = videoRef.current;
          if (!v) return;
          setCurrentTime(v.currentTime);
          if (v.buffered.length > 0) {
            setBuffered(v.buffered.end(v.buffered.length - 1));
          }
        }}
        onLoadedMetadata={() => {
          const v = videoRef.current;
          if (v) setDuration(v.duration);
          refreshTracks();
        }}
        onLoadedData={() => refreshTracks()}
        onWaiting={() => setBuffering(true)}
        onCanPlay={() => {
          setBuffering(false);
          ensureAudioOutput();
          ensureAudioTrackEnabled(preferredAudioIndex);
        }}
        onError={() => {
          if (!compatAttempted.current && compatSrc) {
            switchToCompatStream();
            return;
          }
          setError('Error al cargar el video. Comprueba el formato o la conexión.');
        }}
      >
        {subtitles.map(sub => (
          <track
            key={sub.index}
            kind="subtitles"
            src={sub.src}
            srcLang={sub.language}
            label={sub.label}
            default={false}
          />
        ))}
      </video>

      {audioNotice && !error && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 max-w-md px-4 py-2.5 bg-black/80 backdrop-blur-md border border-amber-500/30 rounded-xl text-amber-100 text-sm text-center pointer-events-none shadow-lg">
          {audioNotice}
        </div>
      )}

      {buffering && !error && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-black/40 backdrop-blur-sm rounded-full p-4">
            <Loader2 size={44} className="text-white animate-spin" />
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/90">
          <p className="text-red-400">{error}</p>
          <button type="button" onClick={onBack} className="btn-secondary">Volver</button>
        </div>
      )}

      {/* Overlays */}
      <div className={`absolute inset-0 pointer-events-none transition-opacity duration-500 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
        <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/90 via-black/40 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black via-black/80 to-transparent" />
      </div>

      {/* Top bar */}
      <div
        data-controls
        className={`absolute top-0 left-0 right-0 z-20 flex items-center gap-3 px-5 md:px-8 py-5 transition-all duration-500 ${
          showControls ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'
        }`}
      >
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onBack(); }}
          className={`${controlBtn} bg-black/30 backdrop-blur-sm`}
          aria-label="Volver"
        >
          <ArrowLeft size={22} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base md:text-xl font-bold truncate drop-shadow-lg">{title}</h1>
          {playing && (
            <p className="text-xs text-white/50 mt-0.5 hidden sm:block">Eyedpelis</p>
          )}
        </div>
      </div>

      {!playing && !buffering && !error && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-black/50 backdrop-blur-md rounded-full p-6 ring-1 ring-white/20 shadow-2xl">
            <Play size={44} fill="white" className="text-white ml-1" />
          </div>
        </div>
      )}

      {/* Bottom controls */}
      <div
        data-controls
        className={`absolute bottom-0 left-0 right-0 z-20 transition-all duration-500 ${
          showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6 pointer-events-none'
        }`}
        onClick={e => e.stopPropagation()}
      >
        <div className="px-4 md:px-8 pb-6 pt-2">
          {/* Progress */}
          <div
            ref={progressRef}
            className="group relative h-1 mb-5 cursor-pointer rounded-full bg-white/15 hover:h-1.5 transition-all"
            onClick={handleProgressClick}
          >
            <div className="absolute inset-y-0 left-0 bg-white/25 rounded-full transition-all" style={{ width: `${bufferProgress}%` }} />
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-accent to-accent-glow transition-all"
              style={{ width: `${progress}%` }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg ring-2 ring-accent/50 opacity-0 group-hover:opacity-100 transition-opacity -ml-2"
              style={{ left: `${progress}%` }}
            />
          </div>

          <div className="flex items-center gap-2 md:gap-4 bg-black/40 backdrop-blur-md rounded-2xl px-3 py-2 md:px-4 md:py-2.5 border border-white/10">
            {/* Play cluster */}
            <div className="flex items-center">
              <button type="button" onClick={() => seekRelative(-10)} className={`${controlBtn} hidden sm:flex`} aria-label="Retroceder 10s">
                <SkipBack size={20} />
              </button>
              <button type="button" onClick={togglePlay} className={`${controlBtn} mx-0.5`} aria-label={playing ? 'Pausar' : 'Reproducir'}>
                {playing ? <Pause size={24} fill="white" /> : <Play size={24} fill="white" />}
              </button>
              <button type="button" onClick={() => seekRelative(10)} className={`${controlBtn} hidden sm:flex`} aria-label="Avanzar 10s">
                <SkipForward size={20} />
              </button>
            </div>

            <span className="text-xs md:text-sm text-white/80 tabular-nums font-medium min-w-[88px] md:min-w-[110px]">
              {formatTime(currentTime)}
              <span className="text-white/40 mx-1">/</span>
              {formatTime(duration)}
            </span>

            <div className="flex-1" />

            {/* Audio & subtitles — always visible */}
            <div className="relative">
              <button
                type="button"
                onClick={() => { setShowLangMenu(s => !s); setShowSettings(false); }}
                className={`${controlBtn} flex items-center gap-2 ${tracksActive ? 'text-accent-glow bg-accent/10 ring-1 ring-accent/30' : ''}`}
                aria-label="Audio y subtítulos"
                title="Audio y subtítulos (C)"
              >
                <Languages size={20} />
                <span className="hidden md:inline text-xs font-medium">Audio</span>
              </button>
              <TrackMenu
                open={showLangMenu}
                onClose={() => setShowLangMenu(false)}
                audioOptions={audioOptions}
                subtitleOptions={subtitleOptions}
                activeAudio={activeAudio}
                activeSub={activeSub}
                onSelectAudio={selectAudio}
                onSelectSubtitle={selectSubtitle}
                canSwitchAudio={canSwitchAudio}
              />
            </div>

            {/* Quick subtitle toggle */}
            {subtitleOptions.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (activeSub >= 0) selectSubtitle(-1);
                  else selectSubtitle(subtitleOptions[0].index);
                }}
                className={`${controlBtn} ${activeSub >= 0 ? 'text-accent-glow bg-accent/10 ring-1 ring-accent/30' : ''}`}
                aria-label="Alternar subtítulos"
                title="Alternar subtítulos"
              >
                <Subtitles size={20} />
              </button>
            )}

            {/* Volume */}
            <div className="flex items-center gap-1 group/vol">
              <button type="button" onClick={toggleMute} className={controlBtn} aria-label={muted ? 'Activar sonido' : 'Silenciar'}>
                {muted || volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={muted ? 0 : volume}
                onChange={e => changeVolume(parseFloat(e.target.value))}
                className="w-0 group-hover/vol:w-24 transition-all duration-300 accent-accent hidden md:block h-1 cursor-pointer"
              />
            </div>

            {/* Settings */}
            <div className="relative">
              <button
                type="button"
                onClick={() => { setShowSettings(s => !s); setShowLangMenu(false); }}
                className={controlBtn}
                aria-label="Ajustes"
              >
                <Settings size={20} />
              </button>
              {showSettings && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowSettings(false)} />
                  <div className="absolute right-0 bottom-full mb-3 z-50 bg-black/95 backdrop-blur-xl border border-white/10 rounded-xl py-2 min-w-[150px] shadow-2xl">
                    <p className="px-4 py-1.5 text-[11px] font-semibold text-gray-400 uppercase tracking-widest">Velocidad</p>
                    {[0.5, 0.75, 1, 1.25, 1.5, 2].map(rate => (
                      <button
                        key={rate}
                        type="button"
                        className={`w-full text-left px-4 py-2.5 text-sm hover:bg-white/10 transition-colors ${
                          playbackRate === rate ? 'text-accent-glow font-medium' : ''
                        }`}
                        onClick={() => { setPlaybackRate(rate); setShowSettings(false); }}
                      >
                        {rate === 1 ? 'Normal' : `${rate}x`}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <button type="button" onClick={toggleFullscreen} className={controlBtn} aria-label="Pantalla completa">
              {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
