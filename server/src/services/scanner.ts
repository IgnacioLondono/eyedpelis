import fs from 'fs';
import path from 'path';
import {
  persist, insertMedia, updateMedia, deleteMediaByPath,
  findMedia, getMediaByPath,
} from '../db/database.js';
import { getMoviesPath, getSeriesPath, isMediaReadOnly } from '../config.js';
import { enrichFromTmdb, tmdbMetadataWithGenres } from './tmdb.js';
import { findAllSubtitles } from './subtitles.js';
import { parseWithFolderContext } from './filenameParser.js';
import {
  getEnrichPromise, getScanStatus, isScanRunning, setEnrichPromise, setScanProgress,
} from './scanState.js';
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

export interface ScanOptions {
  enrich?: boolean;
  onProgress?: (current: number, total: number, label: string) => void;
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

export async function enrichMissingMetadata(
  onProgress?: (current: number, total: number, label: string) => void,
): Promise<number> {
  const targets = findMedia(m => {
    if (m.poster_path && m.tmdb_id && m.genres) return false;
    if (m.type === 'movie') return !!m.file_path;
    return !m.file_path;
  });

  let enriched = 0;
  for (let i = 0; i < targets.length; i++) {
    const item = targets[i];
    onProgress?.(i + 1, targets.length, item.title);
    const year = item.release_date ? parseInt(item.release_date.slice(0, 4)) : undefined;
    const { title, year: parsedYear } = cleanTitleForSearch(item.title, year);
    const tmdb = await enrichFromTmdb(title, item.type, parsedYear);
    if (tmdb) {
      updateMedia(item.id, await tmdbMetadataWithGenres(tmdb, item.type));
      enriched++;
    }
  }
  persist();
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

async function applyTmdbToItem(file: ParsedFile, tmdb: Awaited<ReturnType<typeof fetchTmdbForFile>>) {
  const meta = tmdb ? await tmdbMetadataWithGenres(tmdb, file.type) : {};
  return {
    ...meta,
    title: meta.title ?? file.title,
    release_date: meta.release_date ?? (file.year ? `${file.year}-01-01` : null),
  };
}

async function enrichExistingItem(file: ParsedFile, existing: MediaItem) {
  const subs = await findAllSubtitles(file.filePath);
  const updates: Partial<MediaItem> = { file_size: file.fileSize, subtitles: subs };

  if (!existing.tmdb_id || !existing.poster_path || !existing.genres) {
    const { title, year } = cleanTitleForSearch(file.title, file.year);
    const tmdb = await enrichFromTmdb(title, file.type, year);
    Object.assign(updates, await applyTmdbToItem(file, tmdb));
  }

  return updates;
}

function basicFileMeta(file: ParsedFile) {
  return {
    tmdb_id: null as number | null,
    title: file.title,
    original_title: null as string | null,
    overview: null as string | null,
    poster_path: null as string | null,
    backdrop_path: null as string | null,
    release_date: file.year ? `${file.year}-01-01` : null,
    vote_average: null as number | null,
    genres: null as string | null,
  };
}

export interface ScanResult {
  added: number;
  updated: number;
  removed: number;
  total: number;
}

export async function scanLibrary(options?: ScanOptions): Promise<ScanResult> {
  const enrich = options?.enrich ?? false;

  setScanProgress({ message: 'Buscando archivos en disco...' });
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

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    options?.onProgress?.(i + 1, files.length, file.fileName);
    setScanProgress({ current: i + 1, total: files.length, message: file.fileName });

    const subs = await findAllSubtitles(file.filePath);
    const existingItem = getMediaByPath(file.filePath);

    if (existingItem) {
      const updates = enrich
        ? await enrichExistingItem(file, existingItem)
        : { file_size: file.fileSize, subtitles: subs };
      updateMedia(existingItem.id, updates);
      updated++;
      continue;
    }

    const meta = enrich
      ? await applyTmdbToItem(file, await fetchTmdbForFile(file))
      : basicFileMeta(file);

    let seriesId: number | null = null;

    if (file.type === 'series' && file.season !== undefined) {
      const seriesKey = `${file.title.toLowerCase()}|${file.year ?? ''}`;
      if (!seriesCache.has(seriesKey)) {
        const parent = findMedia(m =>
          m.type === 'series' && !m.file_path &&
          m.title.toLowerCase() === file.title.toLowerCase(),
        )[0];

        if (parent) {
          seriesCache.set(seriesKey, parent.id);
        } else {
          const seriesMeta = enrich
            ? await applyTmdbToItem(
              { ...file, type: 'series', season: undefined, episode: undefined },
              await fetchTmdbForFile({ ...file, type: 'series' }),
            )
            : basicFileMeta(file);

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
            genres: seriesMeta.genres ?? null,
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
      genres: meta.genres ?? null,
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

  if (enrich) {
    setScanProgress({ phase: 'enriching', message: 'Actualizando metadatos TMDB...' });
    await enrichMissingMetadata((current, total, label) => {
      setScanProgress({ current, total, message: label });
    });
  }

  persist();
  return { added, updated, removed, total: files.length };
}

let enrichTimer: ReturnType<typeof setTimeout> | null = null;

async function runBackgroundEnrich() {
  setScanProgress({
    running: true,
    phase: 'enriching',
    current: 0,
    total: 0,
    message: 'Actualizando metadatos TMDB en segundo plano...',
  });
  try {
    const enriched = await enrichMissingMetadata((current, total, label) => {
      setScanProgress({ current, total, message: label });
    });
    setScanProgress({
      running: false,
      phase: 'done',
      enrichCount: enriched,
      message: enriched > 0 ? `Metadatos TMDB: ${enriched} títulos` : 'Metadatos al día',
    });
    return enriched;
  } catch (err) {
    setScanProgress({
      running: false,
      phase: 'done',
      error: err instanceof Error ? err.message : 'Error al enriquecer',
    });
    return 0;
  } finally {
    setEnrichPromise(null);
  }
}

export function scheduleBackgroundEnrich() {
  if (getEnrichPromise()) return;
  if (enrichTimer) clearTimeout(enrichTimer);
  enrichTimer = setTimeout(() => {
    enrichTimer = null;
    if (!getEnrichPromise()) {
      const p = runBackgroundEnrich();
      setEnrichPromise(p);
    }
  }, 1500);
}

export async function runScanJob(): Promise<ScanResult> {
  if (isScanRunning()) {
    const status = getScanStatus();
    if (status.result) return status.result;
    throw new Error('Ya hay un escaneo en curso');
  }

  setScanProgress({
    running: true,
    phase: 'indexing',
    current: 0,
    total: 0,
    message: 'Iniciando escaneo...',
    result: null,
    error: null,
    enrichCount: 0,
  });

  try {
    const result = await scanLibrary({
      enrich: false,
      onProgress: (current, total, label) => {
        setScanProgress({ phase: 'indexing', current, total, message: label });
      },
    });

    setScanProgress({
      phase: 'enriching',
      running: true,
      result,
      current: 0,
      total: 0,
      message: 'Actualizando metadatos TMDB...',
    });

    const enriched = await enrichMissingMetadata((current, total, label) => {
      setScanProgress({ current, total, message: label });
    });

    setScanProgress({
      running: false,
      phase: 'done',
      result,
      enrichCount: enriched,
      message: `Listo: ${result.total} archivos (+${result.added}, -${result.removed})`,
    });

    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error al escanear';
    setScanProgress({ running: false, phase: 'idle', error: msg });
    throw err;
  }
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
