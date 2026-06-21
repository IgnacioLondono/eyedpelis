import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Film, Tv, HardDrive, Download, RefreshCw, Play, ChevronRight } from 'lucide-react';
import { api, backdropUrl, formatBytes } from '../api';
import type { LibraryStats, MediaItem, SearchResult } from '../types';
import MediaCard from '../components/MediaCard';
import Section from '../components/Section';

export default function Home() {
  const [stats, setStats] = useState<LibraryStats | null>(null);
  const [movies, setMovies] = useState<MediaItem[]>([]);
  const [series, setSeries] = useState<MediaItem[]>([]);
  const [popular, setPopular] = useState<SearchResult[]>([]);
  const [hero, setHero] = useState<MediaItem | SearchResult | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      api.getStats(),
      api.getMovies({ sort: 'recent' }),
      api.getSeries(),
      api.getPopular('movie'),
    ]).then(([s, m, ser, pop]) => {
      setStats(s);
      setMovies(m.slice(0, 12));
      setSeries(ser.slice(0, 12));
      setPopular(pop.slice(0, 12));
      setHero(m[0] || pop[0] || null);
      setLoaded(true);
    }).catch(console.error);
  }, []);

  return (
    <div className="pb-12">
      {hero && (
        <div className="relative h-[50vh] md:h-[60vh] mb-8 overflow-hidden animate-fade-in">
          {hero.backdrop_path && (
            <img
              src={backdropUrl(hero.backdrop_path)}
              alt=""
              className="absolute inset-0 w-full h-full object-cover animate-ken-burns"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-surface via-surface/80 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-surface via-transparent to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-transparent to-transparent" />
          <div className="relative h-full flex flex-col justify-end p-6 md:p-12 max-w-2xl">
            <h1
              className="text-4xl md:text-5xl font-extrabold mb-3 drop-shadow-lg animate-fade-in-up"
              style={{ animationDelay: '200ms' }}
            >
              {hero.title}
            </h1>
            {'overview' in hero && hero.overview && (
              <p
                className="text-gray-300 text-sm md:text-base line-clamp-3 mb-6 animate-fade-in-up"
                style={{ animationDelay: '350ms' }}
              >
                {hero.overview}
              </p>
            )}
            <div
              className="flex gap-3 animate-fade-in-up"
              style={{ animationDelay: '500ms' }}
            >
              {'file_path' in hero && hero.file_path ? (
                <Link to={`/media/${(hero as MediaItem).id}`} className="btn-primary inline-flex items-center gap-2">
                  <Play size={18} fill="white" /> Ver detalles
                </Link>
              ) : (
                <Link to={`/detail/${hero.type}/${'tmdb_id' in hero && hero.tmdb_id ? hero.tmdb_id : hero.id}`} className="btn-primary">
                  Ver detalles
                </Link>
              )}
              <Link to="/search" className="btn-secondary">Buscar más</Link>
            </div>
          </div>
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 px-6 mb-10">
          {[
            { icon: Film, label: 'Películas', value: stats.totalMovies, color: 'text-purple-400' },
            { icon: Tv, label: 'Series', value: stats.totalSeries, color: 'text-violet-400' },
            { icon: HardDrive, label: 'Almacenamiento', value: formatBytes(stats.totalSize), color: 'text-fuchsia-400' },
            { icon: Download, label: 'Descargas activas', value: stats.activeDownloads, color: 'text-accent-glow' },
          ].map(({ icon: Icon, label, value, color }, i) => (
            <div
              key={label}
              className="bg-surface-card border border-purple-500/10 rounded-xl p-4 hover:border-purple-500/40 hover:-translate-y-1 hover:shadow-purple transition-all duration-500 ease-out animate-fade-in-up"
              style={{ animationDelay: `${150 + i * 80}ms` }}
            >
              <Icon size={20} className={`${color} mb-2 transition-transform duration-300 hover:scale-110`} />
              <p className="text-2xl font-bold">{value}</p>
              <p className="text-xs text-gray-500">{label}</p>
            </div>
          ))}
        </div>
      )}

      {movies.length > 0 && (
        <Section title="Películas recientes" delay={200} action={<Link to="/movies" className="text-sm text-accent hover:underline transition-colors duration-300 inline-flex items-center gap-1">Ver todas <ChevronRight size={14} /></Link>}>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {movies.map((m, i) => <MediaCard key={m.id} item={m} libraryId={m.id} showPlay index={i} />)}
          </div>
        </Section>
      )}

      {series.length > 0 && (
        <Section title="Series" delay={300} action={<Link to="/series" className="text-sm text-accent hover:underline inline-flex items-center gap-1">Ver todas <ChevronRight size={14} /></Link>}>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {series.map((s, i) => <MediaCard key={s.id} item={s} libraryId={s.id} index={i} />)}
          </div>
        </Section>
      )}

      {popular.length > 0 && (
        <Section title="Populares en TMDB" delay={400} action={<Link to="/search" className="text-sm text-accent hover:underline inline-flex items-center gap-1">Explorar <ChevronRight size={14} /></Link>}>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {popular.map((p, i) => <MediaCard key={p.id} item={p} index={i} />)}
          </div>
        </Section>
      )}

      {loaded && movies.length === 0 && series.length === 0 && (
        <div className="text-center py-20 px-6 animate-scale-in">
          <RefreshCw size={48} className="mx-auto text-purple-500/50 mb-4 animate-float" />
          <h2 className="text-2xl font-bold mb-2">Biblioteca vacía</h2>
          <p className="text-gray-400 mb-6">Configura la ruta de tu carpeta de medios y escanea tu biblioteca.</p>
          <Link to="/settings" className="btn-primary">Ir a Configuración</Link>
        </div>
      )}
    </div>
  );
}
