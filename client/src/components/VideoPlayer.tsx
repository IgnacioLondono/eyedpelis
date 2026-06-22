import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, Play, Pause, Volume2, VolumeX, Maximize, Minimize,
  Subtitles, Loader2, SkipBack, SkipForward, Settings, Languages,
} from 'lucide-react';
import { findActiveCue, parseVtt, type VttCue } from '../utils/vttParser';
import { getAuthToken } from '../api';
import { isTv } from '../utils/device';

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

interface Props {
  src: string;
  compatSrc?: string;
  compatAudioSrc?: string;
  title: string;
  subtitles?: SubtitleOption[];
  probeAudioTracks?: Array<{ index: number; language: string; codecLabel?: string }>;
  onBack: () => void;
  poster?: string;
  knownDuration?: number | null;
  needsAudioCompat?: boolean;
  preferredAudioIndex?: number;
}

type Engine = 'direct' | 'split' | 'transcode';

interface Playback {
  engine: Engine;
  videoSrc: string;
  audioSrc?: string;
  muxSrc?: string;
  audioIndex: number;
  offset: number;
}

const LANG: Record<string, string> = {
  es: 'Español', spa: 'Español', esp: 'Español',
  en: 'English', eng: 'English',
  ja: 'Japonés', jpn: 'Japonés',
  fr: 'Francés', fre: 'Francés', fra: 'Francés',
  de: 'Alemán', ger: 'Alemán', deu: 'Alemán',
  it: 'Italiano', ita: 'Italiano',
  pt: 'Portugués', por: 'Portugués',
};

function langLabel(code: string): string {
  const c = code.toLowerCase();
  return LANG[c] || LANG[c.slice(0, 2)] || code.toUpperCase();
}

function formatTime(s: number): string {
  if (!Number.isFinite(s) || s < 0) return '0:00';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function buildStreamUrl(base: string, audio: number, startSec: number, gen: number): string {
  const sep = base.includes('?') ? '&' : '?';
  let url = `${base}${sep}audio=${audio}&_g=${gen}`;
  if (startSec > 0.5) url += `&start=${startSec.toFixed(2)}`;
  return url;
}

function initialPlayback(
  videoSrc: string,
  compatSrc: string | undefined,
  compatAudioSrc: string | undefined,
  needsCompat: boolean,
  audioIndex: number,
): Playback {
  // Split: vídeo directo (seek nativo preciso) + audio transcodificado aparte
  if (needsCompat && compatAudioSrc) {
    return {
      engine: 'split',
      videoSrc,
      audioSrc: buildStreamUrl(compatAudioSrc, audioIndex, 0, 0),
      audioIndex,
      offset: 0,
    };
  }
  if (needsCompat && compatSrc) {
    return {
      engine: 'transcode',
      videoSrc,
      muxSrc: buildStreamUrl(compatSrc, audioIndex, 0, 0),
      audioIndex,
      offset: 0,
    };
  }
  return { engine: 'direct', videoSrc, audioIndex, offset: 0 };
}

async function tryPlay(el: HTMLMediaElement) {
  try { await el.play(); } catch { /* ignore */ }
}

function TrackMenu({ open, onClose, audioOptions, subtitleOptions, activeAudio, activeSub, onAudio, onSub }: {
  open: boolean;
  onClose: () => void;
  audioOptions: AudioOption[];
  subtitleOptions: { index: number; label: string }[];
  activeAudio: number;
  activeSub: number;
  onAudio: (i: number) => void;
  onSub: (i: number) => void;
}) {
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} aria-hidden />
      <div className="absolute bottom-full right-0 mb-3 z-50 w-[min(320px,calc(100vw-2rem))] rounded-2xl border border-white/10 bg-black/95 backdrop-blur-xl shadow-2xl overflow-hidden animate-fade-in" onClick={e => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
          <span className="text-sm font-semibold text-white/90">Audio y subtítulos</span>
          <Languages size={16} className="text-accent-glow" />
        </div>
        <div className="max-h-[50vh] overflow-y-auto">
          <div className="py-2 border-b border-white/10">
            <p className="px-4 py-1.5 text-[11px] font-semibold text-gray-400 uppercase tracking-widest">Audio</p>
            {audioOptions.map(a => (
              <button key={a.index} type="button" onClick={() => onAudio(a.index)}
                className={`w-full text-left px-4 py-3 text-sm hover:bg-white/10 flex items-center justify-between ${activeAudio === a.index ? 'text-accent-glow bg-white/5' : 'text-white/90'}`}>
                <span>{a.label}</span>
                {activeAudio === a.index && <span className="text-accent-glow text-xs font-bold">●</span>}
              </button>
            ))}
          </div>
          <div className="py-2">
            <p className="px-4 py-1.5 text-[11px] font-semibold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
              <Subtitles size={12} /> Subtítulos
            </p>
            <button type="button" onClick={() => onSub(-1)}
              className={`w-full text-left px-4 py-3 text-sm hover:bg-white/10 flex items-center justify-between ${activeSub === -1 ? 'text-accent-glow bg-white/5' : 'text-white/90'}`}>
              <span>Desactivados</span>
              {activeSub === -1 && <span className="text-accent-glow text-xs font-bold">●</span>}
            </button>
            {subtitleOptions.map(t => (
              <button key={t.index} type="button" onClick={() => onSub(t.index)}
                className={`w-full text-left px-4 py-3 text-sm hover:bg-white/10 flex items-center justify-between ${activeSub === t.index ? 'text-accent-glow bg-white/5' : 'text-white/90'}`}>
                <span>{t.label}</span>
                {activeSub === t.index && <span className="text-accent-glow text-xs font-bold">●</span>}
              </button>
            ))}
            {subtitleOptions.length === 0 && <p className="px-4 py-2 text-xs text-gray-500">Sin subtítulos</p>}
          </div>
        </div>
      </div>
    </>
  );
}

