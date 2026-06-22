import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  insertDownload, getDownloadById, getAllDownloads,
  updateDownloadRecord, deleteDownloadRecord,
} from '../db/database.js';
import { getSettings } from '../config.js';
import type { DownloadItem, MediaType } from '../types.js';
import {
  hashFromMagnetOrUrl,
  isTorrentComplete,
  isTorrentFailed,
  isTorrentPaused,
  normalizeEta,
  qbAddTorrent,
  qbFindRecentTorrent,
  qbGetTorrent,
  qbLogin,
  type QbTorrent,
} from './qbittorrent.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INCOMING_DIR = path.join(__dirname, '../../data/incoming');

const VIDEO_EXT = new Set(['.mkv', '.mp4', '.avi', '.mov', '.wmv', '.m4v', '.webm', '.ts', '.m2ts']);

function ensureIncomingDir() {
  if (!fs.existsSync(INCOMING_DIR)) fs.mkdirSync(INCOMING_DIR, { recursive: true });
  return INCOMING_DIR;
}

function emptyDownloadFields() {
  return {
    qb_hash: null as string | null,
    download_speed: null as number | null,
    eta_seconds: null as number | null,
  };
}

export async function addToQueue(params: {
  tmdb_id: number;
  type: MediaType;
  title: string;
  poster_path?: string | null;
  magnet_url?: string;
  torrent_url?: string;
  direct_url?: string;
}): Promise<DownloadItem> {
  return insertDownload({
    tmdb_id: params.tmdb_id,
    type: params.type,
    title: params.title,
    poster_path: params.poster_path ?? null,
    magnet_url: params.magnet_url ?? null,
    torrent_url: params.torrent_url ?? null,
    direct_url: params.direct_url ?? null,
    status: 'queued',
    progress: 0,
    size_bytes: null,
    download_path: null,
    error_message: null,
    ...emptyDownloadFields(),
  });
}

export function updateDownload(id: number, fields: Partial<DownloadItem>) {
  updateDownloadRecord(id, fields);
}

export function deleteDownload(id: number) {
  const item = getDownloadById(id);
  if (item?.download_path && item.status === 'awaiting_folder' && fs.existsSync(item.download_path)) {
    try { fs.unlinkSync(item.download_path); } catch { /* ignore */ }
  }
  deleteDownloadRecord(id);
}

export { getDownloadById, getAllDownloads };

function findLargestVideo(dir: string): string | null {
  const best = { path: null as string | null, size: 0 };

  function walk(current: string) {
    for (const name of fs.readdirSync(current)) {
      const full = path.join(current, name);
      let stat: fs.Stats;
      try { stat = fs.statSync(full); } catch { continue; }
      if (stat.isDirectory()) walk(full);
      else if (VIDEO_EXT.has(path.extname(name).toLowerCase())) {
        if (stat.size > best.size) {
          best.size = stat.size;
          best.path = full;
        }
      }
    }
  }

  walk(dir);
  return best.path ? best.path.replace(/\\/g, '/') : null;
}

function resolveTorrentPath(t: QbTorrent): string | null {
  const contentPath = t.content_path;
  if (!contentPath || !fs.existsSync(contentPath)) return null;

  const stat = fs.statSync(contentPath);
  if (stat.isFile()) return contentPath.replace(/\\/g, '/');
  return findLargestVideo(contentPath);
}

function applyTorrentState(item: DownloadItem, t: QbTorrent) {
  const progress = Math.min(100, Math.round(t.progress * 100));
  const updates: Partial<DownloadItem> = {
    progress,
    size_bytes: t.size,
    download_speed: t.dlspeed > 0 ? t.dlspeed : null,
    eta_seconds: normalizeEta(t.eta),
    qb_hash: t.hash.toLowerCase(),
  };

  if (isTorrentFailed(t)) {
    updates.status = 'failed';
    updates.error_message = `qBittorrent: ${t.state}`;
    updates.download_speed = null;
    updates.eta_seconds = null;
  } else if (isTorrentComplete(t)) {
    const filePath = resolveTorrentPath(t);
    if (filePath) {
      updates.status = 'awaiting_folder';
      updates.progress = 100;
      updates.download_path = filePath;
      updates.download_speed = null;
      updates.eta_seconds = null;
    } else {
      updates.status = 'downloading';
      updates.progress = 100;
      updates.error_message = null;
    }
  } else if (isTorrentPaused(t)) {
    updates.status = 'paused';
  } else {
    updates.status = 'downloading';
    updates.error_message = null;
  }

  updateDownload(item.id, updates);
}

