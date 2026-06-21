import fs from 'fs';
import path from 'path';
import type { SubtitleTrack } from '../types.js';

const SUBTITLE_EXTENSIONS = new Set(['.srt', '.vtt', '.ass', '.ssa']);

const LANG_MAP: Record<string, string> = {
  spa: 'Español', es: 'Español', esp: 'Español',
  eng: 'English', en: 'English',
  fre: 'Français', fr: 'Français',
  ger: 'Deutsch', de: 'Deutsch',
  ita: 'Italiano', it: 'Italiano',
  por: 'Português', pt: 'Português',
};

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
    const label = LANG_MAP[langCode] || langCode.toUpperCase();

    tracks.push({
      path: path.join(dir, file).replace(/\\/g, '/'),
      label,
      language: langCode,
      format: ext.slice(1) as SubtitleTrack['format'],
    });
  }

  return tracks.sort((a, b) => {
    if (a.language === 'spa' || a.language === 'es') return -1;
    if (b.language === 'spa' || b.language === 'es') return 1;
    return a.label.localeCompare(b.label);
  });
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
