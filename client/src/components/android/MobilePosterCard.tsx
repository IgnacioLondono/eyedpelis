import { Link } from 'react-router-dom';
import { Star } from 'lucide-react';
import { posterUrl } from '../../api';
import type { MediaItem, SearchResult } from '../../types';
import { mobileTapClass } from './focus';

interface Props {
  item: MediaItem | SearchResult;
  libraryId?: number;
  width?: 'sm' | 'md';
}

export default function MobilePosterCard({ item, libraryId, width = 'md' }: Props) {
  const detailLink = libraryId
    ? `/media/${libraryId}`
    : `/detail/${item.type}/${item.id}`;
  const w = width === 'sm' ? 'w-[108px]' : 'w-[124px]';

  return (
    <Link
      to={detailLink}
      className={`flex-shrink-0 ${w} ${mobileTapClass} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-glow rounded-xl`}
    >
      <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-surface-card ring-1 ring-purple-500/10">
        <img
          src={posterUrl(item.poster_path)}
          alt={item.title}
          className="w-full h-full object-cover"
          loading="lazy"
          onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder-poster.svg'; }}
        />
        {item.vote_average != null && item.vote_average > 0 && (
          <div className="absolute top-1.5 right-1.5 bg-black/75 px-1.5 py-0.5 rounded text-[10px] font-semibold flex items-center gap-0.5">
            <Star size={9} className="text-yellow-400 fill-yellow-400" />
            {item.vote_average.toFixed(1)}
          </div>
        )}
      </div>
      <p className="mt-1.5 text-xs font-medium text-gray-200 line-clamp-2 leading-snug">{item.title}</p>
    </Link>
  );
}
