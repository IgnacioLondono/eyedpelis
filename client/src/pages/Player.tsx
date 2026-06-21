import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, posterUrl } from '../api';
import VideoPlayer from '../components/VideoPlayer';
import type { MediaItem } from '../types';

export default function Player() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [media, setMedia] = useState<MediaItem | null>(null);
  const [episodeTitle, setEpisodeTitle] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    api.getMedia(parseInt(id)).then(async (item) => {
      setMedia(item);

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
    }).catch(console.error);
  }, [id]);

  if (!media) {
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

  const subtitles = (media.subtitles || []).map((sub, index) => ({
    index,
    label: sub.label,
    src: api.subtitleUrl(media.id, index),
    language: sub.language,
  }));

  return (
    <VideoPlayer
      src={api.streamUrl(media.id)}
      title={title}
      poster={posterUrl(media.poster_path ?? null)}
      subtitles={subtitles}
      onBack={() => navigate(-1)}
    />
  );
}
