import { Router } from 'express';
import { findMedia, getMediaById } from '../db/database.js';
import { getAllDownloads } from '../db/database.js';
import type { MediaItem, LibraryStats } from '../types.js';

const router = Router();

function parseGenres(genres: string | null): string[] {
  if (!genres) return [];
  return genres.split(',').map(g => g.trim()).filter(Boolean);
}

function matchesSearch(item: MediaItem, q: string): boolean {
  const lower = q.toLowerCase();
  return (
    item.title.toLowerCase().includes(lower)
    || (item.original_title?.toLowerCase().includes(lower) ?? false)
    || (item.overview?.toLowerCase().includes(lower) ?? false)
  );
}

function matchesGenre(item: MediaItem, genre: string): boolean {
  return parseGenres(item.genres).some(g => g.toLowerCase() === genre.toLowerCase());
}

function getYear(item: MediaItem): number | null {
  if (!item.release_date) return null;
  const y = parseInt(item.release_date.slice(0, 4));
  return Number.isNaN(y) ? null : y;
}

const orderMap: Record<string, (a: MediaItem, b: MediaItem) => number> = {
  title: (a, b) => (a.title || '').localeCompare(b.title || '', 'es'),
  date: (a, b) => (b.release_date || '').localeCompare(a.release_date || ''),
  rating: (a, b) => (b.vote_average || 0) - (a.vote_average || 0),
  recent: (a, b) => (b.created_at || '').localeCompare(a.created_at || ''),
};

function applyFilters(items: MediaItem[], query: Record<string, unknown>) {
  let result = items;
  const { search, genre, year } = query;

  if (search && typeof search === 'string') {
    result = result.filter(m => matchesSearch(m, search));
  }
  if (genre && typeof genre === 'string') {
    result = result.filter(m => matchesGenre(m, genre));
  }
  if (year && typeof year === 'string') {
    const y = parseInt(year);
    if (!Number.isNaN(y)) {
      result = result.filter(m => getYear(m) === y);
    }
  }
  return result;
}

router.get('/stats', (_req, res) => {
  const media = findMedia(() => true);
  const downloads = getAllDownloads();
  const stats: LibraryStats = {
    totalMovies: media.filter(m => m.type === 'movie' && m.file_path).length,
    totalSeries: media.filter(m => m.type === 'series' && !m.file_path).length,
    totalEpisodes: media.filter(m => m.type === 'series' && m.file_path).length,
    totalSize: media.reduce((sum, m) => sum + (m.file_size || 0), 0),
    activeDownloads: downloads.filter(d => d.status === 'queued' || d.status === 'downloading').length,
  };
  res.json(stats);
});

router.get('/filters/:type', (req, res) => {
  const type = req.params.type === 'series' ? 'series' : 'movie';
  const items = type === 'movie'
    ? findMedia(m => m.type === 'movie' && m.file_path !== null)
    : findMedia(m => m.type === 'series' && !m.file_path);

  const genreSet = new Set<string>();
  const yearSet = new Set<number>();
  for (const item of items) {
    parseGenres(item.genres).forEach(g => genreSet.add(g));
    const y = getYear(item);
    if (y) yearSet.add(y);
  }

  res.json({
    genres: [...genreSet].sort((a, b) => a.localeCompare(b, 'es')),
    years: [...yearSet].sort((a, b) => b - a),
  });
});

router.get('/movies', (req, res) => {
  const { sort = 'title' } = req.query;
  let items = findMedia(m => m.type === 'movie' && m.file_path !== null);
  items = applyFilters(items, req.query);
  items.sort(orderMap[sort as string] || orderMap.title);
  res.json(items);
});

router.get('/series', (req, res) => {
  const { sort = 'title' } = req.query;
  let series = findMedia(m => m.type === 'series' && !m.file_path);
  series = applyFilters(series, req.query);
  series.sort(orderMap[sort as string] || orderMap.title);

  const result = series.map(s => {
    const episodes = findMedia(m => m.series_id === s.id && !!m.file_path).sort((a, b) => {
      if (a.season !== b.season) return (a.season || 0) - (b.season || 0);
      return (a.episode || 0) - (b.episode || 0);
    });
    return { ...s, episodes, episodeCount: episodes.length };
  });

  res.json(result);
});

router.get('/:id', (req, res) => {
  const item = getMediaById(parseInt(req.params.id));
  if (!item) return res.status(404).json({ error: 'No encontrado' });

  if (item.type === 'series' && !item.file_path) {
    const episodes = findMedia(m => m.series_id === item.id).sort((a, b) => {
      if (a.season !== b.season) return (a.season || 0) - (b.season || 0);
      return (a.episode || 0) - (b.episode || 0);
    });
    return res.json({ ...item, episodes });
  }

  res.json(item);
});

export default router;
