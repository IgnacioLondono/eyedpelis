import { Link } from 'react-router-dom';
import { Star, Play } from 'lucide-react';
import { posterUrl } from '../api';
import type { MediaItem, SearchResult } from '../types';

interface Props {
  item: MediaItem | SearchResult;
  libraryId?: number;
  showPlay?: boolean;
  index?: number;
}

export default function MediaCard({ item, libraryId, showPlay, index = 0 }: Props) {
  const detailLink = libraryId
    ? `/media/${libraryId}`
    : `/detail/${item.type}/${item.id}`;

  const year = item.release_date?.slice(0, 4);

  return (
    <Link
      to={detailLink}
      className="group block card-hover animate-fade-in-up focus-visible:outline-none rounded-xl"
      style={{ animationDelay: `${Math.min(index * 70, 700)}ms` }}
    >
      <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-surface-card shadow-lg ring-1 ring-purple-500/10 group-hover:ring-purple-500/35 transition-all duration-500">
        <img
          src={posterUrl(item.poster_path)}
          alt={item.title}
          className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
          loading="lazy"
          onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder-poster.svg'; }}
        />

        {/* Título integrado en la portada */}
        <div className="absolute inset-x-0 bottom-0 pt-14 pb-2.5 px-2.5 bg-gradient-to-t from-black via-black/75 to-transparent pointer-events-none">
          <h3 className="text-sm font-semibold text-white truncate leading-tight group-hover:text-accent-glow transition-colors">
            {item.title}
          </h3>
          {year && <p className="text-[11px] text-gray-400 mt-0.5">{year}</p>}
        </div>

        <div className="absolute inset-0 bg-purple-900/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

        {showPlay && (
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-500 scale-90 group-hover:scale-100 pointer-events-none">
            <div className="bg-accent rounded-full p-3 shadow-purple animate-pulse-glow">
              <Play size={24} fill="white" />
            </div>
          </div>
        )}

        {item.vote_average != null && item.vote_average > 0 && (
          <div className="absolute top-2 right-2 bg-black/75 backdrop-blur-sm px-2 py-1 rounded-md flex items-center gap-1 text-xs font-semibold">
            <Star size={12} className="text-yellow-400 fill-yellow-400" />
            {item.vote_average.toFixed(1)}
          </div>
        )}

        {'episodeCount' in item && item.episodeCount !== undefined && (
          <div className="absolute top-2 left-2 bg-black/75 backdrop-blur-sm px-2 py-1 rounded-md text-xs font-medium">
            {item.episodeCount} eps
          </div>
        )}
      </div>
    </Link>
  );
}
