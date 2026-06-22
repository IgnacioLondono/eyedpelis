import { Link } from 'react-router-dom';
import { Play, Star } from 'lucide-react';
import { backdropUrl } from '../../api';
import type { MediaItem } from '../../types';
import { mobileTapClass } from './focus';

interface Props {
  item: MediaItem;
}

export default function MobileHero({ item }: Props) {
  const year = item.release_date?.slice(0, 4);
  const watchLink = item.file_path ? `/watch/${item.id}` : `/media/${item.id}`;

  return (
    <section className="relative h-[52vh] min-h-[300px] max-h-[420px] overflow-hidden">
      {item.backdrop_path ? (
        <img
          src={backdropUrl(item.backdrop_path)}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/50 to-surface" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/50 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/70 to-transparent" />

      <div className="relative z-10 h-full flex flex-col justify-end px-4 pb-6">
        <div className="flex items-center gap-2 mb-2">
          {year && <span className="text-xs text-gray-400">{year}</span>}
          {item.vote_average != null && item.vote_average > 0 && (
            <span className="text-xs text-yellow-400 flex items-center gap-0.5">
              <Star size={11} className="fill-yellow-400" />
              {item.vote_average.toFixed(1)}
            </span>
          )}
        </div>
        <h1 className="text-2xl font-extrabold leading-tight mb-2 line-clamp-2">{item.title}</h1>
        {item.overview && (
          <p className="text-sm text-gray-400 line-clamp-2 mb-4">{item.overview}</p>
        )}
        <Link
          to={watchLink}
          className={`inline-flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-white font-semibold px-6 py-3.5 rounded-xl shadow-purple min-h-[48px] w-fit ${mobileTapClass}`}
        >
          <Play size={20} fill="white" />
          {item.file_path ? 'Reproducir' : 'Ver detalles'}
        </Link>
      </div>
    </section>
  );
}
