const API = '/api';
const TOKEN_KEY = 'pelisweb_token';

let authToken: string | null = localStorage.getItem(TOKEN_KEY);

export function setAuthToken(token: string | null) {
  authToken = token;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function getAuthToken() {
  return authToken;
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    ...(options?.headers as Record<string, string>),
  };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

  let res: Response;
  try {
    res = await fetch(`${API}${url}`, { ...options, headers });
  } catch {
    throw new Error('No se pudo conectar con el servidor. Comprueba que Eyedpelis esté en marcha.');
  }
  if (res.status === 401) {
    if (authToken) {
      setAuthToken(null);
      window.location.reload();
    }
    const err = await res.json().catch(() => ({ error: 'No autenticado' }));
    throw new Error(err.error || 'No autenticado');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Error de red');
  }
  return res.json();
}

export interface LibraryFilterOptions {
  genres: string[];
  years: number[];
}

function libraryQuery(params?: { search?: string; genre?: string; year?: string; sort?: string }) {
  const q = new URLSearchParams();
  if (params?.search) q.set('search', params.search);
  if (params?.genre) q.set('genre', params.genre);
  if (params?.year) q.set('year', params.year);
  if (params?.sort) q.set('sort', params.sort);
  const qs = q.toString();
  return qs ? `?${qs}` : '';
}