export default function VideoPlayer({
  src, compatSrc, compatAudioSrc, title, subtitles = [], probeAudioTracks = [], onBack, poster,
  knownDuration = null, needsAudioCompat = false, preferredAudioIndex = 0,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>();
  const audioSeekTimer = useRef<ReturnType<typeof setTimeout>>();
  const subsInit = useRef(false);
  const cuesCache = useRef(new Map<number, VttCue[]>());
  const timeRef = useRef(0);
  const playbackRef = useRef<Playback | null>(null);
  const cuesRef = useRef<VttCue[]>([]);
  const activeSubRef = useRef(-1);
  const streamGenRef = useRef(0);
  const audioAnchorRef = useRef(0);
  const audioReloadingRef = useRef(false);
  const resumeAfterAudioReloadRef = useRef(false);
  const seekingRef = useRef(false);
  const directAudioCheckRef = useRef<ReturnType<typeof setTimeout>>();
  const directAudioFallbackRef = useRef(false);

  const [playback, setPlayback] = useState<Playback>(() =>
    initialPlayback(src, compatSrc, compatAudioSrc, needsAudioCompat, preferredAudioIndex),
  );
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(knownDuration ?? 0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(() => {
    const v = parseFloat(localStorage.getItem('eyedpelis_volume') || '1');
    return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 1;
  });
  const [muted, setMuted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [buffering, setBuffering] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [activeSub, setActiveSub] = useState(-1);
  const [subtitleCues, setSubtitleCues] = useState<VttCue[]>([]);
  const [activeCue, setActiveCue] = useState<string | null>(null);
  const [loadingSubs, setLoadingSubs] = useState(false);
  const [subError, setSubError] = useState<string | null>(null);
  const tvMode = isTv();

  const isSplit = playback.engine === 'split';
  const isTranscode = playback.engine === 'transcode';
  const videoSrc = isTranscode ? playback.muxSrc! : playback.videoSrc;

  const audioOptions = useMemo(() =>
    probeAudioTracks.map(t => ({
      index: t.index,
      label: t.codecLabel ? `${langLabel(t.language)} · ${t.codecLabel}` : langLabel(t.language),
      language: t.language,
    })),
  [probeAudioTracks]);

  const subtitleOptions = subtitles.map(s => ({ index: s.index, label: s.label }));
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufPct = duration > 0 ? (buffered / duration) * 100 : 0;

  const syncAudioElement = useCallback((force = false) => {
    const v = videoRef.current;
    const a = audioRef.current;
    if (!v || !a || playbackRef.current?.engine !== 'split') return;
    const target = Math.max(0, v.currentTime - audioAnchorRef.current);
    if (force || Math.abs(a.currentTime - target) > 0.12) {
      try { a.currentTime = target; } catch { /* ignore */ }
    }
    if (!v.paused && a.paused && !audioReloadingRef.current) tryPlay(a);
  }, []);

  const reloadAudio = useCallback((atSec: number, audioIndex: number, resume = false) => {
    if (!compatAudioSrc) return;
    const v = videoRef.current;
    if (v && !v.paused) resume = true;
    if (v) v.pause();

    streamGenRef.current += 1;
    audioAnchorRef.current = atSec;
    audioReloadingRef.current = true;
    resumeAfterAudioReloadRef.current = resume;
    seekingRef.current = true;
    setBuffering(true);

    const audioSrc = buildStreamUrl(compatAudioSrc, audioIndex, atSec, streamGenRef.current);
    setPlayback(p => {
      const next = { ...p, engine: 'split' as const, videoSrc: src, audioSrc, audioIndex, offset: 0 };
      playbackRef.current = next;
      return next;
    });
  }, [compatAudioSrc, src]);

  const goTranscode = useCallback((audioIndex: number, atSec: number) => {
    if (!compatSrc) return;
    const v = videoRef.current;
    const wasPlaying = v ? !v.paused : false;
    if (v) v.pause();

    streamGenRef.current += 1;
    seekingRef.current = true;
    setBuffering(true);
    setError(null);
    resumeAfterAudioReloadRef.current = wasPlaying;
    const next: Playback = {
      engine: 'transcode',
      videoSrc: src,
      muxSrc: buildStreamUrl(compatSrc, audioIndex, atSec, streamGenRef.current),
      audioIndex,
      offset: atSec,
    };
    playbackRef.current = next;
    setPlayback(next);
    setCurrentTime(atSec);
    timeRef.current = atSec;
  }, [compatSrc, src]);

  const seekTo = useCallback((time: number) => {
    const t = Math.max(0, Math.min(time, duration || time));
    const v = videoRef.current;
    if (!v) return;

    timeRef.current = t;
    setCurrentTime(t);
    setActiveCue(null);

    if (isTranscode && compatSrc) {
      if (audioSeekTimer.current) clearTimeout(audioSeekTimer.current);
      audioSeekTimer.current = setTimeout(() => goTranscode(playback.audioIndex, t), 200);
      return;
    }

    if (isSplit && compatAudioSrc) {
      seekingRef.current = true;
      const wasPlaying = !v.paused;
      v.pause();
      try { v.currentTime = t; } catch { /* ignore */ }
      audioAnchorRef.current = t;
      if (audioSeekTimer.current) clearTimeout(audioSeekTimer.current);
      audioSeekTimer.current = setTimeout(() => reloadAudio(t, playback.audioIndex, wasPlaying), 150);
      return;
    }

    try { v.currentTime = t; } catch { /* ignore */ }
  }, [duration, isTranscode, isSplit, compatSrc, compatAudioSrc, playback.audioIndex, goTranscode, reloadAudio]);

  const loadSubs = useCallback(async (idx: number) => {
    const sub = subtitles.find(s => s.index === idx);
    if (!sub) { setSubtitleCues([]); cuesRef.current = []; return; }

    if (cuesCache.current.has(idx)) {
      const cached = cuesCache.current.get(idx)!;
      setSubtitleCues(cached);
      cuesRef.current = cached;
      setSubError(cached.length === 0 ? 'Sin diálogos en esta pista' : null);
      return;
    }

    setLoadingSubs(true);
    setSubError(null);
    try {
      const token = getAuthToken();
      const res = await fetch(sub.src, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      if (!text.includes('-->')) throw new Error('formato inválido');
      const cues = parseVtt(text);
      cuesCache.current.set(idx, cues);
      setSubtitleCues(cues);
      cuesRef.current = cues;
      if (cues.length === 0) setSubError('No se pudieron leer los subtítulos');
    } catch {
      setSubtitleCues([]);
      cuesRef.current = [];
      setSubError('Error al cargar subtítulos');
    } finally {
      setLoadingSubs(false);
    }
  }, [subtitles]);

  const selectSub = (idx: number) => {
    activeSubRef.current = idx;
    setActiveSub(idx);
    if (idx === -1) {
      setSubtitleCues([]);
      cuesRef.current = [];
      setActiveCue(null);
      setSubError(null);
      localStorage.setItem('eyedpelis_prefer_subs', 'off');
    } else {
      localStorage.setItem('eyedpelis_prefer_subs', 'on');
    }
    setShowLangMenu(false);
  };

  const selectAudio = (idx: number) => {
    if (idx === playback.audioIndex) { setShowLangMenu(false); return; }
    const t = timeRef.current;
    if (compatAudioSrc) {
      reloadAudio(t, idx, playing);
    } else if (compatSrc) {
      goTranscode(idx, t);
    }
    setShowLangMenu(false);
  };

  const reveal = useCallback(() => {
    setShowControls(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (playing) hideTimer.current = setTimeout(() => setShowControls(false), 4000);
  }, [playing]);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    const a = audioRef.current;
    if (!v) return;
    const split = playbackRef.current?.engine === 'split';
    if (v.paused) {
      tryPlay(v);
      if (a && split) {
        syncAudioElement();
        tryPlay(a);
      }
    } else {
      v.pause();
      a?.pause();
    }
  }, [syncAudioElement]);

  const toggleMute = useCallback(() => {
    setMuted(m => !m);
  }, []);

  const changeVol = (val: number) => {
    const c = Math.max(0, Math.min(1, val));
    setVolume(c);
    setMuted(c === 0);
    localStorage.setItem('eyedpelis_volume', String(c));
  };

  const toggleFs = useCallback(async () => {
    const el = containerRef.current;
    if (!el) return;
    try {
      document.fullscreenElement ? await document.exitFullscreen() : await el.requestFullscreen();
    } catch { /* ignore */ }
  }, []);

  const btn = `rounded-xl hover:bg-white/15 active:bg-white/20 transition-all hover:scale-105 active:scale-95 focus-visible:outline-none ${
    tvMode ? 'p-3.5 min-h-[48px] min-w-[48px] flex items-center justify-center' : 'p-2.5'
  }`;

  useEffect(() => {
    subsInit.current = false;
    cuesCache.current.clear();
    streamGenRef.current = 0;
    audioAnchorRef.current = 0;
    activeSubRef.current = -1;
    setActiveSub(-1);
    setSubtitleCues([]);
    cuesRef.current = [];
    setActiveCue(null);
    setSubError(null);
    setError(null);
    const pb = initialPlayback(src, compatSrc, compatAudioSrc, needsAudioCompat, preferredAudioIndex);
    playbackRef.current = pb;
    setPlayback(pb);
    if (knownDuration) setDuration(knownDuration);
  }, [src, compatSrc, compatAudioSrc, needsAudioCompat, preferredAudioIndex, knownDuration]);

  useEffect(() => {
    if (activeSub >= 0) loadSubs(activeSub);
  }, [activeSub, loadSubs]);

  useEffect(() => {
    if (subsInit.current || subtitles.length === 0) return;
    subsInit.current = true;
    if (localStorage.getItem('eyedpelis_prefer_subs') === 'off') return;
    const es = subtitles.find(s => {
      const l = (s.language || '').toLowerCase();
      return l.startsWith('es') || l === 'spa';
    });
    if (es) selectSub(es.index);
  }, [subtitles]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const v = videoRef.current;
      const idx = activeSubRef.current;
      const cues = cuesRef.current;
      const pb = playbackRef.current;
      if (v && idx >= 0 && cues.length > 0 && pb) {
        const t = pb.engine === 'transcode'
          ? pb.offset + v.currentTime
          : timeRef.current;
        setActiveCue(findActiveCue(cues, t)?.text ?? null);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => { playbackRef.current = playback; }, [playback]);
  useEffect(() => { activeSubRef.current = activeSub; }, [activeSub]);
  useEffect(() => { cuesRef.current = subtitleCues; }, [subtitleCues]);

  useEffect(() => {
    const v = videoRef.current;
    const a = audioRef.current;
    if (v) {
      v.playbackRate = playbackRate;
      // Solo silenciar el vídeo en modo split (audio va en <audio> aparte)
      if (isSplit) {
        v.muted = true;
        v.volume = 0;
      } else {
        v.volume = volume;
        v.muted = muted;
      }
    }
    if (a) {
      a.volume = volume;
      a.muted = muted;
      a.playbackRate = playbackRate;
    }
  }, [volume, playbackRate, muted, isSplit]);

  useEffect(() => {
    if (!isSplit) return;
    const id = window.setInterval(() => syncAudioElement(), 250);
    return () => clearInterval(id);
  }, [isSplit, syncAudioElement, playback.audioSrc]);

  useEffect(() => {
    if (!tvMode) return;
    const el = containerRef.current;
    if (el && !document.fullscreenElement) {
      el.requestFullscreen().catch(() => {});
    }
  }, [tvMode]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      switch (e.key) {
        case ' ':
        case 'k':
        case 'MediaPlayPause':
        case 'Play':
        case 'Pause':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          seekTo(currentTime - 10);
          break;
        case 'ArrowRight':
          e.preventDefault();
          seekTo(currentTime + 10);
          break;
        case 'ArrowUp':
          e.preventDefault();
          changeVol(volume + 0.1);
          break;
        case 'ArrowDown':
          e.preventDefault();
          changeVol(volume - 0.1);
          break;
        case 'f':
          e.preventDefault();
          toggleFs();
          break;
        case 'm':
          e.preventDefault();
          toggleMute();
          break;
        case 'c':
          e.preventDefault();
          setShowLangMenu(s => !s);
          break;
        case 'Escape':
        case 'Backspace':
        case 'BrowserBack':
          if (showLangMenu) {
            setShowLangMenu(false);
            break;
          }
          if (showSettings) {
            setShowSettings(false);
            break;
          }
          if (tvMode) {
            e.preventDefault();
            onBack();
          }
          break;
      }
      reveal();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [togglePlay, seekTo, currentTime, volume, toggleFs, toggleMute, reveal, tvMode, onBack, showLangMenu, showSettings]);

  useEffect(() => {
    const onFs = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  useEffect(() => () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (audioSeekTimer.current) clearTimeout(audioSeekTimer.current);
    if (directAudioCheckRef.current) clearTimeout(directAudioCheckRef.current);
  }, []);

  // Si el vídeo arranca pero el navegador no decodifica audio (AC3/DTS en MKV), pasar a transcode
  useEffect(() => {
    if (directAudioCheckRef.current) clearTimeout(directAudioCheckRef.current);
    directAudioFallbackRef.current = false;

    if (playback.engine !== 'direct' || !compatSrc) return;

    directAudioCheckRef.current = setTimeout(() => {
      const v = videoRef.current;
      if (!v || playbackRef.current?.engine !== 'direct' || directAudioFallbackRef.current) return;
      if (v.paused || v.muted) return;

      const decoded = (v as HTMLVideoElement & { webkitAudioDecodedByteCount?: number }).webkitAudioDecodedByteCount;
      const noAudioDecoded = typeof decoded === 'number' && decoded === 0 && v.currentTime > 1;
      if (noAudioDecoded) {
        directAudioFallbackRef.current = true;
        const t = timeRef.current;
        const resume = !v.paused;
        if (compatAudioSrc) {
          reloadAudio(t, playback.audioIndex, resume);
        } else if (compatSrc) {
          goTranscode(playback.audioIndex, t);
        }
      }
    }, 2500);

    return () => {
      if (directAudioCheckRef.current) clearTimeout(directAudioCheckRef.current);
    };
  }, [playback.engine, playback.audioIndex, compatSrc, compatAudioSrc, goTranscode, reloadAudio, videoSrc]);

  return (
    <div ref={containerRef} className="relative w-full h-screen bg-black overflow-hidden select-none"
      onMouseMove={reveal} onMouseLeave={() => playing && setShowControls(false)}
      onClick={e => { if (!(e.target as HTMLElement).closest('[data-controls]')) { togglePlay(); reveal(); } }}>

      <video
        key={isTranscode ? playback.muxSrc : 'direct-video'}
        ref={videoRef}
        src={videoSrc}
        poster={poster}
        className="w-full h-full object-contain"
        playsInline
        autoPlay={!isSplit}
        muted={isSplit || muted}
        onPlay={() => {
          setPlaying(true);
          if (!audioReloadingRef.current) setBuffering(false);
          syncAudioElement();
          if (isSplit && audioRef.current) tryPlay(audioRef.current);
        }}
        onPause={() => { setPlaying(false); setShowControls(true); audioRef.current?.pause(); }}
        onWaiting={() => { if (!audioReloadingRef.current) setBuffering(true); }}
        onCanPlay={() => {
          setBuffering(false);
          seekingRef.current = false;
          const v = videoRef.current;
          if (!v) return;
          if (isTranscode && resumeAfterAudioReloadRef.current) {
            resumeAfterAudioReloadRef.current = false;
            tryPlay(v);
          } else if (!isSplit) {
            tryPlay(v);
          }
        }}
        onTimeUpdate={() => {
          const v = videoRef.current;
          if (!v || seekingRef.current) return;
          const pb = playbackRef.current;
          const abs = pb?.engine === 'transcode' ? pb.offset + v.currentTime : v.currentTime;
          timeRef.current = abs;
          setCurrentTime(abs);
          if (v.buffered.length > 0) {
            const end = v.buffered.end(v.buffered.length - 1);
            setBuffered(pb?.engine === 'transcode' ? pb.offset + end : end);
          }
          if (knownDuration && knownDuration > 0) setDuration(knownDuration);
        }}
        onLoadedMetadata={() => {
          if (knownDuration && knownDuration > 0) setDuration(knownDuration);
          else if (videoRef.current) setDuration(videoRef.current.duration || 0);
        }}
        onError={() => {
          const pb = playbackRef.current;
          if (pb?.engine === 'split' && compatSrc) {
            goTranscode(pb.audioIndex, timeRef.current);
            return;
          }
          if (pb?.engine === 'direct' && compatSrc) {
            goTranscode(pb.audioIndex, timeRef.current);
            return;
          }
          if (pb?.engine === 'direct' && compatAudioSrc && needsAudioCompat) {
            reloadAudio(timeRef.current, pb.audioIndex);
            return;
          }
          setError('No se pudo reproducir el video.');
        }}
      />

      {isSplit && playback.audioSrc && (
        <audio
          key={playback.audioSrc}
          ref={audioRef}
          src={playback.audioSrc}
          className="hidden"
          onCanPlay={() => {
            audioReloadingRef.current = false;
            seekingRef.current = false;
            setBuffering(false);
            syncAudioElement(true);
            const v = videoRef.current;
            const a = audioRef.current;
            if (!v || !a) return;
            if (resumeAfterAudioReloadRef.current) {
              resumeAfterAudioReloadRef.current = false;
              tryPlay(v);
              tryPlay(a);
            } else if (!v.paused) {
              tryPlay(a);
            }
          }}
          onTimeUpdate={() => syncAudioElement()}
          onPlaying={() => { audioReloadingRef.current = false; }}
          onError={() => {
            audioReloadingRef.current = false;
            const pb = playbackRef.current;
            if (pb && compatSrc) goTranscode(pb.audioIndex, timeRef.current);
          }}
        />
      )}

      {activeCue && (
        <div className="absolute bottom-28 md:bottom-32 left-0 right-0 z-[25] flex justify-center px-4 pointer-events-none">
          <p className="tv-subtitle text-center text-white text-base md:text-xl font-medium leading-relaxed max-w-4xl bg-black/85 px-4 py-2.5 rounded-xl shadow-2xl whitespace-pre-line border border-white/10">
            {activeCue}
          </p>
        </div>
      )}
      {loadingSubs && activeSub >= 0 && !activeCue && (
        <div className="absolute bottom-28 left-1/2 -translate-x-1/2 z-[25] text-xs text-white/50">Cargando subtítulos…</div>
      )}
      {subError && activeSub >= 0 && !loadingSubs && (
        <div className="absolute bottom-28 left-1/2 -translate-x-1/2 z-[25] text-xs text-amber-400 bg-black/70 px-3 py-1 rounded-lg">{subError}</div>
      )}

      {buffering && !error && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-black/40 backdrop-blur-sm rounded-full p-4">
            <Loader2 size={44} className="text-white animate-spin" />
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/90 z-30">
          <p className="text-red-400">{error}</p>
          <button type="button" onClick={onBack} className="btn-secondary">Volver</button>
        </div>
      )}

      <div className={`absolute inset-0 pointer-events-none transition-opacity duration-500 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
        <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/90 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black via-black/80 to-transparent" />
      </div>

      <div data-controls className={`absolute top-0 inset-x-0 z-20 flex items-center gap-3 px-5 md:px-8 py-5 transition-all duration-500 ${showControls ? 'opacity-100' : 'opacity-0 -translate-y-4 pointer-events-none'}`}>
        <button type="button" onClick={e => { e.stopPropagation(); onBack(); }} className={`${btn} bg-black/30 backdrop-blur-sm`} aria-label="Volver">
          <ArrowLeft size={22} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base md:text-xl font-bold truncate">{title}</h1>
        </div>
      </div>

      {!playing && !buffering && !error && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-black/50 backdrop-blur-md rounded-full p-6 ring-1 ring-white/20">
            <Play size={44} fill="white" className="text-white ml-1" />
          </div>
        </div>
      )}

      <div data-controls className={`absolute bottom-0 inset-x-0 z-20 transition-all duration-500 ${showControls ? 'opacity-100' : 'opacity-0 translate-y-6 pointer-events-none'}`} onClick={e => e.stopPropagation()}>
        <div className="px-4 md:px-8 pb-6 pt-2">
          <div ref={progressRef} className="group relative h-1 mb-5 cursor-pointer rounded-full bg-white/15 hover:h-1.5 transition-all"
            onClick={e => {
              const bar = progressRef.current;
              if (!bar || !duration) return;
              const r = (e.clientX - bar.getBoundingClientRect().left) / bar.clientWidth;
              seekTo(Math.max(0, Math.min(1, r)) * duration);
            }}>
            <div className="absolute inset-y-0 left-0 bg-white/25 rounded-full" style={{ width: `${bufPct}%` }} />
            <div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-accent to-accent-glow" style={{ width: `${progress}%` }} />
            <div className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 -ml-2 transition-opacity" style={{ left: `${progress}%` }} />
          </div>

          <div className="flex items-center gap-2 md:gap-4 bg-black/40 backdrop-blur-md rounded-2xl px-3 py-2 md:px-4 border border-white/10">
            <div className="flex items-center">
              <button type="button" onClick={() => seekTo(currentTime - 10)} className={`${btn} hidden sm:flex`}><SkipBack size={20} /></button>
              <button type="button" onClick={togglePlay} className={`${btn} mx-0.5`}>
                {playing ? <Pause size={24} fill="white" /> : <Play size={24} fill="white" />}
              </button>
              <button type="button" onClick={() => seekTo(currentTime + 10)} className={`${btn} hidden sm:flex`}><SkipForward size={20} /></button>
            </div>

            <span className="text-xs md:text-sm text-white/80 tabular-nums min-w-[88px]">
              {formatTime(currentTime)}<span className="text-white/40 mx-1">/</span>{formatTime(duration)}
            </span>

            <div className="flex-1" />

            <div className="relative">
              <button type="button" onClick={() => { setShowLangMenu(s => !s); setShowSettings(false); }}
                className={`${btn} flex items-center gap-2 ${(activeSub >= 0 || audioOptions.length > 1) ? 'text-accent-glow bg-accent/10 ring-1 ring-accent/30' : ''}`}>
                <Languages size={20} />
                <span className="hidden md:inline text-xs font-medium">Audio</span>
              </button>
              <TrackMenu open={showLangMenu} onClose={() => setShowLangMenu(false)}
                audioOptions={audioOptions} subtitleOptions={subtitleOptions}
                activeAudio={playback.audioIndex} activeSub={activeSub}
                onAudio={selectAudio} onSub={selectSub} />
            </div>

            {subtitleOptions.length > 0 && (
              <button type="button" onClick={() => activeSub >= 0 ? selectSub(-1) : selectSub(subtitleOptions[0].index)}
                className={`${btn} ${activeSub >= 0 ? 'text-accent-glow bg-accent/10 ring-1 ring-accent/30' : ''}`}>
                <Subtitles size={20} />
              </button>
            )}

            <div className="flex items-center gap-1 group/vol">
              <button type="button" onClick={toggleMute} className={btn}>
                {muted || volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
              </button>
              <input type="range" min={0} max={1} step={0.05} value={muted ? 0 : volume}
                onChange={e => changeVol(parseFloat(e.target.value))}
                className="w-0 group-hover/vol:w-24 transition-all accent-accent hidden md:block h-1 cursor-pointer" />
            </div>

            <div className="relative">
              <button type="button" onClick={() => { setShowSettings(s => !s); setShowLangMenu(false); }} className={btn}>
                <Settings size={20} />
              </button>
              {showSettings && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowSettings(false)} />
                  <div className="absolute right-0 bottom-full mb-3 z-50 bg-black/95 border border-white/10 rounded-xl py-2 min-w-[150px] shadow-2xl">
                    <p className="px-4 py-1.5 text-[11px] font-semibold text-gray-400 uppercase">Velocidad</p>
                    {[0.5, 0.75, 1, 1.25, 1.5, 2].map(r => (
                      <button key={r} type="button" onClick={() => { setPlaybackRate(r); setShowSettings(false); }}
                        className={`w-full text-left px-4 py-2.5 text-sm hover:bg-white/10 ${playbackRate === r ? 'text-accent-glow font-medium' : ''}`}>
                        {r === 1 ? 'Normal' : `${r}x`}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <button type="button" onClick={toggleFs} className={btn}>
              {fullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