export async function syncActiveDownloads() {
  const settings = getSettings();
  const active = getAllDownloads().filter(d =>
    (d.status === 'downloading' || d.status === 'paused') &&
    (d.magnet_url || d.torrent_url),
  );
  if (!active.length || !settings.qbittorrent_url) return;

  const session = await qbLogin();
  if (!session) return;

  for (const item of active) {
    try {
      let hash = item.qb_hash || hashFromMagnetOrUrl(item.magnet_url || item.torrent_url || '');
      let torrent: QbTorrent | null = null;

      if (hash) torrent = await qbGetTorrent(session, hash);
      if (!torrent) torrent = await qbFindRecentTorrent(session, item.title);
      if (!torrent) continue;

      applyTorrentState(item, torrent);
    } catch (err) {
      console.error(`[sync download ${item.id}]`, err);
    }
  }
}

export async function processQueue() {
  await syncActiveDownloads();

  const queued = getAllDownloads().filter(d => d.status === 'queued').slice(0, 3);

  for (const item of queued) {
    try {
      if (item.direct_url) {
        await downloadDirect(item);
      } else if (item.magnet_url || item.torrent_url) {
        await downloadViaQbittorrent(item);
      } else {
        updateDownload(item.id, { status: 'failed', error_message: 'No hay URL de descarga configurada' });
      }
    } catch (err) {
      updateDownload(item.id, {
        status: 'failed',
        error_message: err instanceof Error ? err.message : 'Error desconocido',
      });
    }
  }
}

async function downloadDirect(item: DownloadItem) {
  updateDownload(item.id, { status: 'downloading', progress: 0, download_speed: null, eta_seconds: null });

  ensureIncomingDir();
  const safeName = item.title.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ\s.-]/g, '').trim() || 'descarga';
  const ext = path.extname(new URL(item.direct_url!).pathname) || '.mp4';
  const destPath = path.join(INCOMING_DIR, `${item.id}_${safeName}${ext}`);

  const response = await fetch(item.direct_url!);
  if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);

  const total = parseInt(response.headers.get('content-length') || '0');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  const started = Date.now();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;

    const elapsed = (Date.now() - started) / 1000;
    const speed = elapsed > 0 ? Math.round(received / elapsed) : null;
    const eta = total > 0 && speed ? Math.round((total - received) / speed) : null;

    updateDownload(item.id, {
      progress: total > 0 ? Math.round((received / total) * 100) : 0,
      size_bytes: total > 0 ? total : received,
      download_speed: speed,
      eta_seconds: eta,
    });
  }

  const buffer = Buffer.concat(chunks);
  fs.writeFileSync(destPath, buffer);

  updateDownload(item.id, {
    status: 'awaiting_folder',
    progress: 100,
    download_path: destPath.replace(/\\/g, '/'),
    size_bytes: buffer.length,
    download_speed: null,
    eta_seconds: null,
  });
}

async function downloadViaQbittorrent(item: DownloadItem) {
  const session = await qbLogin();
  if (!session) throw new Error('qBittorrent no configurado o no responde. Revisa Configuración.');

  const url = item.magnet_url || item.torrent_url!;
  const hash = await qbAddTorrent(session, url);

  updateDownload(item.id, {
    status: 'downloading',
    progress: 0,
    qb_hash: hash,
    download_speed: null,
    eta_seconds: null,
    error_message: null,
  });

  if (hash) {
    const t = await qbGetTorrent(session, hash);
    if (t) applyTorrentState(item, t);
  }
}

function moveFile(src: string, dest: string) {
  try {
    fs.renameSync(src, dest);
  } catch {
    fs.copyFileSync(src, dest);
    fs.unlinkSync(src);
  }
}

export async function finalizeDownload(
  id: number,
  folder: 'movies' | 'series',
  subfolder?: string,
): Promise<string> {
  const item = getDownloadById(id);
  if (!item) throw new Error('Descarga no encontrada');
  if (item.status !== 'awaiting_folder') throw new Error('Esta descarga no está pendiente de ubicación');
  if (!item.download_path || !fs.existsSync(item.download_path)) {
    throw new Error('Archivo descargado no encontrado');
  }

  const settings = getSettings();
  const baseDir = folder === 'movies'
    ? path.join(settings.media_path, settings.movies_path)
    : path.join(settings.media_path, settings.series_path);

  const cleanSub = subfolder?.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ\s._-]/g, '').trim();
  const destDir = cleanSub ? path.join(baseDir, cleanSub) : baseDir;

  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

  const filename = path.basename(item.download_path);
  const destPath = path.join(destDir, filename);

  try {
    moveFile(item.download_path, destPath);
  } catch (err) {
    const code = err && typeof err === 'object' && 'code' in err ? String((err as NodeJS.ErrnoException).code) : '';
    if (code === 'EROFS' || code === 'EACCES') {
      throw new Error('No se puede escribir en la biblioteca (solo lectura). Quita :ro del volumen de videos en Docker.');
    }
    throw err;
  }

  updateDownload(item.id, {
    status: 'completed',
    download_path: destPath.replace(/\\/g, '/'),
    download_speed: null,
    eta_seconds: null,
  });

  return destPath.replace(/\\/g, '/');
}

export function startDownloadProcessor() {
  setInterval(() => {
    processQueue().catch(console.error);
  }, 3000);
}
