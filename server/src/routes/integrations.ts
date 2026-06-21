import { Router } from 'express';
import { testJellyfinConnection, testPlexConnection, syncFromJellyfin, syncFromPlex } from '../services/integrations.js';

const router = Router();

router.get('/jellyfin/test', async (_req, res) => {
  res.json(await testJellyfinConnection());
});

router.get('/plex/test', async (_req, res) => {
  res.json(await testPlexConnection());
});

router.post('/jellyfin/sync', async (_req, res) => {
  try {
    res.json(await syncFromJellyfin());
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Error' });
  }
});

router.post('/plex/sync', async (_req, res) => {
  try {
    res.json(await syncFromPlex());
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Error' });
  }
});

export default router;
