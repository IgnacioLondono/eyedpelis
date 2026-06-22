import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Play, Star, Film, Tv } from 'lucide-react';
import { backdropUrl } from '../api';
import type { MediaItem } from '../types';

interface Props {
  items: MediaItem[];
  intervalMs?: number;
}

export default function HeroCarousel({ items, intervalMs = 8000 }: Props) {
  const slides = items.filter(i => i.backdrop_path);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(true);

  const count = slides.length;

  const goTo = useCallback((idx: number) => {
    if (count <= 1) return;
    const next = ((idx % count) + count) % count;
    if (next === active) return;
    setVisible(false);
    window.setTimeout(() => {
      setActive(next);
      setVisible(true);
    }, 350);
  }, [active, count]);

  const next = useCallback(() => goTo(active + 1), [active, goTo]);
  const prev = useCallback(() => goTo(active - 1), [active, goTo]);

  useEffect(() => {
    if (paused || count <= 1) return;
    const id = window.setInterval(next, intervalMs);
    return () => clearInterval(id);
  }, [paused, count, next, intervalMs]);

  if (count === 0) return null;

  const item = slides[active];
  const year = item.release_date?.slice(0, 4);
  const isMovie = item.type === 'movie';

  return (
    <section
      className="relative h-[58vh] min-h-[420px] md:h-[72vh] overflow-hidden group"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-label="Destacados"
    >
      {slides.map((s, i) => (
        <div
          key={s.id}
          className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${i === active ? 'opacity-100 z-0' : 'opacity-0 z-0'}`}
          aria-hidden={i !== active}
        >
          <img
            key={i === active ? `active-${s.id}` : s.id}
            src={backdropUrl(s.backdrop_path!)}
            alt=""
            className={`absolute inset-0 w-full h-full object-cover ${i === active ? 'animate-ken-burns' : ''}`}
          />
        </div>
      ))}

      <div className="absolute inset-0 bg-gradient-to-r from-black/95 via-black/55 to-black/20 z-[1]" />
      <div className="absolute inset-0 bg-gradient-to-t from-surface via-black/40 to-black/10 z-[1]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(147,51,234,0.18),transparent_55%)] z-[1]" />

      <div
        className={`relative z-[2] h-full flex flex-col justify-end pb-20 md:pb-24 px-6 md:px-14 max-w-3xl transition-all duration-350 ease-out ${
          visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
        }`}
      >
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-accent-glow bg-accent/15 border border-purple-500/25 px-3 py-1 rounded-full">
            {isMovie ? <Film size={12} /> : <Tv size={12} />}
            {isMovie ? 'Película' : 'Serie'}
          </span>
          {year && <span className="text-xs text-gray-400 bg-white/5 px-2.5 py-1 rounded-full">{year}</span>}
          {item.vote_average != null && item.vote_average > 0 && (
            <span className="inline-flex items-center gap-1 text-xs text-yellow-400 bg-yellow-500/10 px-2.5 py-1 rounded-full">
              <Star size={11} className="fill-yellow-400" />
              {item.vote_average.toFixed(1)}
            </span>
          )}
        </div>

        <h1 className="text-3xl sm:text-4xl md:text-6xl font-extrabold mb-3 leading-tight drop-shadow-2xl">
          {item.title}
        </h1>

        {item.overview && (
          <p className="text-gray-300/90 text-sm md:text-base line-clamp-3 mb-6 max-w-2xl leading-relaxed">
            {item.overview}
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          <Link
            to={item.file_path ? `/watch/${item.id}` : `/media/${item.id}`}
            className="btn-primary inline-flex items-center gap-2 text-base px-7 py-3 shadow-purple-lg"
          >
            <Play size={20} fill="white" />
            {item.file_path ? 'Reproducir' : 'Ver detalles'}
          </Link>
          <Link to={isMovie ? '/movies' : '/series'} className="btn-secondary inline-flex items-center gap-2 px-6 py-3">
            Ver {isMovie ? 'películas' : 'series'}
          </Link>
        </div>
      </div>

      {count > 1 && (
        <>
          <button
            type="button"
            onClick={prev}
            aria-label="Anterior"
            className="absolute left-3 md:left-6 top-1/2 -translate-y-1/2 z-[3] p-2.5 rounded-full bg-black/40 border border-white/10 text-white opacity-0 group-hover:opacity-100 hover:bg-black/60 hover:scale-105 transition-all backdrop-blur-sm"
          >
            <ChevronLeft size={24} />
          </button>
          <button
            type="button"
            onClick={next}
            aria-label="Siguiente"
            className="absolute right-3 md:right-6 top-1/2 -translate-y-1/2 z-[3] p-2.5 rounded-full bg-black/40 border border-white/10 text-white opacity-0 group-hover:opacity-100 hover:bg-black/60 hover:scale-105 transition-all backdrop-blur-sm"
          >
            <ChevronRight size={24} />
          </button>

          <div className="absolute bottom-6 md:bottom-8 left-1/2 -translate-x-1/2 z-[3] flex items-center gap-2">
            {slides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Ir a ${s.title}`}
                className={`rounded-full transition-all duration-300 ${
                  i === active
                    ? 'w-8 h-2 bg-accent shadow-purple'
                    : 'w-2 h-2 bg-white/35 hover:bg-white/60 hover:scale-110'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
