import { Link } from 'react-router-dom';
import { Star } from 'lucide-react';
import { posterUrl } from '../../api';
import type { MediaItem, SearchResult } from '../../types';
import { scrollIntoViewHorizontal, tvFocusClass } from './focus';

interface Props {
  item: MediaItem | SearchResult;
  libraryId?: number;
}

export default function TvPosterCard({ item, libraryId }: Props) {
  const detailLink = libraryId
    ? `/media/${libraryId}`
    : `/detail/${item.type}/${item.id}`;

  return (
    <Link
      to={detailLink}
      onFocus={e => scrollIntoViewHorizontal(e.currentTarget)}
      className={`flex-shrink-0 w-[150px] group block rounded-xl ${tvFocusClass}`}
    >
      <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-surface-card ring-1 ring-purple-500/15 group-focus:ring-accent/50">
        <img
          src={posterUrl(item.poster_path)}
          alt={item.title}
          className="w-full h-full object-cover"
          loading="lazy"
          onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder-poster.svg'; }}
        />
        {item.vote_average != null && item.vote_average > 0 && (
          <div className="absolute top-2 right-2 bg-black/80 px-2 py-1 rounded-md text-xs font-semibold flex items-center gap-1">
            <Star size={12} className="text-yellow-400 fill-yellow-400" />
            {item.vote_average.toFixed(1)}
          </div>
        )}
      </div>
      <p className="mt-2 text-sm font-semibold text-gray-200 line-clamp-2 group-focus:text-accent-glow">{item.title}</p>
    </Link>
  );
}
