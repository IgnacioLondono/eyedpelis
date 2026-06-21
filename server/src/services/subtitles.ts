import fs from 'fs';
import path from 'path';
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

export function findSubtitles(videoPath: string): SubtitleTrack[] {
  const dir = path.dirname(videoPath);
  const base = path.basename(videoPath, path.extname(videoPath));
  const tracks: SubtitleTrack[] = [];

  if (!fs.existsSync(dir)) return tracks;

  for (const file of fs.readdirSync(dir)) {
    const ext = path.extname(file).toLowerCase();
    if (!SUBTITLE_EXTENSIONS.has(ext)) continue;

    const fileBase = path.basename(file, ext);
    const isMatch =
      fileBase === base ||
      fileBase.startsWith(base + '.') ||
      fileBase.startsWith(base + ' ');

    if (!isMatch) continue;

    const suffix = fileBase.slice(base.length).replace(/^[\s._-]+/, '');
    const langCode = suffix.split(/[\s._-]/)[0]?.toLowerCase() || 'und';
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

export function getSubtitleContent(filePath: string): { content: string; contentType: string } {
  const ext = path.extname(filePath).toLowerCase();
  const raw = fs.readFileSync(filePath, 'utf-8');

  if (ext === '.vtt') {
    return { content: raw.startsWith('WEBVTT') ? raw : `WEBVTT\n\n${raw}`, contentType: 'text/vtt' };
  }
  if (ext === '.srt') {
    return { content: srtToVtt(raw), contentType: 'text/vtt' };
  }
  return { content: raw, contentType: 'text/plain' };
}

export async function getSubtitleTrackContent(track: SubtitleTrack): Promise<{ content: string; contentType: string }> {
  if (track.embedded && track.subIndex != null) {
    const content = await getEmbeddedSubtitleVtt(track.path, track.subIndex);
    return { content, contentType: 'text/vtt' };
  }

  if (!track.path || !fs.existsSync(track.path)) {
    throw new Error('Archivo de subtítulo no encontrado');
  }

  return getSubtitleContent(track.path);
}
