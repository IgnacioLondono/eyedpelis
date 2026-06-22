import { useState } from 'react';
import { Search as SearchIcon, Download, Film, Tv, Link2, Info, RefreshCw, Users, HardDrive, Zap } from 'lucide-react';
import { api, posterUrl, formatBytes } from '../api';
import Modal from '../components/Modal';
import { errorMessage, useNotice } from '../context/NoticeContext';
import type { SearchResult, TorrentResult } from '../types';

export default function Search() {
  const { showError, showSuccess } = useNotice();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'movie' | 'series'>('all');
  const [submitting, setSubmitting] = useState(false);
  const [showModal, setShowModal] = useState<SearchResult | null>(null);
  const [torrents, setTorrents] = useState<TorrentResult[]>([]);
  const [searchingTorrents, setSearchingTorrents] = useState(false);
  const [selectedTorrent, setSelectedTorrent] = useState<TorrentResult | null>(null);
  const [magnetUrl, setMagnetUrl] = useState('');
  const [directUrl, setDirectUrl] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchCaps, setSearchCaps] = useState<Record<string, boolean> | null>(null);
  const [searchSources, setSearchSources] = useState<Record<string, { ok: boolean; count: number; error?: string }> | null>(null);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    try {
      const data = await api.search(query);
      setResults(data);
    } catch (err) {
      showError(errorMessage(err, 'Error de búsqueda'));
    } finally {
      setLoading(false);
    }
  }

  async function searchTorrentsFor(item: SearchResult) {
    setSearchingTorrents(true);
    setError(null);
    setTorrents([]);
    setSelectedTorrent(null);
    try {
      const year = item.release_date ? parseInt(item.release_date.slice(0, 4)) : undefined;
      const data = await api.searchTorrents({
        title: item.title,
        type: item.type,
        year,
        tmdb_id: item.id,
        original_title: item.original_title,
      });
      setSearchCaps(data.capabilities);
      setSearchSources(data.sources);
      setTorrents(data.results);
      if (data.results.length > 0) setSelectedTorrent(data.results[0]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al buscar torrents');
    } finally {
      setSearchingTorrents(false);
    }
  }

  function openDownloadModal(item: SearchResult) {
    setShowModal(item);
    setMagnetUrl('');
    setDirectUrl('');
    setShowManual(false);
    setError(null);
    searchTorrentsFor(item);
  }

  function closeModal() {
    setShowModal(null);
    setTorrents([]);
    setSelectedTorrent(null);
    setSearchSources(null);
    setError(null);
  }

  async function handleDownload(auto = false) {
    if (!showModal) return;

    const year = showModal.release_date ? parseInt(showModal.release_date.slice(0, 4)) : undefined;

    if (!auto && !magnetUrl && !directUrl && !selectedTorrent) {
      setError('Selecciona un torrent o pega un enlace manual');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await api.addDownload({
        tmdb_id: showModal.id,
        type: showModal.type,
        title: showModal.title,
        poster_path: showModal.poster_path,
        year,
        auto_search: auto && !magnetUrl && !directUrl,
        magnet_url: magnetUrl || selectedTorrent?.magnet_url || undefined,
        torrent_url: selectedTorrent?.torrent_url || undefined,
        direct_url: directUrl || undefined,
      });
      closeModal();
      showSuccess(`"${showModal.title}" añadido a la cola.\nCuando termine te pediremos en qué carpeta guardarlo.`, 'Añadido a descargas');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al descargar');
    } finally {
      setSubmitting(false);
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
              onClick={() => openDownloadModal(item)}
              className="btn-primary flex items-center gap-2 self-center flex-shrink-0"
            >
              <Download size={18} />
              Descargar
            </button>
          </div>
        ))}
      </div>

      <Modal
        open={!!showModal}
        onClose={closeModal}
        title={showModal ? `Descargar: ${showModal.title}` : undefined}
        maxWidth="max-w-2xl"
      >
        <p className="text-sm text-gray-400 mb-4 flex items-start gap-2">
          <Info size={16} className="mt-0.5 flex-shrink-0" />
          Buscamos automáticamente en indexadores (Prowlarr/Jackett) y fuentes públicas (YTS, EZTV).
          Al terminar te preguntaremos si va a Películas o Series.
        </p>

        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-300">Resultados encontrados</h3>
          {showModal && (
            <button
              type="button"
              onClick={() => searchTorrentsFor(showModal)}
              disabled={searchingTorrents}
              className="text-xs text-accent hover:text-accent-glow flex items-center gap-1"
            >
              <RefreshCw size={12} className={searchingTorrents ? 'animate-spin' : ''} />
              Buscar de nuevo
            </button>
          )}
        </div>

        {searchSources && !searchingTorrents && (
          <div className="flex flex-wrap gap-2 mb-3 text-[11px]">
            {[
              { key: 'prowlarr', label: 'Prowlarr', configured: searchCaps?.prowlarr },
              { key: 'jackett', label: 'Jackett', configured: searchCaps?.jackett },
              { key: 'yts', label: 'YTS', configured: showModal?.type === 'movie' },
              { key: 'eztv', label: 'EZTV', configured: showModal?.type === 'series' },
            ].map(({ key, label, configured }) => {
              if (!configured) return null;
              const s = searchSources[key];
              if (!s) return null;
              const tone = s.ok && s.count > 0
                ? 'text-green-400 border-green-500/30 bg-green-500/10'
                : s.ok
                  ? 'text-gray-400 border-gray-500/30 bg-gray-500/10'
                  : 'text-amber-400 border-amber-500/30 bg-amber-500/10';
              return (
                <span key={key} className={`px-2 py-1 rounded-md border ${tone}`} title={s.error}>
                  {label}: {s.count > 0 ? `${s.count}` : s.error || '0'}
                </span>
              );
            })}
          </div>
        )}

        {searchingTorrents ? (
          <div className="py-10 text-center text-gray-500">
            <RefreshCw size={28} className="animate-spin mx-auto mb-3 text-accent" />
            Buscando en indexadores...
          </div>
        ) : torrents.length === 0 ? (
          <div className="py-6 px-4 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-200 text-sm mb-4 space-y-2">
            <p>
              No hay torrents que coincidan con <strong className="text-amber-100">{showModal?.title}</strong>.
            </p>
            {showModal?.type === 'series' && !searchCaps?.prowlarr && !searchCaps?.jackett ? (
              <p className="text-amber-200/80 text-xs leading-relaxed">
                EZTV solo cubre series occidentales. Para anime como Bleach necesitas <strong>Prowlarr</strong> con indexadores de anime (Nyaa, etc.) en Configuración.
              </p>
            ) : (
              <p className="text-amber-200/80 text-xs leading-relaxed">
                Configura Prowlarr o Jackett, o pega un enlace magnet manual abajo.
              </p>
            )}
          </div>
        ) : (
          <div className="max-h-64 overflow-y-auto space-y-2 mb-4 pr-1">
            {torrents.map((t, i) => {
              const selected = selectedTorrent === t;
              return (
                <button
                  key={`${t.title}-${i}`}
                  type="button"
                  onClick={() => setSelectedTorrent(t)}
                  className={`w-full text-left p-3 rounded-xl border transition-all ${
                    selected
                      ? 'border-accent bg-accent/10 ring-1 ring-accent/30'
                      : 'border-surface-border bg-surface hover:border-purple-500/30'
                  }`}
                >
                  <p className="text-sm font-medium truncate">{t.title}</p>
                  <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <Users size={12} className="text-green-400" />
                      {t.seeders} seeds
                    </span>
                    {t.size_bytes > 0 && (
                      <span className="flex items-center gap-1">
                        <HardDrive size={12} />
                        {formatBytes(t.size_bytes)}
                      </span>
                    )}
                    <span className="text-purple-400">{t.source}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {torrents.length > 0 && (
          <button
            type="button"
            onClick={() => handleDownload(true)}
            disabled={submitting}
            className="btn-primary w-full flex items-center justify-center gap-2 mb-4"
          >
            <Zap size={18} />
            {submitting ? 'Añadiendo...' : 'Descargar el mejor resultado'}
          </button>
        )}

        <button
          type="button"
          onClick={() => setShowManual(!showManual)}
          className="text-sm text-gray-500 hover:text-gray-300 mb-2"
        >
          {showManual ? '▾ Ocultar enlace manual' : '▸ Pegar enlace manual (magnet / URL)'}
        </button>

        {showManual && (
          <div className="space-y-3 mb-4">
            <div>
              <label className="text-sm text-gray-400 mb-1 flex items-center gap-1">
                <Link2 size={14} /> Enlace Magnet / Torrent
              </label>
              <input
                type="text"
                value={magnetUrl}
                onChange={e => { setMagnetUrl(e.target.value); setError(null); }}
                placeholder="magnet:?xt=..."
                className="w-full bg-surface border border-surface-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="text-sm text-gray-400 block mb-1">URL directa (HTTP/HTTPS)</label>
              <input
                type="text"
                value={directUrl}
                onChange={e => { setDirectUrl(e.target.value); setError(null); }}
                placeholder="https://..."
                className="w-full bg-surface border border-surface-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-accent"
              />
            </div>
          </div>
        )}

        {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

        <div className="flex gap-3">
          {selectedTorrent && !showManual && (
            <button
              onClick={() => handleDownload(false)}
              disabled={submitting}
              className="btn-primary flex-1 disabled:opacity-50"
            >
              {submitting ? 'Añadiendo...' : 'Descargar seleccionado'}
            </button>
          )}
          {(showManual || torrents.length === 0) && (
            <button
              onClick={() => handleDownload(false)}
              disabled={submitting || (!magnetUrl && !directUrl && !selectedTorrent)}
              className="btn-primary flex-1 disabled:opacity-50"
            >
              {submitting ? 'Añadiendo...' : 'Añadir a cola'}
            </button>
          )}
          <button type="button" onClick={closeModal} className="btn-secondary">Cancelar</button>
        </div>
      </Modal>
    </div>
  );
}
