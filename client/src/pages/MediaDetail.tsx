import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api';
import MediaDetailView from '../components/MediaDetailView';
import type { MediaItem } from '../types';
import type { TmdbDetails } from '../utils/tmdbHelpers';

export default function MediaDetail() {
  const { id } = useParams<{ id: string }>();
  const [media, setMedia] = useState<MediaItem | null>(null);
  const [tmdb, setTmdb] = useState<TmdbDetails | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const libraryId = parseInt(id);

    api.getMedia(libraryId).then(async (item) => {
      setMedia(item);

      if (item.tmdb_id) {
        try {
          const details = await api.getDetails(item.type, item.tmdb_id);
          setTmdb(details as unknown as TmdbDetails);
        } catch {
          // Mostrar datos locales si TMDB falla
        }
      }
    }).catch(console.error).finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-[50vh] shimmer-bg" />
        <div className="px-12 -mt-32 flex gap-8">
          <div className="w-56 h-80 rounded-xl shimmer-bg" />
          <div className="flex-1 space-y-4 pt-40">
            <div className="h-10 w-2/3 shimmer-bg rounded" />
            <div className="h-4 w-1/2 shimmer-bg rounded" />
            <div className="h-24 w-full shimmer-bg rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (!media) {
    return <div className="p-6 text-center text-gray-400 animate-fade-in">No encontrado</div>;
  }

  const isSeriesParent = media.type === 'series' && !media.file_path;

  return (
    <MediaDetailView
      media={media}
      tmdb={tmdb}
      libraryId={media.file_path ? media.id : undefined}
      type={isSeriesParent ? 'series' : 'movie'}
      episodes={media.episodes}
    />
  );
}
