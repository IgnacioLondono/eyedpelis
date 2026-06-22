import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  letters: string[];
  sectionPrefix?: string;
}

export default function AlphabetIndex({ letters, sectionPrefix = 'lib-letter' }: Props) {
  const [active, setActive] = useState(letters[0] ?? '');

  useEffect(() => {
    if (!letters.length) return;

    const ids = letters.map(l => `${sectionPrefix}-${l}`);
    const elements = ids
      .map(id => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);

    if (!elements.length) return;

    const observer = new IntersectionObserver(
      entries => {
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          const id = visible[0].target.id.replace(`${sectionPrefix}-`, '');
          setActive(id);
        }
      },
      { root: null, rootMargin: '-20% 0px -65% 0px', threshold: 0 },
    );

    elements.forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, [letters, sectionPrefix]);

  function scrollToLetter(letter: string) {
    document.getElementById(`${sectionPrefix}-${letter}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActive(letter);
  }

  if (!letters.length) return null;

  return createPortal(
    <nav
      className="fixed z-[70] select-none
        right-2 md:right-5
        top-[calc(50%+2rem)] md:top-1/2
        -translate-y-1/2
        flex flex-col items-center gap-0.5
        py-2 px-1.5
        max-h-[min(80vh,520px)] overflow-y-auto
        rounded-full bg-black/70 backdrop-blur-md border border-white/15 shadow-xl
        scrollbar-none"
      aria-label="Índice alfabético"
    >
      {letters.map(letter => {
        const isActive = active === letter;
        return (
          <button
            key={letter}
            type="button"
            onClick={() => scrollToLetter(letter)}
            className={`w-6 h-5 md:w-7 md:h-[22px] flex items-center justify-center text-[9px] md:text-[10px] font-bold rounded-md transition-all ${
              isActive
                ? 'bg-accent/25 text-accent-glow ring-1 ring-accent/50 scale-110'
                : 'text-white/45 hover:text-white hover:bg-white/10'
            }`}
            title={`Ir a ${letter}`}
          >
            {letter}
          </button>
        );
      })}
    </nav>,
    document.body,
  );
}
