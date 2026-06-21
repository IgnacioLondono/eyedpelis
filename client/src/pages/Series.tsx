import { useEffect, useState } from 'react';
import { Search as SearchIcon } from 'lucide-react';
import { api } from '../api';
import type { MediaItem } from '../types';
import MediaCard from '../components/MediaCard';

export default function Series() {
  const [series, setSeries] = useState<MediaItem[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getSeries(search || undefined)
      .then(setSeries)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [search]);

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <h1 className="text-3xl font-bold">Series</h1>
        <div className="relative">
          <SearchIcon size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Buscar series..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-surface-card border border-surface-border rounded-lg pl-10 pr-4 py-2.5 text-sm w-64 focus:outline-none focus:border-accent"
          />
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] rounded-xl shimmer-bg" />
          ))}
        </div>
      ) : series.length === 0 ? (
        <p className="text-gray-400 text-center py-20">No hay series en tu biblioteca.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {series.map(s => <MediaCard key={s.id} item={s} libraryId={s.id} />)}
        </div>
      )}
    </div>
  );
}
