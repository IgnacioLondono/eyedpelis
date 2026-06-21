import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft, Play, Pause, Volume2, VolumeX, Maximize, Minimize,
  Subtitles, Loader2, SkipBack, SkipForward, Settings,
} from 'lucide-react';

interface SubtitleOption {
  index: number;
  label: string;
  src: string;
  language: string;
}

interface Props {
  src: string;
  title: string;
  subtitles?: SubtitleOption[];
  onBack: () => void;
  poster?: string;
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function VideoPlayer({ src, title, subtitles = [], onBack, poster }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>();

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(() => {
    const saved = localStorage.getItem('eyedpelis_volume');
    return saved ? parseFloat(saved) : 1;
  });
  const [muted, setMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [buffering, setBuffering] = useState(true);
  const [activeSub, setActiveSub] = useState(-1);
  const [showSubMenu, setShowSubMenu] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferProgress = duration > 0 ? (buffered / duration) * 100 : 0;

  const revealControls = useCallback(() => {
    setShowControls(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (playing) {
      hideTimer.current = setTimeout(() => setShowControls(false), 3500);
    }
  }, [playing]);

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
    const ratio = (e.clientX - rect.left) / rect.width;
    seek(ratio * duration);
  };

  const toggleFullscreen = useCallback(async () => {
    const el = containerRef.current;
    if (!el) return;
    try {
      if (!document.fullscreenElement) {
        await el.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch { /* ignore */ }
  }, []);

  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  }, []);

  const changeVolume = (val: number) => {
    const v = videoRef.current;
    if (!v) return;
    const clamped = Math.max(0, Math.min(1, val));
    v.volume = clamped;
    v.muted = clamped === 0;
    setVolume(clamped);
    setMuted(clamped === 0);
    localStorage.setItem('eyedpelis_volume', String(clamped));
  };

  const togglePiP = async () => {
    const v = videoRef.current;
    if (!v) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled) {
        await v.requestPictureInPicture();
      }
    } catch { /* ignore */ }
  };

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.volume = volume;
    v.playbackRate = playbackRate;
  }, [volume, playbackRate, src]);

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
        case 'Escape':
          if (showSubMenu) setShowSubMenu(false);
          else if (showSettings) setShowSettings(false);
          break;
      }
      revealControls();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [togglePlay, seekRelative, toggleFullscreen, toggleMute, volume, revealControls, showSubMenu, showSettings]);

  useEffect(() => {
    revealControls();
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
  }, [playing, revealControls]);

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
        key={`${src}-${activeSub}`}
        src={src}
        poster={poster}
        className="w-full h-full object-contain"
        playsInline
        autoPlay
        onPlay={() => { setPlaying(true); setBuffering(false); }}
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
        }}
        onWaiting={() => setBuffering(true)}
        onCanPlay={() => setBuffering(false)}
        onError={() => setError('Error al cargar el video. Comprueba el formato o la conexión.')}
      >
        {activeSub >= 0 && subtitles[activeSub] && (
          <track
            kind="subtitles"
            src={subtitles[activeSub].src}
            srcLang={subtitles[activeSub].language}
            label={subtitles[activeSub].label}
            default
          />
        )}
      </video>

      {/* Buffering */}
      {buffering && !error && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <Loader2 size={48} className="text-white/80 animate-spin" />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/90">
          <p className="text-red-400">{error}</p>
          <button type="button" onClick={onBack} className="btn-secondary">Volver</button>
        </div>
      )}

      {/* Gradient overlays */}
      <div
        className={`absolute inset-0 pointer-events-none transition-opacity duration-500 ${
          showControls ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/80 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/90 to-transparent" />
      </div>

      {/* Top bar */}
      <div
        data-controls
        className={`absolute top-0 left-0 right-0 z-20 flex items-center gap-4 px-4 md:px-6 py-4 transition-all duration-500 ${
          showControls ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'
        }`}
      >
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onBack(); }}
          className="p-2 rounded-full hover:bg-white/10 transition-colors"
          aria-label="Volver"
        >
          <ArrowLeft size={22} />
        </button>
        <h1 className="text-base md:text-lg font-semibold truncate flex-1">{title}</h1>

        <div className="flex items-center gap-1">
          {document.pictureInPictureEnabled && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); togglePiP(); }}
              className="p-2 rounded-full hover:bg-white/10 transition-colors text-sm hidden sm:block"
              title="Picture-in-Picture"
            >
              ⧉
            </button>
          )}
          {subtitles.length > 0 && (
            <div className="relative">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setShowSubMenu(s => !s); setShowSettings(false); }}
                className={`p-2 rounded-full hover:bg-white/10 transition-colors ${activeSub >= 0 ? 'text-accent-glow' : ''}`}
                aria-label="Subtítulos"
              >
                <Subtitles size={20} />
              </button>
              {showSubMenu && (
                <div className="absolute right-0 top-full mt-2 bg-black/90 border border-white/10 rounded-xl py-2 min-w-[180px] shadow-xl">
                  <button
                    type="button"
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-white/10 ${activeSub === -1 ? 'text-accent-glow' : ''}`}
                    onClick={(e) => { e.stopPropagation(); setActiveSub(-1); setShowSubMenu(false); }}
                  >
                    Desactivados
                  </button>
                  {subtitles.map(sub => (
                    <button
                      key={sub.index}
                      type="button"
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-white/10 ${activeSub === sub.index ? 'text-accent-glow' : ''}`}
                      onClick={(e) => { e.stopPropagation(); setActiveSub(sub.index); setShowSubMenu(false); }}
                    >
                      {sub.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Center play (when paused) */}
      {!playing && !buffering && !error && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-black/50 rounded-full p-5 backdrop-blur-sm">
            <Play size={40} fill="white" className="text-white ml-1" />
          </div>
        </div>
      )}

      {/* Bottom controls */}
      <div
        data-controls
        className={`absolute bottom-0 left-0 right-0 z-20 px-4 md:px-6 pb-5 pt-8 transition-all duration-500 ${
          showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
        onClick={e => e.stopPropagation()}
      >
        {/* Progress bar */}
        <div
          ref={progressRef}
          className="group relative h-1.5 mb-4 cursor-pointer rounded-full bg-white/20 hover:h-2.5 transition-all"
          onClick={handleProgressClick}
        >
          <div
            className="absolute inset-y-0 left-0 bg-white/30 rounded-full"
            style={{ width: `${bufferProgress}%` }}
          />
          <div
            className="absolute inset-y-0 left-0 bg-white rounded-full group-hover:bg-accent-glow transition-colors"
            style={{ width: `${progress}%` }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity -ml-1.5"
            style={{ left: `${progress}%` }}
          />
        </div>

        <div className="flex items-center gap-3 md:gap-5">
          {/* Play / skip */}
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => seekRelative(-10)} className="p-2 rounded-full hover:bg-white/10 hidden sm:block" aria-label="Retroceder 10s">
              <SkipBack size={18} />
            </button>
            <button type="button" onClick={togglePlay} className="p-2 rounded-full hover:bg-white/10" aria-label={playing ? 'Pausar' : 'Reproducir'}>
              {playing ? <Pause size={22} fill="white" /> : <Play size={22} fill="white" />}
            </button>
            <button type="button" onClick={() => seekRelative(10)} className="p-2 rounded-full hover:bg-white/10 hidden sm:block" aria-label="Avanzar 10s">
              <SkipForward size={18} />
            </button>
          </div>

          {/* Time */}
          <span className="text-xs md:text-sm text-white/90 tabular-nums min-w-[100px]">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>

          <div className="flex-1" />

          {/* Volume */}
          <div className="flex items-center gap-2 group/vol">
            <button type="button" onClick={toggleMute} className="p-2 rounded-full hover:bg-white/10" aria-label={muted ? 'Activar sonido' : 'Silenciar'}>
              {muted || volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={e => changeVolume(parseFloat(e.target.value))}
              className="w-0 group-hover/vol:w-20 transition-all duration-300 accent-white hidden sm:block"
            />
          </div>

          {/* Settings (speed) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => { setShowSettings(s => !s); setShowSubMenu(false); }}
              className="p-2 rounded-full hover:bg-white/10"
              aria-label="Ajustes"
            >
              <Settings size={20} />
            </button>
            {showSettings && (
              <div className="absolute right-0 bottom-full mb-2 bg-black/90 border border-white/10 rounded-xl py-2 min-w-[140px] shadow-xl">
                <p className="px-4 py-1 text-xs text-gray-500 uppercase">Velocidad</p>
                {[0.5, 0.75, 1, 1.25, 1.5, 2].map(rate => (
                  <button
                    key={rate}
                    type="button"
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-white/10 ${playbackRate === rate ? 'text-accent-glow' : ''}`}
                    onClick={() => { setPlaybackRate(rate); setShowSettings(false); }}
                  >
                    {rate === 1 ? 'Normal' : `${rate}x`}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Fullscreen */}
          <button type="button" onClick={toggleFullscreen} className="p-2 rounded-full hover:bg-white/10" aria-label="Pantalla completa">
            {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
          </button>
        </div>
      </div>
    </div>
  );
}
