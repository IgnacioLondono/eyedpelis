import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { getSettings } from '../config.js';
import {
  assertUploadTarget,
  createDirectory,
  deleteEntry,
  entryFromAbsolute,
  getMediaRoot,
  isMediaReadOnly,
  listDirectory,
  MAX_UPLOAD_BYTES,
  renameEntry,
  sanitizeUploadFilename,
  UPLOAD_ALLOWED_EXT,
} from '../services/filesystem.js';
import { scanLibrary, scheduleBackgroundEnrich, runScanJob, type ScanScope } from '../services/scanner.js';
import { getScanStatus, isScanRunning } from '../services/scanState.js';

function parseScope(raw: unknown): ScanScope {
  if (raw === 'movie' || raw === 'series') return raw;
  return 'all';
}

const router = Router();

router.get('/info', (_req, res) => {
  const s = getSettings();
  res.json({
    mediaPath: s.media_path,
    moviesPath: s.movies_path,
    seriesPath: s.series_path,
    readOnly: isMediaReadOnly(),
    root: getMediaRoot(),
    maxUploadBytes: MAX_UPLOAD_BYTES,
    allowedExtensions: [...UPLOAD_ALLOWED_EXT],
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

router.post('/upload', (req, res) => {
  const rel = typeof req.query.path === 'string' ? req.query.path : '';

  let destDir: string;
  try {
    destDir = assertUploadTarget(rel);
  } catch (err) {
    return res.status(400).json({ error: err instanceof Error ? err.message : 'Destino no válido' });
  }

  const upload = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, destDir),
      filename: (_req, file, cb) => {
        try {
          const name = sanitizeUploadFilename(file.originalname);
          const full = path.join(destDir, name);
          if (fs.existsSync(full)) {
            cb(new Error(`Ya existe un archivo llamado "${name}"`), '');
            return;
          }
          cb(null, name);
        } catch (err) {
          cb(err instanceof Error ? err : new Error('Nombre no válido'), '');
        }
      },
    }),
    limits: { fileSize: MAX_UPLOAD_BYTES, files: 10 },
  }).array('files', 10);

  upload(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      const msg = err.code === 'LIMIT_FILE_SIZE'
        ? `Archivo demasiado grande (máx. ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024 / 1024)} GB)`
        : err.message;
      return res.status(400).json({ error: msg });
    }
    if (err) {
      return res.status(400).json({ error: err instanceof Error ? err.message : 'Error al subir' });
    }

    const uploaded = (req.files as Express.Multer.File[] | undefined) || [];
    if (uploaded.length === 0) {
      return res.status(400).json({ error: 'No se recibieron archivos' });
    }

    try {
      const entries = uploaded.map(f => entryFromAbsolute(f.path));
      const scan = await scanLibrary({ enrich: false });
      scheduleBackgroundEnrich();
      res.status(201).json({ entries, scan });
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : 'Error post-subida' });
    }
  });
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
    const scan = await scanLibrary({ enrich: false });
    scheduleBackgroundEnrich();
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
    const scan = await scanLibrary({ enrich: false });
    scheduleBackgroundEnrich();

    res.json({ ok: true, scan });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Error al eliminar' });
  }
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

export default router;
