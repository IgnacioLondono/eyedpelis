import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import type { SubtitleTrack } from '../types.js';
import { findEmbeddedSubtitles, getEmbeddedSubtitleVtt } from './embeddedSubtitles.js';

const SUBTITLE_EXTENSIONS = new Set(['.srt', '.vtt', '.ass', '.ssa']);

const LANG_MAP: Record<string, string> = {
  spa: 'Español', es: 'Español', esp: 'Español',
  eng: 'English', en: 'English',
  fre: 'Francés', fr: 'Francés', fra: 'Francés',
  ger: 'Alemán', de: 'Deutsch', deu: 'Deutsch',
  ita: 'Italiano', it: 'Italiano',
  por: 'Portugués', pt: 'Portugués',
  jpn: 'Japonés', ja: 'Japonés',
  und: 'Desconocido',
};

export function langLabelFromCode(code: string): string {
  const c = code.toLowerCase();
  return LANG_MAP[c] || LANG_MAP[c.slice(0, 2)] || c.toUpperCase();
}

export function sortSubtitleTracks(tracks: SubtitleTrack[]): SubtitleTrack[] {
  return [...tracks].sort((a, b) => {
    const aEs = a.language === 'spa' || a.language === 'es' || a.language.startsWith('es');
    const bEs = b.language === 'spa' || b.language === 'es' || b.language.startsWith('es');
    if (aEs && !bEs) return -1;
    if (bEs && !aEs) return 1;
    return a.label.localeCompare(b.label);
  });
}

function langMatches(a: string, b: string): boolean {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  return x === y || x.startsWith(y) || y.startsWith(x) || (x.startsWith('es') && y.startsWith('es'));
}

function normalizeMediaName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\w]/g, '');
}

function subtitleMatchesVideo(fileBase: string, videoBase: string): boolean {
  if (fileBase === videoBase) return true;
  if (fileBase.startsWith(videoBase + '.') || fileBase.startsWith(videoBase + ' ')) return true;
  if (videoBase.startsWith(fileBase + '.') || videoBase.startsWith(fileBase + ' ')) return true;
  const nf = normalizeMediaName(fileBase);
  const nv = normalizeMediaName(videoBase);
  if (!nf || !nv) return false;
  return nf === nv || nf.startsWith(nv) || nv.startsWith(nf);
}

function parseLangFromSuffix(suffix: string): string {
  const token = suffix.split(/[\s._-]+/).find(t => t.length >= 2)?.toLowerCase() || 'und';
  if (token === 'spanish' || token === 'castellano' || token === 'latino') return 'es';
  if (token === 'english') return 'en';
  return token;
}

export function readSubtitleText(filePath: string): string {
  const buf = fs.readFileSync(filePath);
  if (buf.length >= 3 && buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
    return buf.subarray(3).toString('utf-8');
  }
  const utf8 = buf.toString('utf-8');
  if (!utf8.includes('\uFFFD')) return utf8;
  return buf.toString('latin1');
}

export function findSubtitles(videoPath: string): SubtitleTrack[] {
  const dir = path.dirname(videoPath);
  const base = path.basename(videoPath, path.extname(videoPath));
  const tracks: SubtitleTrack[] = [];

  if (!fs.existsSync(dir)) return tracks;

  for (const file of fs.readdirSync(dir)) {
    const ext = path.extname(file).toLowerCase();
    if (!SUBTITLE_EXTENSIONS.has(ext)) continue;

    const fileBase = path.basename(file, ext);
    if (!subtitleMatchesVideo(fileBase, base)) continue;

    const suffix = fileBase.length >= base.length
      ? fileBase.slice(base.length).replace(/^[\s._-]+/, '')
      : fileBase;
    const langCode = parseLangFromSuffix(suffix);
    const label = langLabelFromCode(langCode);

    tracks.push({
      path: path.join(dir, file).replace(/\\/g, '/'),
      label,
      language: langCode,
      format: ext.slice(1) as SubtitleTrack['format'],
    });
  }

  return sortSubtitleTracks(tracks);
}

export async function findAllSubtitles(videoPath: string): Promise<SubtitleTrack[]> {
  const external = findSubtitles(videoPath);
  const embedded = await findEmbeddedSubtitles(videoPath);

  const merged = [...external];
  for (const emb of embedded) {
    const duplicate = external.some(ext => langMatches(ext.language, emb.language));
    if (!duplicate) merged.push(emb);
  }

  return sortSubtitleTracks(merged);
}

export function srtToVtt(content: string): string {
  const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const out = ['WEBVTT', ''];
  for (const line of lines) {
    if (/^\d+$/.test(line.trim())) continue;
    out.push(line.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2'));
  }
  return out.join('\n');
}

function convertFileToVtt(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const errors: string[] = [];
    const ffmpeg = spawn('ffmpeg', [
      '-hide_banner', '-loglevel', 'error',
      '-i', filePath,
      '-c:s', 'webvtt',
      '-f', 'webvtt',
      'pipe:1',
    ]);
    ffmpeg.stdout.on('data', (c: Buffer) => chunks.push(c));
    ffmpeg.stderr.on('data', (c: Buffer) => errors.push(c.toString()));
    ffmpeg.on('error', reject);
    ffmpeg.on('close', (code) => {
      if (code !== 0) return reject(new Error(errors.join('') || `ffmpeg ${code}`));
      const text = Buffer.concat(chunks).toString('utf-8');
      if (!text.trim()) return reject(new Error('Subtítulo vacío'));
      resolve(text.startsWith('WEBVTT') ? text : `WEBVTT\n\n${text}`);
    });
  });
}

export function getSubtitleContent(filePath: string): { content: string; contentType: string } {
  const ext = path.extname(filePath).toLowerCase();
  const raw = readSubtitleText(filePath);

  if (ext === '.vtt') {
    return { content: raw.startsWith('WEBVTT') ? raw : `WEBVTT\n\n${raw}`, contentType: 'text/vtt; charset=utf-8' };
  }
  if (ext === '.srt') {
    return { content: srtToVtt(raw), contentType: 'text/vtt; charset=utf-8' };
  }
  return { content: raw, contentType: 'text/plain; charset=utf-8' };
}

export async function getSubtitleTrackContent(track: SubtitleTrack): Promise<{ content: string; contentType: string }> {
  if (track.bitmap) {
    throw new Error('Subtítulo de imagen (PGS/VobSub): añade un archivo .srt junto al vídeo');
  }

  if (track.embedded && track.subIndex != null) {
    const content = await getEmbeddedSubtitleVtt(track.path, track.subIndex, track.streamIndex);
    return { content, contentType: 'text/vtt; charset=utf-8' };
  }

  if (!track.path || !fs.existsSync(track.path)) {
    throw new Error('Archivo de subtítulo no encontrado');
  }

  const ext = path.extname(track.path).toLowerCase();
  if (ext === '.ass' || ext === '.ssa') {
    const content = await convertFileToVtt(track.path);
    return { content, contentType: 'text/vtt; charset=utf-8' };
  }

  return getSubtitleContent(track.path);
}
