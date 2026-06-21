import { Router } from 'express';
import { setSetting } from '../db/database.js';
import { scanLibrary, enrichMissingMetadata } from '../services/scanner.js';
import { getSettings } from '../config.js';

const router = Router();
const ALLOWED_KEYS = [
  'media_path', 'movies_path', 'series_path', 'tmdb_api_key',
  'scan_interval', 'auto_scan', 'qbittorrent_url', 'qbittorrent_user', 'qbittorrent_pass',
  'jellyfin_url', 'jellyfin_api_key', 'plex_url', 'plex_token', 'auth_enabled',
];

const SECRET_KEYS = ['tmdb_api_key', 'jellyfin_api_key', 'plex_token', 'qbittorrent_pass'];

router.get('/', (_req, res) => {
  const settings = getSettings();
  const masked = { ...settings } as Record<string, unknown>;
  for (const key of SECRET_KEYS) {
    if (masked[key]) masked[key] = '••••••••';
  }
  res.json(masked);
});

router.put('/', (req, res) => {
  for (const key of ALLOWED_KEYS) {
    if (req.body[key] !== undefined && req.body[key] !== '••••••••') {
      setSetting(key, String(req.body[key]));
    }
  }
  res.json({ ok: true });
});

router.post('/scan', async (_req, res) => {
  try {
    const result = await scanLibrary();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Error al escanear' });
  }
});

router.post('/re-enrich', async (_req, res) => {
  try {
    const enriched = await enrichMissingMetadata();
    res.json({ enriched });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Error al actualizar metadatos' });
  }
});

export default router;
