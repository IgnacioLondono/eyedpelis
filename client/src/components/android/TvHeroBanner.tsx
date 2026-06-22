import { Link } from 'react-router-dom';
import { Play, Star, Film, Tv } from 'lucide-react';
import { backdropUrl } from '../../api';
import type { MediaItem } from '../../types';
import { tvFocusClass } from './focus';

interface Props {
  item: MediaItem;
}

export default function TvHeroBanner({ item }: Props) {
  const year = item.release_date?.slice(0, 4);
  const isMovie = item.type === 'movie';
  const watchLink = item.file_path ? `/watch/${item.id}` : `/media/${item.id}`;

  return (
    <section className="relative h-[62vh] min-h-[400px] overflow-hidden mb-2">
      {item.backdrop_path && (
        <img
          src={backdropUrl(item.backdrop_path)}
          alt=""
          className="absolute inset-0 w-full h-full object-cover animate-ken-burns"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-black via-black/65 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-surface via-transparent to-black/30" />

      <div className="relative z-10 h-full flex flex-col justify-end px-12 pb-14 max-w-3xl">
        <div className="flex items-center gap-3 mb-4">
          <span className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-accent-glow bg-accent/15 border border-purple-500/25 px-4 py-1.5 rounded-full">
            {isMovie ? <Film size={16} /> : <Tv size={16} />}
            {isMovie ? 'Película' : 'Serie'}
          </span>
          {year && <span className="text-sm text-gray-400">{year}</span>}
          {item.vote_average != null && item.vote_average > 0 && (
            <span className="text-sm text-yellow-400 flex items-center gap-1">
              <Star size={14} className="fill-yellow-400" />
              {item.vote_average.toFixed(1)}
            </span>
          )}
        </div>

        <h1 className="text-5xl font-extrabold mb-4 leading-tight drop-shadow-2xl">{item.title}</h1>
        {item.overview && (
          <p className="text-lg text-gray-300/90 line-clamp-3 mb-8 leading-relaxed">{item.overview}</p>
        )}

        <div className="flex gap-4">
          <Link
            to={watchLink}
            className={`inline-flex items-center gap-3 bg-accent hover:bg-accent-hover text-white font-bold text-lg px-10 py-4 rounded-xl shadow-purple-lg min-h-[56px] ${tvFocusClass}`}
          >
            <Play size={24} fill="white" />
            {item.file_path ? 'Reproducir' : 'Ver detalles'}
          </Link>
          <Link
            to={isMovie ? '/movies' : '/series'}
            className={`inline-flex items-center px-8 py-4 rounded-xl border border-white/20 text-white font-medium text-lg min-h-[56px] hover:bg-white/10 ${tvFocusClass}`}
          >
            Biblioteca
          </Link>
        </div>
      </div>
    </section>
  );
}
