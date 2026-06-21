import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { MediaItem, DownloadItem } from '../types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '../../data/peliculas.json');

interface DbData {
  media: MediaItem[];
  downloads: DownloadItem[];
  settings: Record<string, string>;
  nextMediaId: number;
  nextDownloadId: number;
}

let data: DbData;

function defaultData(): DbData {
  const defaults: Record<string, string> = {
    media_path: process.env.MEDIA_PATH || './media',
    movies_path: process.env.MOVIES_PATH || 'Peliculas',
    series_path: process.env.SERIES_PATH || 'Series',
    tmdb_api_key: process.env.TMDB_API_KEY || '',
    scan_interval: process.env.SCAN_INTERVAL || '*/30 * * * *',
    auto_scan: 'true',
    qbittorrent_url: '',
    qbittorrent_user: '',
    qbittorrent_pass: '',
    jellyfin_url: '',
    jellyfin_api_key: '',
    plex_url: '',
    plex_token: '',
    auth_enabled: process.env.AUTH_ENABLED ?? 'true',
  };
  return { media: [], downloads: [], settings: defaults, nextMediaId: 1, nextDownloadId: 1 };
}

function load(): DbData {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(dbPath)) {
    const d = defaultData();
    save(d);
    return d;
  }
  return JSON.parse(fs.readFileSync(dbPath, 'utf-8')) as DbData;
}

function save(d: DbData = data) {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(dbPath, JSON.stringify(d, null, 2));
}

export function getDb(): DbData {
  if (!data) data = load();
  return data;
}

export function persist() {
  save();
}

export function getSetting(key: string): string {
  return getDb().settings[key] ?? '';
}

export function setSetting(key: string, value: string) {
  getDb().settings[key] = value;
  persist();
}

export function getAllSettings(): Record<string, string> {
  return { ...getDb().settings };
}

export function insertMedia(item: Omit<MediaItem, 'id' | 'created_at' | 'updated_at'>): MediaItem {
  const db = getDb();
  const now = new Date().toISOString();
  const media: MediaItem = {
    ...item,
    id: db.nextMediaId++,
    created_at: now,
    updated_at: now,
  };
  db.media.push(media);
  persist();
  return media;
}

export function updateMedia(id: number, fields: Partial<MediaItem>) {
  const db = getDb();
  const idx = db.media.findIndex(m => m.id === id);
  if (idx === -1) return;
  db.media[idx] = { ...db.media[idx], ...fields, updated_at: new Date().toISOString() };
  persist();
}

export function deleteMediaByPath(filePath: string) {
  const db = getDb();
  db.media = db.media.filter(m => m.file_path !== filePath);
  persist();
}

export function findMedia(query: (m: MediaItem) => boolean): MediaItem[] {
  return getDb().media.filter(query);
}

export function getMediaById(id: number): MediaItem | undefined {
  const item = getDb().media.find(m => m.id === id);
  if (item && !item.subtitles) item.subtitles = [];
  return item;
}

export function getMediaByPath(filePath: string): MediaItem | undefined {
  return getDb().media.find(m => m.file_path === filePath);
}

export function insertDownload(item: Omit<DownloadItem, 'id' | 'created_at' | 'updated_at'>): DownloadItem {
  const db = getDb();
  const now = new Date().toISOString();
  const download: DownloadItem = {
    ...item,
    id: db.nextDownloadId++,
    created_at: now,
    updated_at: now,
  };
  db.downloads.push(download);
  persist();
  return download;
}

export function updateDownloadRecord(id: number, fields: Partial<DownloadItem>) {
  const db = getDb();
  const idx = db.downloads.findIndex(d => d.id === id);
  if (idx === -1) return;
  db.downloads[idx] = { ...db.downloads[idx], ...fields, updated_at: new Date().toISOString() };
  persist();
}

export function deleteDownloadRecord(id: number) {
  const db = getDb();
  db.downloads = db.downloads.filter(d => d.id !== id);
  persist();
}

export function getAllDownloads(): DownloadItem[] {
  return getDb().downloads;
}

export function getDownloadById(id: number): DownloadItem | undefined {
  return getDb().downloads.find(d => d.id === id);
}
