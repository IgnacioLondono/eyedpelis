import { Router } from 'express';
import fs from 'fs';
import mime from 'mime-types';
import { spawn } from 'child_process';
import { getMediaById, updateMedia } from '../db/database.js';
import { findAllSubtitles, getSubtitleTrackContent } from '../services/subtitles.js';
import { probeMedia, codecLabel } from '../services/mediaProbe.js';

const router = Router();

/** Seek preciso (después de -i): alinea audio y vídeo al adelantar. */
function buildSeekArgs(filePath: string, startSec: number): string[] {
  if (startSec <= 0.5) return ['-i', filePath];
  return ['-i', filePath, '-ss', startSec.toFixed(3)];
}

function resolveAudioMap(probe: Awaited<ReturnType<typeof probeMedia>>, audioIdx: number): string {
  const audioTrack = probe?.audioTracks[audioIdx];
  return audioTrack?.streamIndex != null ? `0:${audioTrack.streamIndex}` : `0:a:${audioIdx}?`;
}

function pipeFfmpeg(req: import('express').Request, res: import('express').Response, args: string[], label: string) {
  const ffmpeg = spawn('ffmpeg', args);
  ffmpeg.on('error', () => {
    if (!res.headersSent) res.status(500).json({ error: 'ffmpeg no disponible' });
    else res.end();
  });
  ffmpeg.stderr.on('data', (chunk: Buffer) => {
    console.error(`[ffmpeg ${label}]`, chunk.toString().trim());
  });
  ffmpeg.stdout.pipe(res);
  const cleanup = () => ffmpeg.kill('SIGKILL');
  req.on('close', cleanup);
  res.on('close', cleanup);
}

async function syncSubtitles(item: NonNullable<ReturnType<typeof getMediaById>>) {
  if (!item.file_path || !fs.existsSync(item.file_path)) return item.subtitles || [];

  const allSubs = await findAllSubtitles(item.file_path);
  const current = item.subtitles || [];
  const changed = allSubs.length !== current.length
    || allSubs.some((s, i) => s.label !== current[i]?.label || s.embedded !== current[i]?.embedded);

  if (changed) {
    updateMedia(item.id, { subtitles: allSubs });
    return allSubs;
  }
  return current;
}

router.get('/:id/subtitle/:index', async (req, res) => {
  const id = parseInt(req.params.id);
  const index = parseInt(req.params.index);
  const item = getMediaById(id);

  if (!item) return res.status(404).json({ error: 'No encontrado' });
  if (!Number.isFinite(index) || index < 0) {
    return res.status(400).json({ error: 'Índice de subtítulo inválido' });
  }

  const synced = item.file_path && fs.existsSync(item.file_path)
    ? await syncSubtitles(item)
    : (item.subtitles || []);
  const track = synced[index];

  if (!track) {
    return res.status(404).json({ error: `Subtítulo #${index} no encontrado (${synced.length} disponibles)` });
  }

  try {
    const { content, contentType } = await getSubtitleTrackContent(track);
    if (!content.includes('-->')) {
      return res.status(422).json({ error: 'El subtítulo no tiene diálogos legibles' });
    }
    res.setHeader('Content-Type', contentType);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', track.embedded ? 'public, max-age=86400' : 'public, max-age=3600');
    res.send(content);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'No se pudo extraer el subtítulo';
    console.error('[subtitle]', id, index, message);
    res.status(500).json({ error: message });
  }
});

router.get('/:id/info', async (req, res) => {
  const item = getMediaById(parseInt(req.params.id));
  if (!item) return res.status(404).json({ error: 'No encontrado' });

  const exists = item.file_path ? fs.existsSync(item.file_path) : false;
  let probe = null;
  let subtitles = item.subtitles || [];

  if (exists && item.file_path) {
    probe = await probeMedia(item.file_path);
    subtitles = await syncSubtitles(item);
  }

  res.json({
    title: item.title,
    file_path: item.file_path,
    file_size: item.file_size,
    subtitles,
    exists,
    probe: probe ? {
      ...probe,
      audioTracks: probe.audioTracks.map(t => ({
        ...t,
        codecLabel: codecLabel(t.codec),
      })),
      videoCodecLabel: probe.videoCodec ? codecLabel(probe.videoCodec) : null,
      needsCompatAudio: probe.needsCompatAudio,
    } : null,
  });
});

router.get('/:id/compat-audio', async (req, res) => {
  const item = getMediaById(parseInt(req.params.id));
  if (!item?.file_path || !fs.existsSync(item.file_path)) {
    return res.status(404).json({ error: 'Archivo no encontrado' });
  }

  const probe = await probeMedia(item.file_path);
  const audioIdx = Number.isFinite(parseInt(req.query.audio as string, 10))
    ? parseInt(req.query.audio as string, 10)
    : (probe?.recommendedAudioIndex ?? 0);
  const startSec = Math.max(0, parseFloat(req.query.start as string) || 0);
  const audioMap = resolveAudioMap(probe, audioIdx);

  // ADTS: más compatible con <audio> que fMP4 fragmentado en navegadores
  res.setHeader('Content-Type', 'audio/aac');
  res.setHeader('Transfer-Encoding', 'chunked');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');

  pipeFfmpeg(req, res, [
    '-hide_banner', '-loglevel', 'error',
    ...buildSeekArgs(item.file_path, startSec),
    '-map', audioMap,
    '-vn',
    '-c:a', 'aac', '-b:a', '192k', '-ac', '2', '-ar', '48000',
    '-af', 'aresample=async=1:first_pts=0',
    '-avoid_negative_ts', 'make_zero',
    '-f', 'adts',
    'pipe:1',
  ], 'compat-audio');
});

router.get('/:id/compat', async (req, res) => {
  const item = getMediaById(parseInt(req.params.id));
  if (!item?.file_path || !fs.existsSync(item.file_path)) {
    return res.status(404).json({ error: 'Archivo no encontrado' });
  }

  const probe = await probeMedia(item.file_path);
  const audioIdx = Number.isFinite(parseInt(req.query.audio as string, 10))
    ? parseInt(req.query.audio as string, 10)
    : (probe?.recommendedAudioIndex ?? 0);
  const startSec = Math.max(0, parseFloat(req.query.start as string) || 0);
  const audioMap = resolveAudioMap(probe, audioIdx);

  res.setHeader('Content-Type', 'video/mp4');
  res.setHeader('Transfer-Encoding', 'chunked');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');

  pipeFfmpeg(req, res, [
    '-hide_banner', '-loglevel', 'error',
    ...buildSeekArgs(item.file_path, startSec),
    '-map', '0:v:0?',
    '-map', audioMap,
    '-c:v', 'copy',
    '-c:a', 'aac', '-b:a', '192k', '-ac', '2', '-ar', '48000',
    '-avoid_negative_ts', 'make_zero',
    '-fflags', '+genpts',
    '-reset_timestamps', '1',
    '-f', 'mp4',
    '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
    'pipe:1',
  ], 'compat');
});

router.get('/:id', (req, res) => {
  const item = getMediaById(parseInt(req.params.id));

  if (!item?.file_path || !fs.existsSync(item.file_path)) {
    return res.status(404).json({ error: 'Archivo no encontrado' });
  }

  const stat = fs.statSync(item.file_path);
  const fileSize = stat.size;
  const range = req.headers.range;
  const contentType = mime.lookup(item.file_path) || 'video/mp4';

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunkSize = end - start + 1;

    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
    });

    fs.createReadStream(item.file_path, { start, end }).pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes',
      'Access-Control-Allow-Origin': '*',
    });
    fs.createReadStream(item.file_path).pipe(res);
  }
});

export default router;
