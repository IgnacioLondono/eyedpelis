import { Router } from 'express';
import { searchMulti, getPopular, getMovieDetails, getSeriesDetails, getSeasonDetails } from '../services/tmdb.js';

const router = Router();

router.get('/multi', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || typeof q !== 'string') return res.status(400).json({ error: 'Parámetro q requerido' });
    const results = await searchMulti(q);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Error de búsqueda' });
  }
});

router.get('/popular/:type', async (req, res) => {
  try {
    const type = req.params.type === 'series' ? 'series' : 'movie';
    const page = parseInt(req.query.page as string) || 1;
    const results = await getPopular(type, page);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Error' });
  }
});

router.get('/season/:seriesId/:seasonNumber', async (req, res) => {
  try {
    const seriesId = parseInt(req.params.seriesId);
    const seasonNumber = parseInt(req.params.seasonNumber);
    if (Number.isNaN(seriesId) || Number.isNaN(seasonNumber)) {
      return res.status(400).json({ error: 'ID de serie o temporada inválido' });
    }
    const details = await getSeasonDetails(seriesId, seasonNumber);
    res.json(details);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Error al cargar temporada' });
  }
});

router.get('/details/:type/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const details = req.params.type === 'series'
      ? await getSeriesDetails(id)
      : await getMovieDetails(id);
    res.json(details);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Error' });
  }
});

export default router;
