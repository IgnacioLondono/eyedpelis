import fs from 'fs';
import path from 'path';
import {
  getDb, persist, insertMedia, updateMedia, deleteMediaByPath,
  findMedia, getMediaByPath,
} from '../db/database.js';
import { getMoviesPath, getSeriesPath, isMediaReadOnly } from '../config.js';
import { enrichFromTmdb, tmdbMetadataFields } from './tmdb.js';
import { findSubtitles } from './subtitles.js';
import { parseWithFolderContext } from './filenameParser.js';
import type { MediaType, MediaItem } from '../types.js';

const VIDEO_EXTENSIONS = new Set(['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.webm', '.m4v', '.ts']);

interface ParsedFile {
  filePath: string;
  fileName: string;
  fileSize: number;
  type: MediaType;
  title: string;
  year?: number;
  season?: number;
  episode?: number;
}

function walkDir(dir: string, type: MediaType, results: ParsedFile[] = [], parentFolder: string | null = null): ParsedFile[] {
  if (!fs.existsSync(dir)) return results;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(fullPath, type, results, entry.name);
    } else if (entry.isFile() && VIDEO_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      const parsed = parseWithFolderContext(entry.name, parentFolder, type);
      results.push({
        filePath: fullPath.replace(/\\/g, '/'),
        fileName: entry.name,
        fileSize: fs.statSync(fullPath).size,
        type,
        title: parsed.title,
        year: parsed.year,
        season: parsed.season,
        episode: parsed.episode,
      });
    }
  }
  return results;
}

export async function enrichMissingMetadata(): Promise<number> {
  const targets = findMedia(m => {
    if (m.poster_path && m.tmdb_id) return false;
    if (m.type === 'movie') return !!m.file_path;
    return !m.file_path;
  });

  let enriched = 0;
  for (const item of targets) {
    const year = item.release_date ? parseInt(item.release_date.slice(0, 4)) : undefined;
    const { title, year: parsedYear } = cleanTitleForSearch(item.title, year);
    const tmdb = await enrichFromTmdb(title, item.type, parsedYear);
    if (tmdb) {
      updateMedia(item.id, tmdbMetadataFields(tmdb));
      enriched++;
    }
  }
  return enriched;
}

function cleanTitleForSearch(title: string, year?: number): { title: string; year?: number } {
  const parenYear = title.match(/^(.+?)\s*\(((19|20)\d{2})\)\s*$/);
  if (parenYear) {
    return { title: parenYear[1].trim(), year: year ?? parseInt(parenYear[2]) };
  }
  return { title: title.trim(), year };
}

async function fetchTmdbForFile(file: ParsedFile) {
  const { title, year } = cleanTitleForSearch(file.title, file.year);
  return enrichFromTmdb(title, file.type, year);
}

function applyTmdbToItem(file: ParsedFile, tmdb: Awaited<ReturnType<typeof fetchTmdbForFile>>) {
  const meta = tmdbMetadataFields(tmdb);
  return {
    ...meta,
    title: meta.title ?? file.title,
    release_date: meta.release_date ?? (file.year ? `${file.year}-01-01` : null),
  };
}

async function enrichExistingItem(file: ParsedFile, existing: MediaItem) {
  const subs = findSubtitles(file.filePath);
  const updates: Partial<MediaItem> = { file_size: file.fileSize, subtitles: subs };

  if (!existing.tmdb_id || !existing.poster_path) {
    const { title, year } = cleanTitleForSearch(file.title, file.year);
    const tmdb = await enrichFromTmdb(title, file.type, year);
    Object.assign(updates, applyTmdbToItem(file, tmdb));
  }

  return updates;
}

export interface ScanResult {
  added: number;
  updated: number;
  removed: number;
  total: number;
}

export async function scanLibrary(): Promise<ScanResult> {
  const moviesPath = getMoviesPath();
  const seriesPath = getSeriesPath();

  const files = [
    ...walkDir(moviesPath, 'movie'),
    ...walkDir(seriesPath, 'series'),
  ];

  const existing = findMedia(m => m.file_path !== null);
  const existingPaths = new Set(existing.map(m => m.file_path!));
  const foundPaths = new Set(files.map(f => f.filePath));
  let added = 0;
  let updated = 0;

  const seriesCache = new Map<string, number>();

  for (const file of files) {
    const subs = findSubtitles(file.filePath);
    const existingItem = getMediaByPath(file.filePath);

    if (existingItem) {
      const updates = await enrichExistingItem(file, existingItem);
      updateMedia(existingItem.id, updates);
      updated++;
      continue;
    }

    const tmdb = await fetchTmdbForFile(file);
    const meta = applyTmdbToItem(file, tmdb);
    let seriesId: number | null = null;

    if (file.type === 'series' && file.season !== undefined) {
      const seriesKey = `${file.title.toLowerCase()}|${file.year ?? ''}`;
      if (!seriesCache.has(seriesKey)) {
        const parent = findMedia(m =>
          m.type === 'series' && !m.file_path &&
          m.title.toLowerCase() === file.title.toLowerCase()
        )[0];

        if (parent) {
          seriesCache.set(seriesKey, parent.id);
        } else {
          const { title, year } = cleanTitleForSearch(file.title, file.year);
          const seriesTmdb = await enrichFromTmdb(title, 'series', year);
          const seriesMeta = applyTmdbToItem(
            { ...file, type: 'series', season: undefined, episode: undefined },
            seriesTmdb,
          );
          const created = insertMedia({
            tmdb_id: seriesMeta.tmdb_id ?? null,
            type: 'series',
            title: seriesMeta.title ?? file.title,
            original_title: seriesMeta.original_title ?? null,
            overview: seriesMeta.overview ?? null,
            poster_path: seriesMeta.poster_path ?? null,
            backdrop_path: seriesMeta.backdrop_path ?? null,
            release_date: seriesMeta.release_date ?? null,
            vote_average: seriesMeta.vote_average ?? null,
            genres: null,
            file_path: null,
            file_size: null,
            duration: null,
            season: null,
            episode: null,
            series_id: null,
            status: 'available',
            subtitles: [],
          });
          seriesCache.set(seriesKey, created.id);
        }
      }
      seriesId = seriesCache.get(seriesKey)!;
    }

    insertMedia({
      tmdb_id: meta.tmdb_id ?? null,
      type: file.type,
      title: meta.title ?? file.title,
      original_title: meta.original_title ?? null,
      overview: meta.overview ?? null,
      poster_path: meta.poster_path ?? null,
      backdrop_path: meta.backdrop_path ?? null,
      release_date: meta.release_date ?? null,
      vote_average: meta.vote_average ?? null,
      genres: null,
      file_path: file.filePath,
      file_size: file.fileSize,
      duration: null,
      season: file.season ?? null,
      episode: file.episode ?? null,
      series_id: seriesId,
      status: 'available',
      subtitles: subs,
    });
    added++;
  }

  let removed = 0;
  for (const existingPath of existingPaths) {
    if (!foundPaths.has(existingPath)) {
      deleteMediaByPath(existingPath);
      removed++;
    }
  }

  await enrichMissingMetadata();

  persist();
  return { added, updated, removed, total: files.length };
}

export function ensureMediaDirs() {
  if (isMediaReadOnly()) return;

  const moviesPath = getMoviesPath();
  const seriesPath = getSeriesPath();
  for (const dir of [moviesPath, seriesPath]) {
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch {
        // Carpetas existentes del usuario — no crear nada si falla
      }
    }
  }
}
