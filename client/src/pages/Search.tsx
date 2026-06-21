import { useState } from 'react';
import { Search as SearchIcon, Download, Film, Tv } from 'lucide-react';
import { api, posterUrl } from '../api';
import type { SearchResult } from '../types';

export default function Search() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'movie' | 'series'>('all');
  const [downloading, setDownloading] = useState<number | null>(null);
  const [showModal, setShowModal] = useState<SearchResult | null>(null);
  const [magnetUrl, setMagnetUrl] = useState('');
  const [directUrl, setDirectUrl] = useState('');

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    try {
      const data = await api.search(query);
      setResults(data);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error de búsqueda');
    } finally {
      setLoading(false);
    }
  }

  async function handleDownload(item: SearchResult) {
    if (!magnetUrl && !directUrl) {
      setShowModal(item);
      return;
    }
    setDownloading(item.id);
    try {
      await api.addDownload({
        tmdb_id: item.id,
        type: item.type,
        title: item.title,
        poster_path: item.poster_path,
        magnet_url: magnetUrl || undefined,
        direct_url: directUrl || undefined,
      });
      alert(`"${item.title}" añadido a la cola de descargas`);
      setShowModal(null);
      setMagnetUrl('');
      setDirectUrl('');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al descargar');
    } finally {
      setDownloading(null);
    }
  }

  const filtered = filter === 'all' ? results : results.filter(r => r.type === filter);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Buscar online</h1>

      <form onSubmit={handleSearch} className="flex gap-3 mb-6">
        <div className="relative flex-1">
          <SearchIcon size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Buscar películas y series en TMDB..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full bg-surface-card border border-surface-border rounded-xl pl-12 pr-4 py-3.5 text-base focus:outline-none focus:border-accent"
          />
        </div>
        <button type="submit" className="btn-primary px-8" disabled={loading}>
          {loading ? 'Buscando...' : 'Buscar'}
        </button>
      </form>

      {results.length > 0 && (
        <div className="flex gap-2 mb-6">
          {(['all', 'movie', 'series'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === f ? 'bg-accent text-white' : 'bg-surface-card text-gray-400 hover:text-white'
              }`}
            >
              {f === 'all' ? 'Todos' : f === 'movie' ? 'Películas' : 'Series'}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-4">
        {filtered.map(item => (
          <div key={`${item.type}-${item.id}`} className="flex gap-4 bg-surface-card border border-surface-border rounded-xl p-4 hover:border-accent/30 transition-colors">
            <img
              src={posterUrl(item.poster_path, 'w200')}
              alt={item.title}
              className="w-20 h-28 object-cover rounded-lg flex-shrink-0"
              onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder-poster.svg'; }}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                {item.type === 'movie' ? <Film size={16} className="text-purple-400" /> : <Tv size={16} className="text-violet-400" />}
                <span className="text-xs text-gray-500 uppercase">{item.type === 'movie' ? 'Película' : 'Serie'}</span>
                {item.release_date && <span className="text-xs text-gray-500">· {item.release_date.slice(0, 4)}</span>}
                {item.vote_average > 0 && <span className="text-xs text-yellow-400">★ {item.vote_average.toFixed(1)}</span>}
              </div>
              <h3 className="text-lg font-semibold truncate">{item.title}</h3>
              <p className="text-sm text-gray-400 line-clamp-2 mt-1">{item.overview}</p>
            </div>
            <button
              onClick={() => { setShowModal(item); setMagnetUrl(''); setDirectUrl(''); }}
              disabled={downloading === item.id}
              className="btn-primary flex items-center gap-2 self-center flex-shrink-0"
            >
              <Download size={18} />
              Descargar
            </button>
          </div>
        ))}
      </div>

      {/* Modal de descarga */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 animate-fade-in backdrop-blur-sm">
          <div className="bg-surface-card border border-purple-500/20 rounded-2xl p-6 max-w-lg w-full animate-scale-in shadow-purple-lg">
            <h2 className="text-xl font-bold mb-1">Descargar: {showModal.title}</h2>
            <p className="text-sm text-gray-400 mb-6">Pega un enlace magnet, torrent o URL directa</p>

            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-400 block mb-1">Enlace Magnet / Torrent</label>
                <input
                  type="text"
                  value={magnetUrl}
                  onChange={e => setMagnetUrl(e.target.value)}
                  placeholder="magnet:?xt=..."
                  className="w-full bg-surface border border-surface-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-accent"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-1">URL directa (HTTP/HTTPS)</label>
                <input
                  type="text"
                  value={directUrl}
                  onChange={e => setDirectUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full bg-surface border border-surface-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-accent"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => handleDownload(showModal)}
                disabled={!magnetUrl && !directUrl}
                className="btn-primary flex-1 disabled:opacity-50"
              >
                Añadir a cola
              </button>
              <button onClick={() => setShowModal(null)} className="btn-secondary">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
