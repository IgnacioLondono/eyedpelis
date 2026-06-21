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

  return (
    <Link
      to={detailLink}
      className="group block card-hover animate-fade-in-up"
      style={{ animationDelay: `${Math.min(index * 70, 700)}ms` }}
    >
      <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-surface-card shadow-lg ring-1 ring-purple-500/0 group-hover:ring-purple-500/30 transition-all duration-500">
        <img
          src={posterUrl(item.poster_path)}
          alt={item.title}
          className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
          loading="lazy"
          onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder-poster.svg'; }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-purple-900/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        {showPlay && (
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-500 scale-75 group-hover:scale-100">
            <div className="bg-accent rounded-full p-3 shadow-purple animate-pulse-glow">
              <Play size={24} fill="white" />
            </div>
          </div>
        )}
        {item.vote_average != null && item.vote_average > 0 && (
          <div className="absolute top-2 right-2 bg-black/70 backdrop-blur px-2 py-1 rounded-md flex items-center gap-1 text-xs font-semibold transition-transform duration-300 group-hover:scale-105">
            <Star size={12} className="text-yellow-400 fill-yellow-400" />
            {item.vote_average.toFixed(1)}
          </div>
        )}
        {'episodeCount' in item && item.episodeCount !== undefined && (
          <div className="absolute bottom-2 left-2 bg-black/70 backdrop-blur px-2 py-1 rounded-md text-xs">
            {item.episodeCount} eps
          </div>
        )}
      </div>
      <h3 className="mt-2 text-sm font-medium text-gray-200 truncate group-hover:text-accent-glow transition-colors duration-300">
        {item.title}
      </h3>
      {item.release_date && (
        <p className="text-xs text-gray-500 transition-colors duration-300 group-hover:text-gray-400">
          {item.release_date.slice(0, 4)}
        </p>
      )}
    </Link>
  );
}
