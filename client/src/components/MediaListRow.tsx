import { Link } from 'react-router-dom';
import { Star, Play, Film, Tv } from 'lucide-react';
import { posterUrl } from '../api';
import type { MediaItem } from '../types';

interface Props {
  item: MediaItem;
  showPlay?: boolean;
}

export default function MediaListRow({ item, showPlay }: Props) {
  const year = item.release_date?.slice(0, 4);
  const genres = item.genres?.split(',').filter(Boolean).slice(0, 3).join(' · ');

  return (
    <Link
      to={`/media/${item.id}`}
      className="group flex gap-4 p-3 md:p-4 rounded-xl bg-surface-card border border-purple-500/10 hover:border-accent/35 hover:bg-surface-hover/50 transition-all duration-300 focus-visible:outline-none min-h-[48px]"
    >
      <div className="relative w-16 h-24 md:w-20 md:h-[120px] flex-shrink-0 rounded-lg overflow-hidden ring-1 ring-purple-500/15 group-hover:ring-purple-500/40">
        <img
          src={posterUrl(item.poster_path)}
          alt={item.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
          onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder-poster.svg'; }}
        />
        {showPlay && (
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <div className="bg-accent rounded-full p-2">
              <Play size={16} fill="white" />
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <div className="flex items-center gap-2 mb-1">
          {item.type === 'movie' ? (
            <Film size={14} className="text-purple-400 shrink-0" />
          ) : (
            <Tv size={14} className="text-violet-400 shrink-0" />
          )}
          {year && <span className="text-xs text-gray-500">{year}</span>}
          {item.vote_average != null && item.vote_average > 0 && (
            <span className="text-xs text-yellow-400 flex items-center gap-0.5">
              <Star size={11} className="fill-yellow-400" />
              {item.vote_average.toFixed(1)}
            </span>
          )}
          {'episodeCount' in item && item.episodeCount !== undefined && (
            <span className="text-xs text-gray-500">{item.episodeCount} eps</span>
          )}
        </div>
        <h3 className="font-semibold text-base md:text-lg truncate group-hover:text-accent-glow transition-colors">
          {item.title}
        </h3>
        {item.original_title && item.original_title !== item.title && (
          <p className="text-sm text-gray-500 truncate">{item.original_title}</p>
        )}
        {genres && <p className="text-xs text-purple-400/80 mt-1 truncate">{genres}</p>}
        {item.overview && (
          <p className="text-sm text-gray-400 line-clamp-2 mt-1.5 hidden sm:block">{item.overview}</p>
        )}
      </div>
    </Link>
  );
}
