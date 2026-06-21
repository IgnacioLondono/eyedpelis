import { useEffect, useState } from 'react';
import { Search as SearchIcon } from 'lucide-react';
import { api } from '../api';
import type { MediaItem } from '../types';
import MediaCard from '../components/MediaCard';

export default function Movies() {
  const [movies, setMovies] = useState<MediaItem[]>([]);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('title');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getMovies({ search: search || undefined, sort })
      .then(setMovies)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [search, sort]);

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <h1 className="text-3xl font-bold">Películas</h1>
        <div className="flex gap-3">
          <div className="relative">
            <SearchIcon size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              placeholder="Buscar en biblioteca..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-surface-card border border-surface-border rounded-lg pl-10 pr-4 py-2.5 text-sm w-64 focus:outline-none focus:border-accent"
            />
          </div>
          <select
            value={sort}
            onChange={e => setSort(e.target.value)}
            className="bg-surface-card border border-surface-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-accent"
          >
            <option value="title">Título A-Z</option>
            <option value="date">Fecha</option>
            <option value="rating">Valoración</option>
            <option value="recent">Recientes</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] rounded-xl shimmer-bg" />
          ))}
        </div>
      ) : movies.length === 0 ? (
        <p className="text-gray-400 text-center py-20">No hay películas en tu biblioteca.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {movies.map(m => <MediaCard key={m.id} item={m} libraryId={m.id} showPlay />)}
        </div>
      )}
    </div>
  );
}
