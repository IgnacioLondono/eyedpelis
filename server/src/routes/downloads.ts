import { Router } from 'express';
import { addToQueue, getAllDownloads, deleteDownload, updateDownload } from '../services/downloadManager.js';
import { isMediaReadOnly } from '../config.js';

const router = Router();

router.get('/', (_req, res) => {
  res.json(getAllDownloads());
});

router.post('/', async (req, res) => {
  if (isMediaReadOnly()) {
    return res.status(403).json({ error: 'Biblioteca en solo lectura. Las descargas están desactivadas para proteger tus archivos.' });
  }
  try {
    const { tmdb_id, type, title, poster_path, magnet_url, torrent_url, direct_url } = req.body;
    if (!tmdb_id || !type || !title) {
      return res.status(400).json({ error: 'tmdb_id, type y title son requeridos' });
    }
    const item = await addToQueue({ tmdb_id, type, title, poster_path, magnet_url, torrent_url, direct_url });
    res.status(201).json(item);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Error' });
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
