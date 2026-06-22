import { useMemo } from 'react';
import MediaCard from './MediaCard';
import MediaListRow from './MediaListRow';
import AlphabetIndex from './AlphabetIndex';
import MobilePosterCard from './android/MobilePosterCard';
import TvPosterCard from './android/TvPosterCard';
import { usePlatform } from '../context/PlatformContext';
import type { MediaItem } from '../types';
import type { LibraryViewMode } from './LibraryToolbar';
import { groupByLetter } from '../utils/alphabet';

interface Props {
  items: MediaItem[];
  showPlay?: boolean;
  viewMode: LibraryViewMode;
}

function GridView({ items, showPlay, cols = 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6' }: {
  items: MediaItem[];
  showPlay?: boolean;
  cols?: string;
}) {
  return (
    <div className={`grid ${cols} gap-4`}>
      {items.map((m, i) => (
        <MediaCard key={m.id} item={m} libraryId={m.id} showPlay={showPlay} index={i} />
      ))}
    </div>
  );
}

function ListView({ items, showPlay }: { items: MediaItem[]; showPlay?: boolean }) {
  return (
    <div className="space-y-2 max-w-4xl">
      {items.map(m => (
        <MediaListRow key={m.id} item={m} showPlay={showPlay} />
      ))}
    </div>
  );
}

function AlphabetSections({
  groups,
  showPlay,
  innerView,
}: {
  groups: { letter: string; items: MediaItem[] }[];
  showPlay?: boolean;
  innerView: 'grid' | 'list';
}) {
  return (
    <div className="space-y-10 pr-8 md:pr-10">
      {groups.map(({ letter, items: sectionItems }) => (
        <section key={letter} id={`lib-letter-${letter}`} className="scroll-mt-28 md:scroll-mt-8">
          <h2 className="sticky top-16 md:top-4 z-20 mb-4 inline-flex items-center justify-center min-w-[2.25rem] h-9 px-2 rounded-xl bg-accent/15 text-accent-glow font-bold text-lg border border-accent/25 backdrop-blur-md shadow-sm">
            {letter}
          </h2>
          {innerView === 'list' ? (
            <div className="space-y-2 max-w-4xl">
              {sectionItems.map(m => (
                <MediaListRow key={m.id} item={m} showPlay={showPlay} />
              ))}
            </div>
          ) : (
            <GridView items={sectionItems} showPlay={showPlay} />
          )}
        </section>
      ))}
    </div>
  );
}

export default function LibraryMediaGrid({ items, showPlay, viewMode }: Props) {
  const { isAndroidMobile, isAndroidTv } = usePlatform();
  const groups = useMemo(
    () => (viewMode === 'alphabet' ? groupByLetter(items) : null),
    [items, viewMode],
  );

  if (isAndroidMobile && viewMode === 'grid') {
    return (
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {items.map(m => (
          <MobilePosterCard key={m.id} item={m} libraryId={m.id} />
        ))}
      </div>
    );
  }

  if (isAndroidTv && viewMode === 'grid') {
    return (
      <div className="grid grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
        {items.map(m => (
          <TvPosterCard key={m.id} item={m} libraryId={m.id} />
        ))}
      </div>
    );
  }

  if (viewMode === 'list') {
    return <ListView items={items} showPlay={showPlay} />;
  }

  if (viewMode === 'grid') {
    return <GridView items={items} showPlay={showPlay} />;
  }

  // alphabet — con secciones + índice lateral fijo (portal)
  if (!groups || groups.length <= 1) {
    return (
      <>
        {groups && groups.length === 1 && (
          <p className="text-xs text-gray-500 mb-4">Una sola letra — mostrando cuadrícula</p>
        )}
        <GridView items={items} showPlay={showPlay} />
      </>
    );
  }

  const letters = groups.map(g => g.letter);

  return (
    <>
      <AlphabetIndex letters={letters} />
      <AlphabetSections groups={groups} showPlay={showPlay} innerView="grid" />
    </>
  );
}
