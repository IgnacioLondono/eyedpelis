import { Link } from 'react-router-dom';
import { Film, Tv, Search, Sparkles, RefreshCw, ChevronRight } from 'lucide-react';
import { usePlatform } from '../context/PlatformContext';
import { useHomeData } from '../hooks/useHomeData';
import AndroidMobileHome from './android/AndroidMobileHome';
import AndroidTvHome from './android/AndroidTvHome';
import MediaCard from '../components/MediaCard';
import HeroCarousel from '../components/HeroCarousel';
import Section from '../components/Section';

export default function Home() {
  const { isAndroidMobile, isAndroidTv } = usePlatform();

  if (isAndroidTv) return <AndroidTvHome />;
  if (isAndroidMobile) return <AndroidMobileHome />;

  return <WebHome />;
}

function WebHome() {
  const { movies, series, popular, heroItems, loaded, hasLibrary } = useHomeData();

  return (
    <div className="pb-16">
      {heroItems.length > 0 ? (
        <HeroCarousel items={heroItems} />
      ) : loaded && (
        <div className="relative h-[40vh] min-h-[280px] flex items-center justify-center bg-gradient-to-br from-purple-900/20 via-surface to-surface border-b border-purple-500/10">
          <div className="text-center px-6">
            <Sparkles size={40} className="mx-auto text-accent/60 mb-4" />
            <h1 className="text-3xl font-bold mb-2">Bienvenido a Eyedpelis</h1>
            <p className="text-gray-400 mb-6">Tu cine en casa</p>
            <Link to="/settings" className="btn-primary">Configurar biblioteca</Link>
          </div>
        </div>
      )}

      {hasLibrary && (
        <div className="px-6 md:px-10 -mt-6 relative z-10">
          <div className="flex flex-wrap gap-2 md:gap-3">
            {[
              { to: '/movies', icon: Film, label: 'Películas' },
              { to: '/series', icon: Tv, label: 'Series' },
              { to: '/search', icon: Search, label: 'Buscar online' },
            ].map(({ to, icon: Icon, label }) => (
              <Link
                key={to}
                to={to}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface-card/90 backdrop-blur-md border border-purple-500/20 text-sm font-medium text-gray-300 hover:text-white hover:border-accent/40 hover:bg-surface-hover transition-all"
              >
                <Icon size={16} className="text-accent-glow" />
                {label}
              </Link>
            ))}
          </div>
        </div>
      )}

      {movies.length > 0 && (
        <Section
          title="Películas recientes"
          delay={100}
          action={
            <Link to="/movies" className="text-sm text-accent-glow hover:text-accent transition-colors inline-flex items-center gap-1">
              Ver todas <ChevronRight size={14} />
            </Link>
          }
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {movies.slice(0, 12).map((m, i) => (
              <MediaCard key={m.id} item={m} libraryId={m.id} showPlay index={i} />
            ))}
          </div>
        </Section>
      )}

      {series.length > 0 && (
        <Section
          title="Series destacadas"
          delay={200}
          action={
            <Link to="/series" className="text-sm text-accent-glow hover:text-accent transition-colors inline-flex items-center gap-1">
              Ver todas <ChevronRight size={14} />
            </Link>
          }
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {series.slice(0, 12).map((s, i) => (
              <MediaCard key={s.id} item={s} libraryId={s.id} index={i} />
            ))}
          </div>
        </Section>
      )}

      {popular.length > 0 && (
        <Section
          title="Populares en TMDB"
          delay={300}
          action={
            <Link to="/search" className="text-sm text-accent-glow hover:text-accent transition-colors inline-flex items-center gap-1">
              Explorar <ChevronRight size={14} />
            </Link>
          }
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {popular.slice(0, 12).map((p, i) => (
              <MediaCard key={p.id} item={p} index={i} />
            ))}
          </div>
        </Section>
      )}

      {loaded && !hasLibrary && (
        <div className="text-center py-20 px-6 animate-scale-in">
          <RefreshCw size={48} className="mx-auto text-purple-500/50 mb-4 animate-float" />
          <h2 className="text-2xl font-bold mb-2">Biblioteca vacía</h2>
          <p className="text-gray-400 mb-6 max-w-md mx-auto">
            Añade películas y series a tu carpeta de medios y escanea la biblioteca para empezar.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link to="/files" className="btn-secondary">Ir a Archivos</Link>
            <Link to="/settings" className="btn-primary">Configuración</Link>
          </div>
        </div>
      )}
    </div>
  );
}
