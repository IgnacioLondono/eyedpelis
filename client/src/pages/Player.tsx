import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, posterUrl } from '../api';
import VideoPlayer from '../components/VideoPlayer';
import type { MediaItem, SubtitleTrack } from '../types';

export default function Player() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [media, setMedia] = useState<MediaItem | null>(null);
  const [subtitleTracks, setSubtitleTracks] = useState<SubtitleTrack[]>([]);
  const [episodeTitle, setEpisodeTitle] = useState<string | null>(null);
  const [preferredAudioIndex, setPreferredAudioIndex] = useState(0);
  const [knownDuration, setKnownDuration] = useState<number | null>(null);
  const [needsAudioCompat, setNeedsAudioCompat] = useState(false);
  const [probeAudioTracks, setProbeAudioTracks] = useState<Array<{
    index: number; codec: string; codecLabel: string; language: string;
  }>>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!id) return;
    const numId = parseInt(id);

    Promise.all([
      api.getMedia(numId),
      api.getStreamInfo(numId).catch(() => null),
    ]).then(async ([item, streamInfo]) => {
      setMedia(item);

      const subs = streamInfo?.subtitles?.length
        ? streamInfo.subtitles as SubtitleTrack[]
        : (item.subtitles || []);
      setSubtitleTracks(subs);

      if (streamInfo?.probe) {
        setProbeAudioTracks(streamInfo.probe.audioTracks);
        setPreferredAudioIndex(streamInfo.probe.recommendedAudioIndex);
        setKnownDuration(streamInfo.probe.duration ?? null);
        setNeedsAudioCompat(streamInfo.probe.needsCompatAudio ?? !streamInfo.probe.browserFriendlyAudio);
      } else {
        // Sin probe: asumir que puede necesitar transcode (códecs AC3/DTS frecuentes)
        setNeedsAudioCompat(true);
      }

      if (item.series_id && item.season != null && item.episode != null) {
        try {
          const parent = await api.getMedia(item.series_id);
          const seriesTmdbId = parent?.tmdb_id;
          if (seriesTmdbId) {
            const season = await api.getSeasonDetails(seriesTmdbId, item.season);
            const ep = season.episodes.find(e => e.episode_number === item.episode);
            if (ep?.name) setEpisodeTitle(ep.name);
          }
        } catch { /* usar título local */ }
      }

      setReady(true);
    }).catch(console.error);
  }, [id]);

  if (!media || !ready) {
    return (
      <div className="flex items-center justify-center h-screen bg-black">
        <div className="animate-pulse text-gray-400">Cargando reproductor...</div>
      </div>
    );
  }

  let title = media.title;
  if (media.season != null && media.episode != null) {
    const epLabel = episodeTitle
      ? ` — ${episodeTitle}`
      : '';
    title = `${media.title} · T${String(media.season).padStart(2, '0')}E${String(media.episode).padStart(2, '0')}${epLabel}`;
  }

  const subtitles = subtitleTracks.map((sub, index) => ({
    index,
    label: sub.label,
    src: api.subtitleUrl(media.id, index),
    language: sub.language,
  }));

  return (
    <VideoPlayer
      src={api.streamUrl(media.id)}
      compatSrc={api.compatStreamUrl(media.id)}
      compatAudioSrc={api.compatAudioUrl(media.id)}
      title={title}
      poster={posterUrl(media.poster_path ?? null)}
      subtitles={subtitles}
      probeAudioTracks={probeAudioTracks}
      knownDuration={knownDuration}
      needsAudioCompat={needsAudioCompat}
      preferredAudioIndex={preferredAudioIndex}
      onBack={() => navigate(-1)}
    />
  );
}
