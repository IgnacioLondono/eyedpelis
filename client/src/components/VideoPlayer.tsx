import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, Play, Pause, Volume2, VolumeX, Maximize, Minimize,
  Subtitles, Loader2, SkipBack, SkipForward, Settings, Languages,
} from 'lucide-react';
import { findActiveCue, parseVtt, type VttCue } from '../utils/vttParser';
import { getAuthToken } from '../api';
import { usePlatform } from '../context/PlatformContext';
import { tvFocusClass } from './android/focus';
import PlayerTrackMenu from './player/PlayerTrackMenu';
import PlayerSettingsMenu from './player/PlayerSettingsMenu';

interface SubtitleOption {
  index: number;
  label: string;
  src: string;
  language: string;
  bitmap?: boolean;
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

export default function VideoPlayer({
  src, compatSrc, compatAudioSrc, title, subtitles = [], probeAudioTracks = [], onBack, poster,
  knownDuration = null, needsAudioCompat = false, preferredAudioIndex = 0,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const playBtnRef = useRef<HTMLButtonElement>(null);
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
  const { isAndroidMobile, isAndroidTv } = usePlatform();
  const tvMode = isAndroidTv;
  const mobileMode = isAndroidMobile;
  const playerVariant = tvMode ? 'tv' as const : mobileMode ? 'mobile' as const : 'web' as const;
  const hideDelay = tvMode ? 8000 : mobileMode ? 5000 : 4000;

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
    if (sub.bitmap) {
      setSubError('Subtítulo de imagen: añade un .srt junto al vídeo');
      return;
    }

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
      const res = await fetch(sub.src, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        signal: AbortSignal.timeout(90000),
      });
      const text = await res.text();
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const err = JSON.parse(text) as { error?: string };
          if (err.error) msg = err.error;
        } catch { /* no JSON */ }
        throw new Error(msg);
      }
      const cues = parseVtt(text);
      if (cues.length === 0) {
        throw new Error('No se pudieron leer los subtítulos (formato vacío o no compatible)');
      }
      cuesCache.current.set(idx, cues);
      setSubtitleCues(cues);
      cuesRef.current = cues;
      setSubError(null);
    } catch (err) {
      setSubtitleCues([]);
      cuesRef.current = [];
      setSubError(err instanceof Error ? err.message : 'Error al cargar subtítulos');
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
    if (playing) hideTimer.current = setTimeout(() => setShowControls(false), hideDelay);
  }, [playing, hideDelay]);

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
    if (tvMode || mobileMode) return;
    const el = containerRef.current;
    if (!el) return;
    try {
      document.fullscreenElement ? await document.exitFullscreen() : await el.requestFullscreen();
    } catch { /* ignore */ }
  }, [tvMode, mobileMode]);

  const seekFromPointer = useCallback((clientX: number) => {
    const bar = progressRef.current;
    if (!bar || !duration) return;
    const rect = bar.getBoundingClientRect();
    const pct = (clientX - rect.left) / rect.width;
    seekTo(Math.max(0, Math.min(1, pct)) * duration);
  }, [duration, seekTo]);

  const btn = `rounded-xl hover:bg-white/15 active:bg-white/20 transition-all hover:scale-105 active:scale-95 focus-visible:outline-none ${
    tvMode
      ? `p-4 min-h-[56px] min-w-[56px] flex items-center justify-center ${tvFocusClass}`
      : mobileMode
        ? 'p-3 min-h-[48px] min-w-[48px] flex items-center justify-center'
        : 'p-2.5'
  }`;

  const iconSize = tvMode ? 28 : mobileMode ? 26 : 24;
  const skipIcon = tvMode ? 26 : 20;

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
  }, [src, needsAudioCompat, preferredAudioIndex, knownDuration]);

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
    const pick = es || subtitles[0];
    if (pick) selectSub(pick.index);
  }, [subtitles]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const v = videoRef.current;
      const idx = activeSubRef.current;
      const cues = cuesRef.current;
      const pb = playbackRef.current;
      if (v && idx >= 0 && cues.length > 0 && pb) {
        let t: number;
        if (pb.engine === 'transcode') {
          t = pb.offset + v.currentTime;
        } else if (pb.engine === 'split') {
          const a = audioRef.current;
          t = a && a.currentTime > 0 ? pb.offset + a.currentTime : timeRef.current;
        } else {
          t = timeRef.current;
        }
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
    const t = window.setTimeout(() => playBtnRef.current?.focus(), 400);
    return () => clearTimeout(t);
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
          seekTo(currentTime - (tvMode ? 30 : 10));
          break;
        case 'ArrowRight':
          e.preventDefault();
          seekTo(currentTime + (tvMode ? 30 : 10));
          break;
        case 'MediaFastForward':
        case 'MediaTrackNext':
          e.preventDefault();
          seekTo(currentTime + 30);
          break;
        case 'MediaRewind':
        case 'MediaTrackPrevious':
          e.preventDefault();
          seekTo(currentTime - 30);
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
          setShowSettings(false);
          break;
        case 's':
          if (subtitleOptions.length > 0) {
            e.preventDefault();
            if (activeSubRef.current >= 0) selectSub(-1);
            else selectSub(subtitleOptions[0].index);
          }
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
  }, [togglePlay, seekTo, currentTime, volume, toggleFs, toggleMute, reveal, tvMode, onBack, showLangMenu, showSettings, subtitleOptions]);

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
    <div
      ref={containerRef}
      className={`player-shell relative w-full bg-black overflow-hidden select-none touch-none ${
        tvMode ? 'player-tv h-screen' : mobileMode ? 'player-mobile h-[100dvh]' : 'h-screen'
      }`}
      onMouseMove={reveal}
      onMouseLeave={() => playing && !tvMode && setShowControls(false)}
      onClick={e => {
        if ((e.target as HTMLElement).closest('[data-controls]')) return;
        if (showLangMenu || showSettings) return;
        togglePlay();
        reveal();
      }}
    >

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
        <div className={`absolute left-0 right-0 z-[25] flex justify-center px-4 pointer-events-none ${
          tvMode ? 'bottom-36' : mobileMode ? 'bottom-36' : 'bottom-28 md:bottom-32'
        }`}>
          <p className="player-subtitle-cue text-center text-white font-medium leading-relaxed max-w-5xl bg-black/85 px-5 py-3 rounded-xl shadow-2xl whitespace-pre-line border border-white/10">
            {activeCue}
          </p>
        </div>
      )}
      {loadingSubs && activeSub >= 0 && !activeCue && (
        <div className={`absolute left-1/2 -translate-x-1/2 z-[25] text-white/50 ${tvMode ? 'bottom-36 text-base' : 'bottom-28 text-xs'}`}>
          Cargando subtítulos…
        </div>
      )}
      {subError && activeSub >= 0 && !loadingSubs && (
        <div className={`absolute left-1/2 -translate-x-1/2 z-[25] text-amber-400 bg-black/70 px-4 py-2 rounded-lg ${tvMode ? 'bottom-36 text-sm' : 'bottom-28 text-xs'}`}>
          {subError}
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
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/90 z-30">
          <p className="text-red-400">{error}</p>
          <button type="button" onClick={onBack} className="btn-secondary">Volver</button>
        </div>
      )}

      <div className={`absolute inset-0 pointer-events-none transition-opacity duration-500 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
        <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/90 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black via-black/80 to-transparent" />
      </div>

      <div data-controls className={`absolute top-0 inset-x-0 z-20 flex items-center gap-3 transition-all duration-500 safe-top ${
        tvMode ? 'px-8 py-6' : mobileMode ? 'px-4 py-4' : 'px-5 md:px-8 py-5'
      } ${showControls ? 'opacity-100' : 'opacity-0 -translate-y-4 pointer-events-none'}`}>
        <button type="button" onClick={e => { e.stopPropagation(); onBack(); }} className={`${btn} bg-black/40 backdrop-blur-sm`} aria-label="Volver">
          <ArrowLeft size={tvMode ? 28 : 22} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className={`font-bold truncate ${tvMode ? 'text-2xl' : mobileMode ? 'text-base' : 'text-base md:text-xl'}`}>{title}</h1>
        </div>
      </div>

      {!playing && !buffering && !error && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className={`bg-black/50 backdrop-blur-md rounded-full ring-1 ring-white/20 ${tvMode ? 'p-8' : 'p-6'}`}>
            <Play size={tvMode ? 56 : 44} fill="white" className="text-white ml-1" />
          </div>
        </div>
      )}

      <PlayerTrackMenu
        open={showLangMenu}
        onClose={() => setShowLangMenu(false)}
        variant={playerVariant}
        audioOptions={audioOptions}
        subtitleOptions={subtitleOptions}
        activeAudio={playback.audioIndex}
        activeSub={activeSub}
        onAudio={selectAudio}
        onSub={selectSub}
      />

      <PlayerSettingsMenu
        open={showSettings}
        onClose={() => setShowSettings(false)}
        variant={playerVariant}
        playbackRate={playbackRate}
        onRate={setPlaybackRate}
      />

      <div data-controls className={`absolute bottom-0 inset-x-0 z-20 transition-all duration-500 safe-bottom ${
        showControls ? 'opacity-100' : 'opacity-0 translate-y-6 pointer-events-none'
      }`} onClick={e => e.stopPropagation()}>
        <div className={tvMode ? 'px-8 pb-8 pt-3' : mobileMode ? 'px-4 pb-6 pt-2' : 'px-4 md:px-8 pb-6 pt-2'}>
          <div
            ref={progressRef}
            className={`group relative mb-5 cursor-pointer rounded-full bg-white/15 transition-all ${
              tvMode || mobileMode ? 'h-2.5 hover:h-3' : 'h-1 hover:h-1.5'
            }`}
            onClick={e => seekFromPointer(e.clientX)}
            onTouchStart={e => { if (e.touches[0]) seekFromPointer(e.touches[0].clientX); }}
            onTouchMove={e => { e.preventDefault(); if (e.touches[0]) seekFromPointer(e.touches[0].clientX); }}
          >
            <div className="absolute inset-y-0 left-0 bg-white/25 rounded-full" style={{ width: `${bufPct}%` }} />
            <div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-accent to-accent-glow" style={{ width: `${progress}%` }} />
            <div
              className={`absolute top-1/2 -translate-y-1/2 bg-white rounded-full shadow-lg -ml-2 transition-opacity ${
                tvMode || mobileMode ? 'w-5 h-5 opacity-100' : 'w-4 h-4 opacity-0 group-hover:opacity-100'
              }`}
              style={{ left: `${progress}%` }}
            />
          </div>

          <div className={`flex items-center gap-2 bg-black/50 backdrop-blur-md rounded-2xl border border-white/10 ${
            tvMode ? 'px-4 py-3 gap-3' : mobileMode ? 'px-2 py-2' : 'px-3 py-2 md:px-4'
          }`}>
            <div className="flex items-center">
              <button type="button" onClick={() => seekTo(currentTime - (tvMode ? 30 : 10))} className={btn} aria-label="Retroceder">
                <SkipBack size={skipIcon} />
              </button>
              <button ref={playBtnRef} type="button" onClick={togglePlay} className={`${btn} mx-0.5`} aria-label={playing ? 'Pausar' : 'Reproducir'}>
                {playing ? <Pause size={iconSize} fill="white" /> : <Play size={iconSize} fill="white" />}
              </button>
              <button type="button" onClick={() => seekTo(currentTime + (tvMode ? 30 : 10))} className={btn} aria-label="Avanzar">
                <SkipForward size={skipIcon} />
              </button>
            </div>

            <span className={`text-white/80 tabular-nums shrink-0 ${tvMode ? 'text-base min-w-[110px]' : 'text-xs md:text-sm min-w-[88px]'}`}>
              {formatTime(currentTime)}<span className="text-white/40 mx-1">/</span>{formatTime(duration)}
            </span>

            <div className="flex-1" />

            {(audioOptions.length > 1 || subtitleOptions.length > 0) && (
              <button
                type="button"
                onClick={() => { setShowLangMenu(s => !s); setShowSettings(false); }}
                className={`${btn} flex items-center gap-2 ${(activeSub >= 0 || audioOptions.length > 1) ? 'text-accent-glow bg-accent/10 ring-1 ring-accent/30' : ''}`}
                aria-label="Audio y subtítulos"
              >
                <Languages size={tvMode ? 26 : 20} />
                {!mobileMode && !tvMode && <span className="hidden md:inline text-xs font-medium">Audio</span>}
              </button>
            )}

            {subtitleOptions.length > 0 && (
              <button
                type="button"
                onClick={() => activeSub >= 0 ? selectSub(-1) : selectSub(subtitleOptions[0].index)}
                className={`${btn} ${activeSub >= 0 ? 'text-accent-glow bg-accent/10 ring-1 ring-accent/30' : ''}`}
                aria-label="Subtítulos"
              >
                <Subtitles size={tvMode ? 26 : 20} />
              </button>
            )}

            {!tvMode && !mobileMode && (
              <div className="flex items-center gap-1 group/vol">
                <button type="button" onClick={toggleMute} className={btn}>
                  {muted || volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
                </button>
                <input type="range" min={0} max={1} step={0.05} value={muted ? 0 : volume}
                  onChange={e => changeVol(parseFloat(e.target.value))}
                  className="w-0 group-hover/vol:w-24 transition-all accent-accent hidden md:block h-1 cursor-pointer" />
              </div>
            )}

            <button
              type="button"
              onClick={() => { setShowSettings(s => !s); setShowLangMenu(false); }}
              className={btn}
              aria-label="Ajustes"
            >
              <Settings size={tvMode ? 26 : 20} />
            </button>

            {!tvMode && !mobileMode && (
              <button type="button" onClick={toggleFs} className={btn} aria-label="Pantalla completa">
                {fullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
              </button>
            )}
          </div>

          {tvMode && (
            <p className="text-center text-xs text-white/35 mt-3">
              ◀ ▶ ±30s · OK reproducir · C audio/subs · S subtítulos · Atrás salir
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
