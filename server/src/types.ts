export type MediaType = 'movie' | 'series';

export interface MediaItem {
  id: number;
  tmdb_id: number | null;
  type: MediaType;
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
  duration: number | null;
  season: number | null;
  episode: number | null;
  series_id: number | null;
  status: 'available' | 'downloading' | 'wanted';
  subtitles: SubtitleTrack[];
  created_at: string;
  updated_at: string;
}

export interface SubtitleTrack {
  path: string;
  label: string;
  language: string;
  format: 'srt' | 'vtt' | 'ass' | 'ssa';
  /** Subtítulo dentro del contenedor MKV/MP4 */
  embedded?: boolean;
  /** PGS/VobSub — no convertible a texto en el navegador */
  bitmap?: boolean;
  /** Índice de pista de subtítulo para ffmpeg (-map 0:s:N) */
  subIndex?: number;
  streamIndex?: number;
}

export interface DownloadItem {
  id: number;
  tmdb_id: number;
  type: MediaType;
  title: string;
  poster_path: string | null;
  magnet_url: string | null;
  torrent_url: string | null;
  direct_url: string | null;
  status: 'queued' | 'downloading' | 'completed' | 'failed' | 'paused' | 'awaiting_folder';
  progress: number;
  size_bytes: number | null;
  download_path: string | null;
  error_message: string | null;
  qb_hash: string | null;
  download_speed: number | null;
  eta_seconds: number | null;
  created_at: string;
  updated_at: string;
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

export interface TmdbSearchResult {
  id: number;
  type: MediaType;
  title: string;
  original_title?: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string | null;
  vote_average: number;
  genre_ids?: number[];
}

export interface LibraryStats {
  totalMovies: number;
  totalSeries: number;
  totalEpisodes: number;
  totalSize: number;
  activeDownloads: number;
}
