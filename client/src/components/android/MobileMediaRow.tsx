import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import type { MediaItem, SearchResult } from '../../types';
import MobilePosterCard from './MobilePosterCard';

interface Props {
  title: string;
  items: Array<MediaItem | SearchResult>;
  seeAllTo?: string;
  library?: boolean;
}

export default function MobileMediaRow({ title, items, seeAllTo, library }: Props) {
  if (!items.length) return null;

  return (
    <section className="mb-6">
      <div className="flex items-center justify-between px-4 mb-3">
        <h2 className="text-lg font-bold">{title}</h2>
        {seeAllTo && (
          <Link to={seeAllTo} className="text-xs text-accent-glow flex items-center gap-0.5 min-h-[44px] px-2">
            Ver todo <ChevronRight size={14} />
          </Link>
        )}
      </div>
      <div className="flex gap-3 overflow-x-auto px-4 pb-1 scrollbar-none snap-x snap-mandatory">
        {items.map(item => (
          <div key={`${item.type}-${item.id}`} className="snap-start">
            <MobilePosterCard
              item={item}
              libraryId={library && 'file_path' in item ? item.id : undefined}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
