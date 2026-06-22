import { useMemo } from 'react';
import MediaCard from './MediaCard';
import type { MediaItem } from '../types';
import { groupByLetter } from '../utils/alphabet';

interface Props {
  items: MediaItem[];
  showPlay?: boolean;
  /** Muestra índice A-Z cuando la lista está ordenada por título */
  alphabetIndex?: boolean;
}

function PlainGrid({ items, showPlay }: { items: MediaItem[]; showPlay?: boolean }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
      {items.map((m, i) => (
        <MediaCard key={m.id} item={m} libraryId={m.id} showPlay={showPlay} index={i} />
      ))}
    </div>
  );
}

export default function LibraryMediaGrid({ items, showPlay, alphabetIndex = false }: Props) {
  const groups = useMemo(
    () => (alphabetIndex && items.length >= 12 ? groupByLetter(items) : null),
    [items, alphabetIndex],
  );

  if (!groups || groups.length <= 1) {
    return <PlainGrid items={items} showPlay={showPlay} />;
  }

  const letters = groups.map(g => g.letter);

  const scrollToLetter = (letter: string) => {
    document.getElementById(`lib-letter-${letter}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="relative">
      <nav
        className="fixed right-1 md:right-4 top-1/2 -translate-y-1/2 z-30 flex flex-col items-center gap-px py-2 px-1 rounded-full bg-black/50 backdrop-blur-md border border-white/10 shadow-lg select-none"
        aria-label="Índice alfabético"
      >
        {letters.map(letter => (
          <button
            key={letter}
            type="button"
            onClick={() => scrollToLetter(letter)}
            className="w-5 h-[18px] md:h-5 flex items-center justify-center text-[9px] md:text-[10px] font-bold text-white/45 hover:text-accent-glow hover:scale-110 transition-all"
            title={`Ir a ${letter}`}
          >
            {letter}
          </button>
        ))}
      </nav>

      <div className="space-y-8 pr-6 md:pr-8">
        {groups.map(({ letter, items: sectionItems }) => (
          <section key={letter} id={`lib-letter-${letter}`} className="scroll-mt-24">
            <h2 className="sticky top-0 z-20 mb-4 inline-flex items-center justify-center w-9 h-9 rounded-xl bg-accent/15 text-accent-glow font-bold text-lg border border-accent/20 backdrop-blur-sm">
              {letter}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {sectionItems.map((m, i) => (
                <MediaCard key={m.id} item={m} libraryId={m.id} showPlay={showPlay} index={i} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
