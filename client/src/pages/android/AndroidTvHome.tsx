import { Link } from 'react-router-dom';
import { Sparkles, RefreshCw } from 'lucide-react';
import { useHomeData } from '../../hooks/useHomeData';
import TvHeroBanner from '../../components/android/TvHeroBanner';
import TvMediaRow from '../../components/android/TvMediaRow';
import { tvFocusClass } from '../../components/android/focus';

export default function AndroidTvHome() {
  const { movies, series, popular, heroItems, loaded, hasLibrary } = useHomeData();
  const featured = heroItems[0];

  if (!loaded) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse text-gray-400 text-lg">Cargando biblioteca…</div>
      </div>
    );
  }

  return (
    <div className="pb-12">
      {featured ? (
        <TvHeroBanner item={featured} />
      ) : (
        <div className="flex flex-col items-center justify-center min-h-[50vh] px-12 text-center">
          <Sparkles size={48} className="text-accent/60 mb-4" />
          <h1 className="text-4xl font-bold mb-3">Bienvenido a Eyedpelis</h1>
          <p className="text-gray-400 text-lg mb-8">Tu cine en casa en Android TV</p>
          <Link to="/search" className={`btn-primary text-lg px-10 py-4 min-h-[56px] ${tvFocusClass}`}>
            Explorar contenido
          </Link>
        </div>
      )}

      {hasLibrary ? (
        <>
          <TvMediaRow title="Películas recientes" items={movies} seeAllTo="/movies" library />
          <TvMediaRow title="Series destacadas" items={series} seeAllTo="/series" library />
        </>
      ) : (
        <div className="text-center py-16 px-12">
          <RefreshCw size={48} className="mx-auto text-purple-500/50 mb-4" />
          <h2 className="text-3xl font-bold mb-3">Biblioteca vacía</h2>
          <p className="text-gray-400 text-lg max-w-lg mx-auto">
            Añade películas y series a tu NAS y escanea desde la web de administración.
          </p>
        </div>
      )}

      {popular.length > 0 && (
        <TvMediaRow title="Populares en TMDB" items={popular} seeAllTo="/search" />
      )}
    </div>
  );
}
