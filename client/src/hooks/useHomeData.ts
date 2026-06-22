import { useEffect, useState } from 'react';
import { api } from '../api';
import type { MediaItem, SearchResult } from '../types';

export function useHomeData() {
  const [movies, setMovies] = useState<MediaItem[]>([]);
  const [series, setSeries] = useState<MediaItem[]>([]);
  const [popular, setPopular] = useState<SearchResult[]>([]);
  const [heroItems, setHeroItems] = useState<MediaItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      api.getMovies({ sort: 'recent' }),
      api.getSeries({ sort: 'rating' }),
      api.getPopular('movie'),
    ]).then(([m, ser, pop]) => {
      setMovies(m.slice(0, 18));
      setSeries(ser.slice(0, 18));
      setPopular(pop.slice(0, 18));

      const featured = [...m, ...ser]
        .filter(item => item.backdrop_path)
        .sort((a, b) => (b.vote_average ?? 0) - (a.vote_average ?? 0))
        .slice(0, 8);
      setHeroItems(featured);
      setLoaded(true);
    }).catch(console.error);
  }, []);

  const hasLibrary = movies.length > 0 || series.length > 0;

  return { movies, series, popular, heroItems, loaded, hasLibrary };
}
