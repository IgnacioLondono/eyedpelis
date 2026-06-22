import { Router } from 'express';
import { setSetting } from '../db/database.js';
import { scanLibrary, enrichMissingMetadata, runScanJob, scheduleBackgroundEnrich, type ScanScope } from '../services/scanner.js';
import { getScanStatus, isScanRunning } from '../services/scanState.js';

function parseScope(raw: unknown): ScanScope {
  if (raw === 'movie' || raw === 'series') return raw;
  return 'all';
}
import { getSettings } from '../config.js';

const router = Router();
const ALLOWED_KEYS = [
  'media_path', 'movies_path', 'series_path', 'tmdb_api_key',
  'scan_interval', 'auto_scan', 'qbittorrent_url', 'qbittorrent_user', 'qbittorrent_pass',
  'jellyfin_url', 'jellyfin_api_key', 'plex_url', 'plex_token', 'auth_enabled',
  'prowlarr_url', 'prowlarr_api_key', 'jackett_url', 'jackett_api_key',
];

const SECRET_KEYS = ['tmdb_api_key', 'jellyfin_api_key', 'plex_token', 'qbittorrent_pass', 'prowlarr_api_key', 'jackett_api_key'];

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

router.post('/scan', async (req, res) => {
  try {
    const scope = parseScope(req.query.scope);
    if (isScanRunning()) {
      return res.json({ started: false, ...getScanStatus() });
    }
    runScanJob(scope).catch(console.error);
    res.json({ started: true, ...getScanStatus() });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Error al escanear' });
  }
});

router.get('/scan/status', (_req, res) => {
  res.json(getScanStatus());
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
