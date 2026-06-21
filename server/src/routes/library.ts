import { Router } from 'express';
import { findMedia, getMediaById } from '../db/database.js';
import { getAllDownloads } from '../db/database.js';
import type { MediaItem, LibraryStats } from '../types.js';

const router = Router();

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

router.get('/movies', (req, res) => {
  const { search, sort = 'title' } = req.query;
  let items = findMedia(m => m.type === 'movie' && m.file_path !== null);

  if (search) {
    const q = String(search).toLowerCase();
    items = items.filter(m =>
      m.title.toLowerCase().includes(q) ||
      (m.original_title?.toLowerCase().includes(q))
    );
  }

  const orderMap: Record<string, (a: MediaItem, b: MediaItem) => number> = {
    title: (a, b) => (a.title || '').localeCompare(b.title || '', 'es'),
    date: (a, b) => (b.release_date || '').localeCompare(a.release_date || ''),
    rating: (a, b) => (b.vote_average || 0) - (a.vote_average || 0),
    recent: (a, b) => (b.created_at || '').localeCompare(a.created_at || ''),
  };
  items.sort(orderMap[sort as string] || orderMap.title);

  res.json(items);
});

router.get('/series', (req, res) => {
  const { search } = req.query;
  let series = findMedia(m => m.type === 'series' && !m.file_path);

  if (search) {
    const q = String(search).toLowerCase();
    series = series.filter(s => s.title.toLowerCase().includes(q));
  }

  series.sort((a, b) => a.title.localeCompare(b.title));

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
