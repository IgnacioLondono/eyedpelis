import { Router } from 'express';
import {
  addToQueue, getAllDownloads, deleteDownload, updateDownload, finalizeDownload, syncActiveDownloads,
} from '../services/downloadManager.js';
import { scanLibrary, scheduleBackgroundEnrich } from '../services/scanner.js';
import { getSearchCapabilities, pickBestTorrent, searchTorrents } from '../services/torrentSearch.js';
import type { MediaType } from '../types.js';

const router = Router();

router.get('/capabilities', (_req, res) => {
  res.json(getSearchCapabilities());
});

router.get('/search', async (req, res) => {
  try {
    const title = String(req.query.title || '');
    const type = req.query.type as MediaType;
    const year = req.query.year ? parseInt(String(req.query.year)) : undefined;
    const tmdb_id = req.query.tmdb_id ? parseInt(String(req.query.tmdb_id)) : undefined;

    if (!title || (type !== 'movie' && type !== 'series')) {
      return res.status(400).json({ error: 'title y type (movie|series) son requeridos' });
    }

    const results = await searchTorrents({ title, type, year, tmdb_id });
    res.json({ results, capabilities: getSearchCapabilities() });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Error al buscar torrents' });
  }
});

router.get('/', async (_req, res) => {
  try {
    await syncActiveDownloads();
    res.json(getAllDownloads());
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Error al listar descargas' });
  }
});

router.post('/', async (req, res) => {
  try {
    const {
      tmdb_id, type, title, poster_path,
      magnet_url, torrent_url, direct_url,
      auto_search, year,
    } = req.body;

    if (!tmdb_id || !type || !title) {
      return res.status(400).json({ error: 'tmdb_id, type y title son requeridos' });
    }

    let magnet = magnet_url as string | undefined;
    let torrent = torrent_url as string | undefined;
    let direct = direct_url as string | undefined;
    let pickedFrom: string | undefined;

    if (!magnet && !torrent && !direct && auto_search !== false) {
      const results = await searchTorrents({
        title,
        type: type as MediaType,
        year: year ? parseInt(String(year)) : undefined,
        tmdb_id: parseInt(String(tmdb_id)),
      });
      const best = pickBestTorrent(results);
      if (!best) {
        return res.status(404).json({
          error: 'No se encontraron torrents. Configura Prowlarr/Jackett en Configuración para más fuentes.',
          results: [],
        });
      }
      magnet = best.magnet_url ?? undefined;
      torrent = best.torrent_url ?? undefined;
      pickedFrom = best.source;
    }

    if (!magnet && !torrent && !direct) {
      return res.status(400).json({ error: 'Necesitas un enlace o activar búsqueda automática' });
    }

    const item = await addToQueue({
      tmdb_id,
      type,
      title,
      poster_path,
      magnet_url: magnet,
      torrent_url: torrent,
      direct_url: direct,
    });

    res.status(201).json({ ...item, pickedFrom });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Error' });
  }
});

router.post('/:id/finalize', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { folder, subfolder } = req.body as { folder?: string; subfolder?: string };
    if (folder !== 'movies' && folder !== 'series') {
      return res.status(400).json({ error: 'folder debe ser "movies" o "series"' });
    }
    const destPath = await finalizeDownload(id, folder, subfolder);
    const scanScope = folder === 'series' ? 'series' : 'movie';
    const scan = await scanLibrary({ enrich: false, scope: scanScope });
    scheduleBackgroundEnrich();
    res.json({ ok: true, path: destPath, scan });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Error al mover archivo' });
  }
});

router.patch('/:id', (req, res) => {
  const id = parseInt(req.params.id);
  updateDownload(id, req.body);
  res.json({ ok: true });
});

router.delete('/:id', (req, res) => {
  deleteDownload(parseInt(req.params.id));
  res.json({ ok: true });
});

export default router;
