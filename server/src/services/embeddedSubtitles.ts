import { createHash } from 'crypto';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';
import { promisify } from 'util';
import type { SubtitleTrack } from '../types.js';

const LANG_MAP: Record<string, string> = {
  spa: 'Español', es: 'Español', esp: 'Español',
  eng: 'English', en: 'English',
  jpn: 'Japonés', ja: 'Japonés',
  und: 'Desconocido',
};

function langLabel(code: string): string {
  const c = code.toLowerCase();
  return LANG_MAP[c] || LANG_MAP[c.slice(0, 2)] || c.toUpperCase();
}

function sortTracks(tracks: SubtitleTrack[]): SubtitleTrack[] {
  return [...tracks].sort((a, b) => {
    const aEs = a.language.startsWith('es');
    const bEs = b.language.startsWith('es');
    if (aEs && !bEs) return -1;
    if (bEs && !aEs) return 1;
    return a.label.localeCompare(b.label);
  });
}

const exec = promisify(execFile);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = path.join(__dirname, '../../data/subtitle-cache');

/** Códecs de subtítulo basados en texto (extraíbles a WebVTT). */
const TEXT_SUBTITLE_CODECS = new Set([
  'subrip', 'ass', 'ssa', 'webvtt', 'mov_text', 'text', 'srt',
]);

const PROBE_CONTAINER = new Set(['.mkv', '.mp4', '.m4v', '.mov', '.webm', '.avi']);

export async function findEmbeddedSubtitles(videoPath: string): Promise<SubtitleTrack[]> {
  if (!fs.existsSync(videoPath)) return [];
  if (!PROBE_CONTAINER.has(path.extname(videoPath).toLowerCase())) return [];

  try {
    const { stdout } = await exec('ffprobe', [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_streams',
      videoPath,
    ]);

    const data = JSON.parse(stdout) as {
      streams?: Array<{
        index?: number;
        codec_type?: string;
        codec_name?: string;
        tags?: { language?: string; title?: string };
      }>;
    };

    const tracks: SubtitleTrack[] = [];
    let subIndex = 0;

    for (const stream of data.streams || []) {
      if (stream.codec_type !== 'subtitle') continue;

      const codec = (stream.codec_name || '').toLowerCase();
      if (!TEXT_SUBTITLE_CODECS.has(codec)) continue;

      const lang = (stream.tags?.language || 'und').toLowerCase();
      const tagTitle = stream.tags?.title?.trim();
      const baseLabel = langLabel(lang);
      const label = tagTitle || (subIndex > 0 ? `${baseLabel} ${subIndex + 1}` : baseLabel);

      tracks.push({
        path: videoPath,
        label: `${label} (incrustado)`,
        language: lang,
        format: codec === 'subrip' ? 'srt' : codec === 'webvtt' ? 'vtt' : 'ass',
        embedded: true,
        subIndex,
        streamIndex: stream.index,
      });
      subIndex++;
    }

    return sortTracks(tracks);
  } catch {
    return [];
  }
}

function cachePath(videoPath: string, subIndex: number): string {
  const stat = fs.statSync(videoPath);
  const key = createHash('sha256')
    .update(`${videoPath}|${stat.mtimeMs}|${stat.size}|${subIndex}`)
    .digest('hex');
  return path.join(CACHE_DIR, `${key}.vtt`);
}

function extractEmbeddedToVtt(videoPath: string, subIndex: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const errors: string[] = [];

    const ffmpeg = spawn('ffmpeg', [
      '-hide_banner', '-loglevel', 'error',
      '-i', videoPath,
      '-map', `0:s:${subIndex}`,
      '-c:s', 'webvtt',
      '-f', 'webvtt',
      'pipe:1',
    ]);

    ffmpeg.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
    ffmpeg.stderr.on('data', (chunk: Buffer) => errors.push(chunk.toString()));
    ffmpeg.on('error', err => reject(err));

    ffmpeg.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(errors.join('') || `ffmpeg exit ${code}`));
        return;
      }
      const content = Buffer.concat(chunks).toString('utf-8');
      if (!content.trim()) {
        reject(new Error('Subtítulo vacío'));
        return;
      }
      resolve(content.startsWith('WEBVTT') ? content : `WEBVTT\n\n${content}`);
    });
  });
}

export async function getEmbeddedSubtitleVtt(videoPath: string, subIndex: number): Promise<string> {
  if (!fs.existsSync(videoPath)) throw new Error('Video no encontrado');

  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

  const cached = cachePath(videoPath, subIndex);
  if (fs.existsSync(cached)) {
    return fs.readFileSync(cached, 'utf-8');
  }

  const vtt = await extractEmbeddedToVtt(videoPath, subIndex);
  fs.writeFileSync(cached, vtt, 'utf-8');
  return vtt;
}
