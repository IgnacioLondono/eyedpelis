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

function parseCookie(setCookie: string | null): string {
  if (!setCookie) return '';
  return setCookie.split(',').map(part => part.split(';')[0].trim()).filter(Boolean).join('; ');
}

export async function testQbittorrentConnection(): Promise<{ ok: boolean; message: string }> {
  const settings = getSettings();
  if (!settings.qbittorrent_url) {
    return { ok: false, message: 'QBITTORRENT_URL no configurado (env o Configuración)' };
  }

  const login = await qbLogin();
  if ('error' in login) {
    return { ok: false, message: login.error };
  }

  try {
    const res = await qbFetch(login.session, '/api/v2/app/version');
    const version = await res.text();
    return { ok: true, message: `Conectado · qBittorrent v${version.trim()}` };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Error tras login' };
  }
}

export async function qbLogin(): Promise<{ session: QbSession } | { error: string }> {
  const settings = getSettings();
  if (!settings.qbittorrent_url) {
    return { error: 'qBittorrent URL vacía. Configura QBITTORRENT_URL en Docker o en Ajustes.' };
  }

  const baseUrl = settings.qbittorrent_url.replace(/\/+$/, '');
  try {
    const res = await fetch(`${baseUrl}/api/v2/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        username: settings.qbittorrent_user || 'admin',
        password: settings.qbittorrent_pass || '',
      }),
      signal: AbortSignal.timeout(8000),
    });

    const body = (await res.text()).trim();
    if (!res.ok) {
      if (res.status === 401) {
        return {
          error: 'qBittorrent rechazó el login (401). Añade QBITTORRENT_USER y QBITTORRENT_PASS en Portainer (deben coincidir con la Web UI en :18787) y redeploy.',
        };
      }
      return { error: `qBittorrent HTTP ${res.status} en ${baseUrl}` };
    }
    if (body === 'Fails.') {
      return { error: 'Usuario o contraseña de qBittorrent incorrectos' };
    }
    if (body !== 'Ok.') {
      return { error: `Respuesta inesperada de qBittorrent: ${body.slice(0, 80)}` };
    }

    const cookie = parseCookie(res.headers.get('set-cookie'));
    if (!cookie) {
      return { error: 'qBittorrent no devolvió cookie de sesión (revisa Web UI → Host header validation)' };
    }

    return { session: { cookie, baseUrl } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error de red';
    if (msg.includes('fetch failed') || msg.includes('ECONNREFUSED') || msg.includes('ENOTFOUND')) {
      return {
        error: `No se puede alcanzar ${baseUrl}. Usa el nombre del contenedor en la red Docker (ej. http://qbittorrent:8080), no el puerto del host (8787).`,
      };
    }
    return { error: msg };
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
