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

  const res = await fetch(`${API}${url}`, { ...options, headers });
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
  getMovies: (params?: { search?: string; sort?: string }) => {
    const q = new URLSearchParams(params as Record<string, string>).toString();
    return request<import('./types').MediaItem[]>(`/library/movies?${q}`);
  },
  getSeries: (search?: string) => {
    const q = search ? `?search=${encodeURIComponent(search)}` : '';
    return request<import('./types').MediaItem[]>(`/library/series${q}`);
  },
  getMedia: (id: number) => request<import('./types').MediaItem>(`/library/${id}`),
  search: (q: string) => request<import('./types').SearchResult[]>(`/search/multi?q=${encodeURIComponent(q)}`),
  getPopular: (type: 'movie' | 'series', page = 1) =>
    request<import('./types').SearchResult[]>(`/search/popular/${type}?page=${page}`),
  getDetails: (type: string, id: number) => request<Record<string, unknown>>(`/search/details/${type}/${id}`),
  getDownloads: () => request<import('./types').DownloadItem[]>('/downloads'),
  addDownload: (data: Record<string, unknown>) =>
    request<import('./types').DownloadItem>('/downloads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  deleteDownload: (id: number) => request(`/downloads/${id}`, { method: 'DELETE' }),
  getSettings: () => request<import('./types').Settings>('/settings'),
  saveSettings: (data: Partial<import('./types').Settings>) =>
    request('/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  scanLibrary: () => request<{ added: number; updated: number; removed: number; total: number }>('/settings/scan', { method: 'POST' }),
  testJellyfin: () => request<{ ok: boolean; message: string }>('/integrations/jellyfin/test'),
  testPlex: () => request<{ ok: boolean; message: string }>('/integrations/plex/test'),
  syncJellyfin: () => request<{ matched: number; updated: number; errors: string[] }>('/integrations/jellyfin/sync', { method: 'POST' }),
  syncPlex: () => request<{ matched: number; updated: number; errors: string[] }>('/integrations/plex/sync', { method: 'POST' }),
  streamUrl: (id: number) => {
    const token = authToken ? `?token=${authToken}` : '';
    return `${API}/stream/${id}${token}`;
  },
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

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function formatDate(date: string | null): string {
  if (!date) return '';
  return new Date(date).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
}
