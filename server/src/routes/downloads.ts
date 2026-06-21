import { Router } from 'express';
import {
  addToQueue, getAllDownloads, deleteDownload, updateDownload, finalizeDownload,
} from '../services/downloadManager.js';
import { scanLibrary } from '../services/scanner.js';

const router = Router();

router.get('/', (_req, res) => {
  res.json(getAllDownloads());
});

router.post('/', async (req, res) => {
  try {
    const { tmdb_id, type, title, poster_path, magnet_url, torrent_url, direct_url } = req.body;
    if (!tmdb_id || !type || !title) {
      return res.status(400).json({ error: 'tmdb_id, type y title son requeridos' });
    }
    if (!magnet_url && !torrent_url && !direct_url) {
      return res.status(400).json({ error: 'Necesitas un enlace magnet, torrent o URL directa' });
    }
    const item = await addToQueue({ tmdb_id, type, title, poster_path, magnet_url, torrent_url, direct_url });
    res.status(201).json(item);
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
    const scan = await scanLibrary();
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
