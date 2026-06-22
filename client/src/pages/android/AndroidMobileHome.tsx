import { Link } from 'react-router-dom';
import { Sparkles, RefreshCw } from 'lucide-react';
import { useHomeData } from '../../hooks/useHomeData';
import MobileHero from '../../components/android/MobileHero';
import MobileMediaRow from '../../components/android/MobileMediaRow';

export default function AndroidMobileHome() {
  const { movies, series, popular, heroItems, loaded, hasLibrary } = useHomeData();
  const featured = heroItems[0];

  if (!loaded) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse text-gray-400">Cargando biblioteca…</div>
      </div>
    );
  }

  return (
    <div className="pb-4">
      {featured ? (
        <MobileHero item={featured} />
      ) : (
        <div className="px-4 py-16 text-center">
          <Sparkles size={40} className="mx-auto text-accent/60 mb-4" />
          <h1 className="text-2xl font-bold mb-2">Eyedpelis</h1>
          <p className="text-gray-400 mb-6 text-sm">Tu cine en casa</p>
          <Link to="/more" className="btn-primary inline-flex min-h-[48px] items-center px-6">
            Configurar
          </Link>
        </div>
      )}

      {hasLibrary ? (
        <>
          <MobileMediaRow title="Películas recientes" items={movies} seeAllTo="/movies" library />
          <MobileMediaRow title="Series destacadas" items={series} seeAllTo="/series" library />
        </>
      ) : (
        <div className="text-center py-12 px-6">
          <RefreshCw size={40} className="mx-auto text-purple-500/50 mb-4" />
          <h2 className="text-xl font-bold mb-2">Biblioteca vacía</h2>
          <p className="text-gray-400 text-sm mb-6">Escanea tu carpeta de medios para empezar.</p>
          <Link to="/more" className="btn-primary inline-flex min-h-[48px] items-center px-6">
            Ir a configuración
          </Link>
        </div>
      )}

      {popular.length > 0 && (
        <MobileMediaRow title="Populares" items={popular} seeAllTo="/search" />
      )}
    </div>
  );
}
