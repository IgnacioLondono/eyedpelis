import fs from 'fs';
import path from 'path';
import {
  insertDownload, getDownloadById, getAllDownloads,
  updateDownloadRecord, deleteDownloadRecord,
} from '../db/database.js';
import { getSettings, isMediaReadOnly } from '../config.js';
import type { DownloadItem, MediaType } from '../types.js';

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
  deleteDownloadRecord(id);
}

export { getDownloadById, getAllDownloads };

export async function processQueue() {
  if (isMediaReadOnly()) return;

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

  const settings = getSettings();
  const destDir = item.type === 'movie'
    ? path.join(settings.media_path, settings.movies_path)
    : path.join(settings.media_path, settings.series_path);

  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

  const safeName = item.title.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ\s.-]/g, '').trim();
  const ext = path.extname(new URL(item.direct_url!).pathname) || '.mp4';
  const destPath = path.join(destDir, `${safeName}${ext}`);

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
    status: 'completed',
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

export function startDownloadProcessor() {
  setInterval(() => {
    processQueue().catch(console.error);
  }, 10000);
}
