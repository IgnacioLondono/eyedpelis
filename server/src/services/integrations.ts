import { findMedia, updateMedia } from '../db/database.js';
import { getSettings } from '../config.js';
import type { MediaItem } from '../types.js';

interface SyncResult {
  source: 'jellyfin' | 'plex';
  matched: number;
  updated: number;
  errors: string[];
}

export async function testJellyfinConnection(): Promise<{ ok: boolean; message: string }> {
  const s = getSettings();
  if (!s.jellyfin_url || !s.jellyfin_api_key) {
    return { ok: false, message: 'URL o API key de Jellyfin no configurados' };
  }
  try {
    const res = await fetch(`${s.jellyfin_url.replace(/\/$/, '')}/System/Info`, {
      headers: { 'X-Emby-Token': s.jellyfin_api_key },
    });
    if (!res.ok) return { ok: false, message: `Error HTTP ${res.status}` };
    const info = await res.json() as { ServerName?: string };
    return { ok: true, message: `Conectado a ${info.ServerName || 'Jellyfin'}` };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Error de conexión' };
  }
}

export async function testPlexConnection(): Promise<{ ok: boolean; message: string }> {
  const s = getSettings();
  if (!s.plex_url || !s.plex_token) {
    return { ok: false, message: 'URL o token de Plex no configurados' };
  }
  try {
    const res = await fetch(`${s.plex_url.replace(/\/$/, '')}/`, {
      headers: { 'X-Plex-Token': s.plex_token, Accept: 'application/json' },
    });
    if (!res.ok) return { ok: false, message: `Error HTTP ${res.status}` };
    return { ok: true, message: 'Conectado a Plex' };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Error de conexión' };
  }
}

async function fetchJellyfinItems(): Promise<Array<{ Name: string; Overview?: string; ProductionYear?: number; CommunityRating?: number; ImageTags?: { Primary?: string }; ProviderIds?: { Tmdb?: string } }>> {
  const s = getSettings();
  const base = s.jellyfin_url.replace(/\/$/, '');

  const usersRes = await fetch(`${base}/Users`, {
    headers: { 'X-Emby-Token': s.jellyfin_api_key },
  });
  if (!usersRes.ok) throw new Error('No se pudo obtener usuarios de Jellyfin');
  const users = await usersRes.json() as Array<{ Id: string }>;
  const userId = users[0]?.Id;
  if (!userId) throw new Error('No hay usuarios en Jellyfin');

  const items: Array<{ Name: string; Overview?: string; ProductionYear?: number; CommunityRating?: number; ImageTags?: { Primary?: string }; ProviderIds?: { Tmdb?: string } }> = [];
  let startIndex = 0;
  const limit = 100;

  while (true) {
    const res = await fetch(
      `${base}/Users/${userId}/Items?Recursive=true&IncludeItemTypes=Movie,Series,Episode&Fields=Overview,ProviderIds,CommunityRating&StartIndex=${startIndex}&Limit=${limit}`,
      { headers: { 'X-Emby-Token': s.jellyfin_api_key } },
    );
    if (!res.ok) throw new Error(`Jellyfin items error: ${res.status}`);
    const data = await res.json() as { Items: typeof items; TotalRecordCount: number };
    items.push(...data.Items);
    startIndex += limit;
    if (startIndex >= data.TotalRecordCount) break;
  }
  return items;
}

async function fetchPlexItems(): Promise<Array<{ title: string; summary?: string; year?: number; rating?: number; thumb?: string; guid?: string }>> {
  const s = getSettings();
  const base = s.plex_url.replace(/\/$/, '');

  const sectionsRes = await fetch(`${base}/library/sections`, {
    headers: { 'X-Plex-Token': s.plex_token, Accept: 'application/json' },
  });
  if (!sectionsRes.ok) throw new Error('No se pudo obtener secciones de Plex');
  const sectionsData = await sectionsRes.json() as { MediaContainer?: { Directory?: Array<{ key: string }> } };
  const sections = sectionsData.MediaContainer?.Directory || [];

  const items: Array<{ title: string; summary?: string; year?: number; rating?: number; thumb?: string; guid?: string }> = [];

  for (const section of sections) {
    const res = await fetch(`${base}/library/sections/${section.key}/all`, {
      headers: { 'X-Plex-Token': s.plex_token, Accept: 'application/json' },
    });
    if (!res.ok) continue;
    const data = await res.json() as { MediaContainer?: { Metadata?: Array<{ title: string; summary?: string; year?: number; rating?: number; thumb?: string; guid?: string }> } };
    items.push(...(data.MediaContainer?.Metadata || []));
  }
  return items;
}

function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9áéíóúñ]/gi, '').trim();
}

function applyMetadata(media: MediaItem, meta: { overview?: string; year?: number; rating?: number; tmdbId?: number; posterUrl?: string }) {
  const updates: Partial<MediaItem> = {};
  if (meta.overview && !media.overview) updates.overview = meta.overview;
  if (meta.year && !media.release_date) updates.release_date = `${meta.year}-01-01`;
  if (meta.rating && !media.vote_average) updates.vote_average = meta.rating;
  if (meta.tmdbId && !media.tmdb_id) updates.tmdb_id = meta.tmdbId;
  if (Object.keys(updates).length > 0) {
    updateMedia(media.id, updates);
    return true;
  }
  return false;
}

export async function syncFromJellyfin(): Promise<SyncResult> {
  const result: SyncResult = { source: 'jellyfin', matched: 0, updated: 0, errors: [] };
  try {
    const items = await fetchJellyfinItems();
    const library = findMedia(m => !!m.file_path || (!m.file_path && m.type === 'series'));

    for (const lib of library) {
      const normalized = normalizeTitle(lib.title);
      const match = items.find(i => normalizeTitle(i.Name) === normalized || normalizeTitle(i.Name).includes(normalized));
      if (!match) continue;
      result.matched++;
      const updated = applyMetadata(lib, {
        overview: match.Overview,
        year: match.ProductionYear,
        rating: match.CommunityRating,
        tmdbId: match.ProviderIds?.Tmdb ? parseInt(match.ProviderIds.Tmdb) : undefined,
      });
      if (updated) result.updated++;
    }
  } catch (err) {
    result.errors.push(err instanceof Error ? err.message : 'Error desconocido');
  }
  return result;
}

export async function syncFromPlex(): Promise<SyncResult> {
  const result: SyncResult = { source: 'plex', matched: 0, updated: 0, errors: [] };
  try {
    const items = await fetchPlexItems();
    const library = findMedia(m => !!m.file_path || (!m.file_path && m.type === 'series'));

    for (const lib of library) {
      const normalized = normalizeTitle(lib.title);
      const match = items.find(i => normalizeTitle(i.title) === normalized || normalizeTitle(i.title).includes(normalized));
      if (!match) continue;
      result.matched++;
      const tmdbMatch = match.guid?.match(/tmdb:\/\/(\d+)/);
      const updated = applyMetadata(lib, {
        overview: match.summary,
        year: match.year,
        rating: match.rating,
        tmdbId: tmdbMatch ? parseInt(tmdbMatch[1]) : undefined,
      });
      if (updated) result.updated++;
    }
  } catch (err) {
    result.errors.push(err instanceof Error ? err.message : 'Error desconocido');
  }
  return result;
}
