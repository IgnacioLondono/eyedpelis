import path from 'path';
import type { MediaType } from '../types.js';

export interface ParsedFileName {
  title: string;
  year?: number;
  season?: number;
  episode?: number;
}

const JUNK_PATTERNS = [
  /\b(720p|1080p|1440p|2160p|4320p|480p|4k|8k|uhd)\b/gi,
  /\b(bluray|blu-ray|brrip|bdrip|webrip|web-?dl|webdl|hdtv|dvdrip|remux|hdrip|cam|tc)\b/gi,
  /\b(x264|x265|hevc|h\.?264|h\.?265|avc|xvid|divx|10bit|8bit)\b/gi,
  /\b(aac|ac3|dts|truehd|atmos|flac|mp3|eac3)\b/gi,
  /\b(proper|repack|extended|uncut|directors\.cut|imax|hdr|dv|sdr)\b/gi,
  /\b(subbed|sub|multi|dual|lat|castellano|spanish|english|español)\b/gi,
  /\b(amzn|nf|atvp|hmax|dsnp|pcok)\b/gi,
  /\b(eria-raws|subsplease|horriblesubs|commie|asw)\b/gi,
];

function cleanSeparators(text: string): string {
  return text
    .replace(/[._]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripJunk(text: string): string {
  let s = text;
  for (const pattern of JUNK_PATTERNS) {
    s = s.replace(pattern, ' ');
  }
  return cleanSeparators(s);
}

function extractYearFromText(text: string): { title: string; year?: number } {
  const wrapped = text.match(/^(.+?)\s*[\[({]\s*((19|20)\d{2})\s*[\])}]\s*(.*)$/);
  if (wrapped) {
    return { title: stripJunk(wrapped[1]), year: parseInt(wrapped[2]) };
  }

  const tokens = text.split(/[.\s_-]+/).filter(Boolean);
  const yearIdx = tokens.findIndex(t => /^(19|20)\d{2}$/.test(t));

  if (yearIdx !== -1) {
    const year = parseInt(tokens[yearIdx]);
    const titleTokens = tokens.slice(0, yearIdx);
    if (titleTokens.length > 0) {
      return { title: stripJunk(titleTokens.join(' ')), year };
    }
  }

  return { title: stripJunk(text) };
}

function parseEpisodeFromBase(base: string): ParsedFileName | null {
  // S01E01 en cualquier parte del nombre
  const sAnywhere = base.match(/[Ss](\d{1,2})[Ee](\d{1,3})/);
  if (sAnywhere && sAnywhere.index !== undefined) {
    const before = base.slice(0, sAnywhere.index);
    const { title, year } = extractYearFromText(before);
    return {
      title,
      year,
      season: parseInt(sAnywhere[1]),
      episode: parseInt(sAnywhere[2]),
    };
  }

  const alt = base.match(/(\d{1,2})x(\d{1,2})/i);
  if (alt && alt.index !== undefined) {
    const before = base.slice(0, alt.index);
    const { title, year } = extractYearFromText(before);
    return {
      title,
      year,
      season: parseInt(alt[1]),
      episode: parseInt(alt[2]),
    };
  }

  // Anime: "Bleach - 366" o "[Show] Name - 01 (1080p)"
  const animeDash = base.match(/[-–]\s*(\d{1,4})(?:\s*[\[(]|(?:\s|$))/);
  if (animeDash && animeDash.index !== undefined) {
    const before = base.slice(0, animeDash.index);
    const { title, year } = extractYearFromText(before);
    const epNum = parseInt(animeDash[1]);
    if (title.length >= 2) {
      return {
        title,
        year,
        season: 1,
        episode: epNum,
      };
    }
  }

  // Episodio suelto: E01, EP01
  const epOnly = base.match(/\b[Ee][Pp]?\s*(\d{1,4})\b/);
  if (epOnly && epOnly.index !== undefined) {
    const before = base.slice(0, epOnly.index);
    const { title, year } = extractYearFromText(before);
    if (title.length >= 2) {
      return { title, year, season: 1, episode: parseInt(epOnly[1]) };
    }
  }

  return null;
}

export function parseFileName(fileName: string, type: MediaType): ParsedFileName {
  const base = path.basename(fileName, path.extname(fileName));

  if (type === 'series') {
    const episode = parseEpisodeFromBase(base);
    if (episode) return episode;
  }

  return extractYearFromText(base);
}

export function normalizeTitleKey(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9áéíóúñ]/gi, '').trim();
}

/** Clave canónica para agrupar la misma serie con títulos ligeramente distintos */
export function canonicalSeriesKey(title: string): string {
  let t = title.trim();
  t = t.replace(/\s*\((19|20)\d{2}\)\s*$/, '');
  t = t.split(/[:：|]/)[0]?.trim() || t;
  t = t.replace(/\s*-\s*.+$/, '').trim();
  return normalizeTitleKey(t);
}

export function seriesTitlesMatch(a: string, b: string): boolean {
  const ka = canonicalSeriesKey(a);
  const kb = canonicalSeriesKey(b);
  if (!ka || !kb) return false;
  if (ka === kb) return true;
  const minLen = 8;
  if (ka.length >= minLen && kb.length >= minLen) {
    return ka.startsWith(kb) || kb.startsWith(ka);
  }
  return false;
}

/** Usa la carpeta de serie (primer nivel bajo Series/) para el título */
export function parseWithFolderContext(
  fileName: string,
  seriesFolder: string | null,
  type: MediaType,
): ParsedFileName {
  const fromFile = parseFileName(fileName, type);

  if (type !== 'series' || !seriesFolder) return fromFile;

  const folder = parseFileName(seriesFolder, 'series');
  const folderTitle = folder.title || seriesFolder;
  const fileKey = normalizeTitleKey(fromFile.title);
  const folderKey = normalizeTitleKey(folderTitle);

  const isEpisodeOnly = fromFile.season !== undefined
    || /^(s?\d{1,2}e?\d{1,3}|\d{1,2}x\d{1,2})$/i.test(fromFile.title.replace(/\s/g, ''))
    || fromFile.title.length < 3
    || (fileKey.length > 0 && (fileKey === folderKey || folderKey.includes(fileKey) || fileKey.includes(folderKey)));

  if (isEpisodeOnly) {
    return {
      ...fromFile,
      title: folderTitle,
      year: fromFile.year ?? folder.year,
    };
  }

  if (!fromFile.year && folder.year) {
    return { ...fromFile, year: folder.year };
  }

  return fromFile;
}

export function seriesFolderFromPath(filePath: string, seriesBasePath: string): string | null {
  const base = seriesBasePath.replace(/\\/g, '/').replace(/\/+$/, '');
  const file = filePath.replace(/\\/g, '/');
  if (!file.startsWith(`${base}/`)) return null;
  const rel = file.slice(base.length + 1);
  const slash = rel.indexOf('/');
  if (slash === -1) return null;
  return rel.slice(0, slash);
}
