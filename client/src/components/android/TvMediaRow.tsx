import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import type { MediaItem, SearchResult } from '../../types';
import TvPosterCard from './TvPosterCard';
import { tvFocusClass } from './focus';

interface Props {
  title: string;
  items: Array<MediaItem | SearchResult>;
  seeAllTo?: string;
  library?: boolean;
}

export default function TvMediaRow({ title, items, seeAllTo, library }: Props) {
  if (!items.length) return null;

  return (
    <section className="mb-10 px-10">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold">{title}</h2>
        {seeAllTo && (
          <Link
            to={seeAllTo}
            className={`text-sm text-accent-glow flex items-center gap-1 px-4 py-2 rounded-lg min-h-[48px] ${tvFocusClass}`}
          >
            Ver todo <ChevronRight size={16} />
          </Link>
        )}
      </div>
      <div className="flex gap-5 overflow-x-auto pb-3 scrollbar-none snap-x snap-mandatory tv-row-scroll">
        {items.map(item => (
          <div key={`${item.type}-${item.id}`} className="snap-start">
            <TvPosterCard
              item={item}
              libraryId={library && 'file_path' in item ? item.id : undefined}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