export const api = {
  login: (username: string, password: string) =>
    request<{ token: string; username: string }>('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    }),
  authMe: () => request<{ enabled: boolean; username: string; authenticated?: boolean }>('/auth/me'),
  changePassword: (current: string, newPassword: string) =>
    request('/auth/password', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current, newPassword }),
    }),
  getStats: () => request<import('./types').LibraryStats>('/library/stats'),
  getMovies: (params?: { search?: string; genre?: string; year?: string; sort?: string }) =>
    request<import('./types').MediaItem[]>(`/library/movies${libraryQuery(params)}`),
  getSeries: (params?: { search?: string; genre?: string; year?: string; sort?: string }) =>
    request<import('./types').MediaItem[]>(`/library/series${libraryQuery(params)}`),
  getLibraryFilters: (type: 'movie' | 'series') =>
    request<LibraryFilterOptions>(`/library/filters/${type}`),
  getMedia: (id: number) => request<import('./types').MediaItem>(`/library/${id}`),
  search: (q: string) => request<import('./types').SearchResult[]>(`/search/multi?q=${encodeURIComponent(q)}`),
  getPopular: (type: 'movie' | 'series', page = 1) =>
    request<import('./types').SearchResult[]>(`/search/popular/${type}?page=${page}`),
  getDetails: (type: string, id: number) => request<Record<string, unknown>>(`/search/details/${type}/${id}`),
  getSeasonDetails: (seriesId: number, seasonNumber: number) =>
    request<import('./utils/tmdbHelpers').TmdbSeasonDetails>(`/search/season/${seriesId}/${seasonNumber}`),
  getDownloads: () => request<import('./types').DownloadItem[]>('/downloads'),
  searchTorrents: (params: { title: string; type: 'movie' | 'series'; year?: number; tmdb_id?: number; original_title?: string }) => {
    const q = new URLSearchParams();
    q.set('title', params.title);
    q.set('type', params.type);
    if (params.year) q.set('year', String(params.year));
    if (params.tmdb_id) q.set('tmdb_id', String(params.tmdb_id));
    if (params.original_title) q.set('original_title', params.original_title);
    return request<{
      results: import('./types').TorrentResult[];
      capabilities: Record<string, boolean>;
      sources: Record<string, { ok: boolean; count: number; error?: string }>;
    }>(`/downloads/search?${q.toString()}`);
  },
  testProwlarr: () => request<{ ok: boolean; message: string }>('/downloads/test/prowlarr'),
  testJackett: () => request<{ ok: boolean; message: string }>('/downloads/test/jackett'),
  testQbittorrent: () => request<{ ok: boolean; message: string }>('/downloads/test/qbittorrent'),
  addDownload: (data: Record<string, unknown>) =>
    request<import('./types').DownloadItem>('/downloads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  deleteDownload: (id: number) => request(`/downloads/${id}`, { method: 'DELETE' }),
  finalizeDownload: (id: number, folder: 'movies' | 'series', subfolder?: string) =>
    request<{ ok: boolean; path: string; scan: { added: number; updated: number; removed: number; total: number } }>(
      `/downloads/${id}/finalize`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder, subfolder }),
      },
    ),
  getSettings: () => request<import('./types').Settings>('/settings'),
  saveSettings: (data: Partial<import('./types').Settings>) =>
    request('/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  scanLibrary: (scope: import('./types').ScanScope = 'all') =>
    request<import('./types').ScanStatus & { started: boolean }>(`/settings/scan?scope=${scope}`, { method: 'POST' }),
  getSettingsScanStatus: () => request<import('./types').ScanStatus>('/settings/scan/status'),
  getFilesInfo: () =>
    request<{ mediaPath: string; moviesPath: string; seriesPath: string; readOnly: boolean; maxUploadBytes?: number }>(
      '/files/info',
    ),
  listFiles: (path = '') =>
    request<{ path: string; entries: Array<{
      name: string; path: string; type: 'file' | 'directory'; size: number;
      modified: string; extension: string | null; category: 'video' | 'subtitle' | 'other';
    }> }>(`/files?path=${encodeURIComponent(path)}`),
  mkdirFile: (path: string, name: string) =>
    request('/files/mkdir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, name }),
    }),
  renameFile: (path: string, newName: string) =>
    request<{ entry: unknown; scan: { added: number; updated: number; removed: number; total: number } }>(
      '/files/rename',
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, newName }),
      },
    ),
  deleteFile: (path: string) =>
    request<{ ok: boolean; scan: { added: number; updated: number; removed: number; total: number } }>(
      `/files?path=${encodeURIComponent(path)}`,
      { method: 'DELETE' },
    ),
  scanFilesLibrary: (scope: import('./types').ScanScope = 'all') =>
    request<import('./types').ScanStatus & { started: boolean }>(`/files/scan?scope=${scope}`, { method: 'POST' }),
  getFilesScanStatus: () => request<import('./types').ScanStatus>('/files/scan/status'),
  uploadFiles: (folderPath: string, files: File[], onProgress?: (percent: number) => void) =>
    new Promise<{
      entries: Array<{ name: string; path: string; size: number }>;
      scan: { added: number; updated: number; removed: number; total: number };
    }>((resolve, reject) => {
      const form = new FormData();
      for (const f of files) form.append('files', f);

      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API}/files/upload?path=${encodeURIComponent(folderPath)}`);
      if (authToken) xhr.setRequestHeader('Authorization', `Bearer ${authToken}`);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };

      xhr.onload = () => {
        if (xhr.status === 401) {
          setAuthToken(null);
          window.location.reload();
          reject(new Error('No autenticado'));
          return;
        }
        try {
          const data = JSON.parse(xhr.responseText) as { error?: string; entries?: unknown[]; scan?: unknown };
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(data as {
              entries: Array<{ name: string; path: string; size: number }>;
              scan: { added: number; updated: number; removed: number; total: number };
            });
          } else {
            reject(new Error(data.error || 'Error al subir'));
          }
        } catch {
          reject(new Error('Error al subir'));
        }
      };

      xhr.onerror = () => reject(new Error('Error de red'));
      xhr.send(form);
    }),
  reEnrichMetadata: () => request<{ enriched: number }>('/settings/re-enrich', { method: 'POST' }),
  testJellyfin: () => request<{ ok: boolean; message: string }>('/integrations/jellyfin/test'),
  testPlex: () => request<{ ok: boolean; message: string }>('/integrations/plex/test'),
  syncJellyfin: () => request<{ matched: number; updated: number; errors: string[] }>('/integrations/jellyfin/sync', { method: 'POST' }),
  syncPlex: () => request<{ matched: number; updated: number; errors: string[] }>('/integrations/plex/sync', { method: 'POST' }),
  streamUrl: (id: number) => {
    const token = authToken ? `?token=${authToken}` : '';
    return `${API}/stream/${id}${token}`;
  },
  compatStreamUrl: (id: number) => {
    const token = authToken ? `?token=${authToken}` : '';
    return `${API}/stream/${id}/compat${token}`;
  },
  compatAudioUrl: (id: number) => {
    const token = authToken ? `?token=${authToken}` : '';
    return `${API}/stream/${id}/compat-audio${token}`;
  },
  getStreamInfo: (id: number) =>
    request<{
      subtitles: Array<{ index?: number; label: string; language: string; embedded?: boolean }>;
      probe: {
        browserFriendlyAudio: boolean;
        needsCompatAudio?: boolean;
        recommendedAudioIndex: number;
        duration: number | null;
        audioTracks: Array<{ index: number; codec: string; codecLabel: string; language: string }>;
        videoCodecLabel: string | null;
      } | null;
    }>(`/stream/${id}/info`),
  subtitleUrl: (mediaId: number, index: number) => {
    const token = authToken ? `?token=${authToken}` : '';
    return `${API}/stream/${mediaId}/subtitle/${index}${token}`;
  },
};

export function posterUrl(path: string | null, size = 'w500'): string {
  if (!path) return '/placeholder-poster.svg';
  if (path.startsWith('http')) return path;
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

export function backdropUrl(path: string | null): string {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `https://image.tmdb.org/t/p/w1280${path}`;
}

export function stillUrl(path: string | null, size = 'w400'): string {
  if (!path) return '/placeholder-poster.svg';
  if (path.startsWith('http')) return path;
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function formatSpeed(bytesPerSec: number): string {
  return `${formatBytes(bytesPerSec)}/s`;
}

export function formatEta(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function formatDate(date: string | null): string {
  if (!date) return '';
  return new Date(date).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
}
