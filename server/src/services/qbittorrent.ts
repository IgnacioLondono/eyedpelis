import { getSettings } from '../config.js';

export interface QbSession {
  cookie: string;
  baseUrl: string;
}

export interface QbTorrent {
  hash: string;
  name: string;
  progress: number;
  dlspeed: number;
  upspeed: number;
  eta: number;
  size: number;
  state: string;
  content_path: string;
  save_path: string;
  magnet_uri?: string;
}

const COMPLETE_STATES = new Set([
  'uploading', 'stalledUP', 'pausedUP', 'queuedUP', 'checkingUP', 'forcedUP', 'moving',
]);

export function hashFromMagnetOrUrl(url: string): string | null {
  const match = url.match(/btih:([a-fA-F0-9]{40}|[a-zA-Z2-7]{32})/i);
  return match ? match[1].toLowerCase() : null;
}

export async function qbLogin(): Promise<QbSession | null> {
  const settings = getSettings();
  if (!settings.qbittorrent_url) return null;

  const baseUrl = settings.qbittorrent_url.replace(/\/+$/, '');
  try {
    const res = await fetch(`${baseUrl}/api/v2/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        username: settings.qbittorrent_user,
        password: settings.qbittorrent_pass,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const cookie = res.headers.get('set-cookie') || '';
    return { cookie, baseUrl };
  } catch {
    return null;
  }
}

async function qbFetch(session: QbSession, path: string, init?: RequestInit) {
  const res = await fetch(`${session.baseUrl}${path}`, {
    ...init,
    headers: {
      ...(init?.headers as Record<string, string>),
      Cookie: session.cookie,
    },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`qBittorrent HTTP ${res.status}`);
  return res;
}

export async function qbAddTorrent(session: QbSession, url: string): Promise<string | null> {
  const res = await qbFetch(session, '/api/v2/torrents/add', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ urls: url }),
  });
  if (!res.ok) throw new Error('Error al añadir torrent');
  return hashFromMagnetOrUrl(url);
}

export async function qbGetTorrent(session: QbSession, hash: string): Promise<QbTorrent | null> {
  const res = await qbFetch(session, `/api/v2/torrents/info?hashes=${hash}`);
  const data = (await res.json()) as QbTorrent[];
  return data[0] ?? null;
}

export async function qbFindRecentTorrent(session: QbSession, title: string): Promise<QbTorrent | null> {
  const res = await qbFetch(session, '/api/v2/torrents/info?sort=added_on&reverse=true&limit=15');
  const list = (await res.json()) as QbTorrent[];
  const norm = title.toLowerCase().slice(0, 20);
  return list.find(t => t.name.toLowerCase().includes(norm)) ?? list[0] ?? null;
}

export function isTorrentComplete(t: QbTorrent): boolean {
  return t.progress >= 0.999 || COMPLETE_STATES.has(t.state);
}

export function isTorrentFailed(t: QbTorrent): boolean {
  return t.state === 'missingFiles' || t.state === 'error';
}

export function isTorrentPaused(t: QbTorrent): boolean {
  return t.state.toLowerCase().includes('paused');
}

export function normalizeEta(eta: number): number | null {
  if (!Number.isFinite(eta) || eta <= 0 || eta >= 8640000) return null;
  return eta;
}
