import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import cron from 'node-cron';
import libraryRoutes from './routes/library.js';
import searchRoutes from './routes/search.js';
import downloadRoutes from './routes/downloads.js';
import settingsRoutes from './routes/settings.js';
import streamRoutes from './routes/stream.js';
import authRoutes from './routes/auth.js';
import integrationRoutes from './routes/integrations.js';
import filesRoutes from './routes/files.js';
import { ensureMediaDirs, scanLibrary, scheduleBackgroundEnrich } from './services/scanner.js';
import { startDownloadProcessor } from './services/downloadManager.js';
import { getSetting, applyEnvDefaults } from './db/database.js';
import { initAuth, authMiddleware } from './services/auth.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = parseInt(process.env.PORT || '3001');

app.use(cors({
  origin: (origin, callback) => {
    const allowed = process.env.CLIENT_URL || 'http://localhost:5173';
    if (!origin || origin === allowed || origin.startsWith('http://192.168.') || origin.startsWith('http://10.')) {
      callback(null, true);
    } else {
      callback(null, allowed);
    }
  },
  credentials: true,
}));
app.use(express.json());

await initAuth();
applyEnvDefaults();

app.use('/api/auth', authRoutes);
app.use(authMiddleware);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/library', libraryRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/downloads', downloadRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/stream', streamRoutes);
app.use('/api/integrations', integrationRoutes);
app.use('/api/files', filesRoutes);

const clientDist = path.join(__dirname, '../../client/dist');
app.use(express.static(clientDist));
app.get('*', (_req, res) => {
  const indexPath = path.join(clientDist, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).json({ error: 'Frontend no compilado' });
  }
});

ensureMediaDirs();
startDownloadProcessor();

const scanInterval = getSetting('scan_interval') || '*/30 * * * *';
if (cron.validate(scanInterval)) {
  cron.schedule(scanInterval, () => {
    scanLibrary({ enrich: false })
      .then(r => {
        console.log(`Escaneo automático: +${r.added} ~${r.updated} -${r.removed}`);
        scheduleBackgroundEnrich();
      })
      .catch(console.error);
  });
}

app.listen(PORT, () => {
  const ro = process.env.MEDIA_READ_ONLY === 'true' ? ' [solo lectura]' : '';
  console.log(`👁️ Eyedpelis API en http://localhost:${PORT}${ro}`);
  console.log(`📁 Películas: ${process.env.MEDIA_PATH || './media'}/${process.env.MOVIES_PATH || 'Peliculas'}`);
  console.log(`📁 Series: ${process.env.MEDIA_PATH || './media'}/${process.env.SERIES_PATH || 'Series'}`);
  scanLibrary({ enrich: false })
    .then(r => {
      console.log(`Biblioteca inicial: ${r.total} archivos (${r.added} nuevos)`);
      scheduleBackgroundEnrich();
    })
    .catch(console.error);
});
