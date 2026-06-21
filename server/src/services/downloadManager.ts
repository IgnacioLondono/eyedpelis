import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  insertDownload, getDownloadById, getAllDownloads,
  updateDownloadRecord, deleteDownloadRecord,
} from '../db/database.js';
import { getSettings } from '../config.js';
import type { DownloadItem, MediaType } from '../types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INCOMING_DIR = path.join(__dirname, '../../data/incoming');

function ensureIncomingDir() {
  if (!fs.existsSync(INCOMING_DIR)) fs.mkdirSync(INCOMING_DIR, { recursive: true });
  return INCOMING_DIR;
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

export async function processQueue() {
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
  updateDownload(item.id, { status: 'downloading', progress: 0 });

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

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    if (total > 0) {
      updateDownload(item.id, { progress: Math.round((received / total) * 100) });
    }
  }

  const buffer = Buffer.concat(chunks);
  fs.writeFileSync(destPath, buffer);

  updateDownload(item.id, {
    status: 'awaiting_folder',
    progress: 100,
    download_path: destPath.replace(/\\/g, '/'),
    size_bytes: buffer.length,
  });
}

async function downloadViaQbittorrent(item: DownloadItem) {
  const settings = getSettings();
  if (!settings.qbittorrent_url) {
    throw new Error('qBittorrent no configurado. Añade la URL en Configuración.');
  }

  const loginRes = await fetch(`${settings.qbittorrent_url}/api/v2/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      username: settings.qbittorrent_user,
      password: settings.qbittorrent_pass,
    }),
  });

  if (!loginRes.ok) throw new Error('No se pudo conectar a qBittorrent');

  const cookies = loginRes.headers.get('set-cookie') || '';
  const url = item.magnet_url || item.torrent_url!;

  const addRes = await fetch(`${settings.qbittorrent_url}/api/v2/torrents/add`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: cookies,
    },
    body: new URLSearchParams({ urls: url }),
  });

  if (!addRes.ok) throw new Error('Error al añadir torrent a qBittorrent');

  updateDownload(item.id, { status: 'downloading', progress: 0 });
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
  });

  return destPath.replace(/\\/g, '/');
}

export function startDownloadProcessor() {
  setInterval(() => {
    processQueue().catch(console.error);
  }, 10000);
}
