export interface SubtitleTrack {
  path: string;
  label: string;
  language: string;
  format: string;
  embedded?: boolean;
}

export interface MediaItem {
  id: number;
  tmdb_id: number | null;
  type: 'movie' | 'series';
  title: string;
  original_title: string | null;
  overview: string | null;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string | null;
  vote_average: number | null;
  genres: string | null;
  file_path: string | null;
  file_size: number | null;
  season: number | null;
  episode: number | null;
  series_id: number | null;
  status: string;
  subtitles?: SubtitleTrack[];
  episodes?: MediaItem[];
  episodeCount?: number;
}

export interface SearchResult {
  id: number;
  type: 'movie' | 'series';
  title: string;
  original_title?: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string | null;
  vote_average: number;
}

export interface DownloadItem {
  id: number;
  tmdb_id: number;
  type: 'movie' | 'series';
  title: string;
  poster_path: string | null;
  status: string;
  progress: number;
  size_bytes: number | null;
  download_path?: string | null;
  error_message: string | null;
  download_speed?: number | null;
  eta_seconds?: number | null;
  created_at: string;
  updated_at?: string;
}

export interface TorrentResult {
  title: string;
  magnet_url: string | null;
  torrent_url: string | null;
  size_bytes: number;
  seeders: number;
  leechers: number;
  source: string;
  score: number;
}

export interface LibraryStats {
  totalMovies: number;
  totalSeries: number;
  totalEpisodes: number;
  totalSize: number;
  activeDownloads: number;
}

export interface Settings {
  media_path: string;
  movies_path: string;
  series_path: string;
  tmdb_api_key: string;
  scan_interval: string;
  auto_scan: boolean;
  qbittorrent_url: string;
  qbittorrent_user: string;
  qbittorrent_pass: string;
  jellyfin_url: string;
  jellyfin_api_key: string;
  plex_url: string;
  plex_token: string;
  prowlarr_url: string;
  prowlarr_api_key: string;
  jackett_url: string;
  jackett_api_key: string;
  auth_enabled: boolean;
}

export interface ScanResult {
  added: number;
  updated: number;
  removed: number;
  total: number;
}

export interface ScanStatus {
  running: boolean;
  phase: 'idle' | 'indexing' | 'enriching' | 'done';
  current: number;
  total: number;
  message: string;
  result: ScanResult | null;
  enrichCount: number;
  error: string | null;
  started?: boolean;
}
