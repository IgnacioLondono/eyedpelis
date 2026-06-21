import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api';
import MediaDetailView from '../components/MediaDetailView';
import type { MediaItem } from '../types';
import type { TmdbDetails } from '../utils/tmdbHelpers';

export default function Detail() {
  const { type, id } = useParams<{ type: string; id: string }>();
  const [tmdb, setTmdb] = useState<TmdbDetails | null>(null);
  const [inLibrary, setInLibrary] = useState<MediaItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!type || !id) return;
    const numId = parseInt(id);
    const mediaType = type as 'movie' | 'series';

    Promise.all([
      api.getDetails(type, numId),
      mediaType === 'movie' ? api.getMovies() : api.getSeries(),
    ]).then(([details, library]) => {
      setTmdb(details as unknown as TmdbDetails);

      const found = mediaType === 'movie'
        ? library.find((l: MediaItem) => l.tmdb_id === numId)
        : library.find((l: MediaItem) => l.tmdb_id === numId);

      setInLibrary(found || null);
    }).catch(console.error).finally(() => setLoading(false));
  }, [type, id]);

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-[50vh] shimmer-bg" />
        <div className="px-12 -mt-32 flex gap-8">
          <div className="w-56 h-80 rounded-xl shimmer-bg" />
          <div className="flex-1 space-y-4 pt-40">
            <div className="h-10 w-2/3 shimmer-bg rounded" />
            <div className="h-4 w-1/2 shimmer-bg rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (!tmdb) {
    return <div className="p-6 text-center text-gray-400">No encontrado</div>;
  }

  return (
    <MediaDetailView
      media={inLibrary}
      tmdb={tmdb}
      libraryId={inLibrary?.file_path ? inLibrary.id : undefined}
      type={type as 'movie' | 'series'}
      episodes={inLibrary?.episodes || []}
    />
  );
}
