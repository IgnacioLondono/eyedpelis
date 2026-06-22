import type { Settings } from './types.js';
import { getAllSettings, getSetting } from './db/database.js';

export function getSettings(): Settings {
  const all = getAllSettings();
  return {
    media_path: all.media_path || process.env.MEDIA_PATH || './media',
    movies_path: all.movies_path || process.env.MOVIES_PATH || 'Peliculas',
    series_path: all.series_path || process.env.SERIES_PATH || 'Series',
    tmdb_api_key: all.tmdb_api_key || '',
    scan_interval: all.scan_interval || '*/30 * * * *',
    auto_scan: all.auto_scan === 'true',
    qbittorrent_url: all.qbittorrent_url || '',
    qbittorrent_user: all.qbittorrent_user || '',
    qbittorrent_pass: all.qbittorrent_pass || '',
    jellyfin_url: all.jellyfin_url || '',
    jellyfin_api_key: all.jellyfin_api_key || '',
    plex_url: all.plex_url || '',
    plex_token: all.plex_token || '',
    prowlarr_url: all.prowlarr_url || process.env.PROWLARR_URL || '',
    prowlarr_api_key: all.prowlarr_api_key || process.env.PROWLARR_API_KEY || '',
    jackett_url: all.jackett_url || process.env.JACKETT_URL || '',
    jackett_api_key: all.jackett_api_key || process.env.JACKETT_API_KEY || '',
    auth_enabled: all.auth_enabled !== 'false',
  };
}

export function getMoviesPath(): string {
  const s = getSettings();
  return `${s.media_path}/${s.movies_path}`.replace(/\\/g, '/');
}

export function getSeriesPath(): string {
  const s = getSettings();
  return `${s.media_path}/${s.series_path}`.replace(/\\/g, '/');
}

export function getTmdbApiKey(): string {
  return getSetting('tmdb_api_key') || process.env.TMDB_API_KEY || '';
}

export { isMediaReadOnly } from './services/filesystem.js';
