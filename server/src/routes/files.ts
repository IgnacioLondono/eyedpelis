import { Router } from 'express';
import { getSettings } from '../config.js';
import {
  createDirectory,
  deleteEntry,
  getMediaRoot,
  isMediaReadOnly,
  listDirectory,
  renameEntry,
} from '../services/filesystem.js';
import { scanLibrary } from '../services/scanner.js';

const router = Router();

router.get('/info', (_req, res) => {
  const s = getSettings();
  res.json({
    mediaPath: s.media_path,
    moviesPath: s.movies_path,
    seriesPath: s.series_path,
    readOnly: isMediaReadOnly(),
    root: getMediaRoot(),
  });
});

router.get('/', (req, res) => {
  try {
    const rel = typeof req.query.path === 'string' ? req.query.path : '';
    res.json(listDirectory(rel));
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Error al listar' });
  }
});

router.post('/mkdir', (req, res) => {
  try {
    const { path: rel = '', name } = req.body as { path?: string; name?: string };
    if (!name?.trim()) return res.status(400).json({ error: 'Nombre requerido' });
    const entry = createDirectory(rel, name);
    res.json(entry);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Error al crear carpeta' });
  }
});

router.put('/rename', async (req, res) => {
  try {
    const { path: rel, newName } = req.body as { path?: string; newName?: string };
    if (!rel || !newName?.trim()) return res.status(400).json({ error: 'Ruta y nombre requeridos' });
    const entry = renameEntry(rel, newName);
    const scan = await scanLibrary();
    res.json({ entry, scan });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Error al renombrar' });
  }
});

router.delete('/', async (req, res) => {
  try {
    const rel = typeof req.query.path === 'string' ? req.query.path : '';
    if (!rel) return res.status(400).json({ error: 'Ruta requerida' });

    deleteEntry(rel);
    const scan = await scanLibrary();

    res.json({ ok: true, scan });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Error al eliminar' });
  }
});

router.post('/scan', async (_req, res) => {
  try {
    const scan = await scanLibrary();
    res.json(scan);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Error al escanear' });
  }
});

export default router;
