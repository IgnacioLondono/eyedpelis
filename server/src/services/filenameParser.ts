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
  /\b(bluray|blu-ray|brrip|bdrip|webrip|web-?dl|webdl|hdtv|dvdrip|remux|hdrip|cam|ts|tc)\b/gi,
  /\b(x264|x265|hevc|h\.?264|h\.?265|avc|xvid|divx|10bit|8bit)\b/gi,
  /\b(aac|ac3|dts|truehd|atmos|flac|mp3|eac3)\b/gi,
  /\b(proper|repack|extended|uncut|directors\.cut|imax|hdr|dv|sdr)\b/gi,
  /\b(subbed|sub|multi|dual|lat|castellano|spanish|english|español)\b/gi,
  /\b(amzn|nf|atvp|hmax|dsnp|pcok)\b/gi,
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
  // Título (1999) o Título [1999] o Título {1999}
  const wrapped = text.match(/^(.+?)\s*[\[({]\s*((19|20)\d{2})\s*[\])}]\s*(.*)$/);
  if (wrapped) {
    const title = cleanSeparators(wrapped[1] + (wrapped[4] ? '' : ''));
    return { title: stripJunk(wrapped[1]), year: parseInt(wrapped[2]) };
  }

  // Año entre separadores: Película.1999.1080p o Película 1999 1080p
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

export function parseFileName(fileName: string, type: MediaType): ParsedFileName {
  const base = path.basename(fileName, path.extname(fileName));

  if (type === 'series') {
    const s01e01 = base.match(/^(.+?)[.\s_-]*[Ss](\d{1,2})[Ee](\d{1,3})/);
    if (s01e01) {
      const { title, year } = extractYearFromText(s01e01[1]);
      return {
        title,
        year,
        season: parseInt(s01e01[2]),
        episode: parseInt(s01e01[3]),
      };
    }

    const alt = base.match(/^(.+?)[.\s_-]*(\d{1,2})x(\d{1,2})/i);
    if (alt) {
      const { title, year } = extractYearFromText(alt[1]);
      return {
        title,
        year,
        season: parseInt(alt[2]),
        episode: parseInt(alt[3]),
      };
    }
  }

  return extractYearFromText(base);
}

/** Usa el nombre de la carpeta padre si el archivo no trae título completo (series) */
export function parseWithFolderContext(
  fileName: string,
  folderName: string | null,
  type: MediaType,
): ParsedFileName {
  const fromFile = parseFileName(fileName, type);

  if (type !== 'series' || !folderName) return fromFile;

  const folder = parseFileName(folderName, 'series');
  const fileTitle = fromFile.title.toLowerCase();

  // Si el archivo solo tiene S01E01 sin nombre de serie, usar carpeta
  const isEpisodeOnly = /^(s?\d{1,2}e?\d{1,3}|\d{1,2}x\d{1,2})$/i.test(fileTitle.replace(/\s/g, ''))
    || fileTitle.length < 3;

  if (isEpisodeOnly && folder.title) {
    return {
      ...fromFile,
      title: folder.title,
      year: fromFile.year ?? folder.year,
    };
  }

  // Carpeta con año: "Breaking Bad (2008)" y archivo "Breaking.Bad.S01E01"
  if (!fromFile.year && folder.year) {
    return { ...fromFile, year: folder.year };
  }

  return fromFile;
}
