import { Router } from 'express';
import fs from 'fs';
import mime from 'mime-types';
import { spawn } from 'child_process';
import { getMediaById } from '../db/database.js';
import { getSubtitleContent } from '../services/subtitles.js';
import { probeMedia, codecLabel } from '../services/mediaProbe.js';

const router = Router();

router.get('/:id/subtitle/:index', (req, res) => {
  const item = getMediaById(parseInt(req.params.id));
  const index = parseInt(req.params.index);
  const track = item?.subtitles?.[index];

  if (!track || !fs.existsSync(track.path)) {
    return res.status(404).json({ error: 'Subtítulo no encontrado' });
  }

  const { content, contentType } = getSubtitleContent(track.path);
  res.setHeader('Content-Type', contentType);
  res.send(content);
});

router.get('/:id/info', async (req, res) => {
  const item = getMediaById(parseInt(req.params.id));
  if (!item) return res.status(404).json({ error: 'No encontrado' });

  const exists = item.file_path ? fs.existsSync(item.file_path) : false;
  let probe = null;
  if (exists && item.file_path) {
    probe = await probeMedia(item.file_path);
  }

  res.json({
    title: item.title,
    file_path: item.file_path,
    file_size: item.file_size,
    subtitles: item.subtitles || [],
    exists,
    probe: probe ? {
      ...probe,
      audioTracks: probe.audioTracks.map(t => ({
        ...t,
        codecLabel: codecLabel(t.codec),
      })),
      videoCodecLabel: probe.videoCodec ? codecLabel(probe.videoCodec) : null,
    } : null,
  });
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

  res.setHeader('Content-Type', 'video/mp4');
  res.setHeader('Transfer-Encoding', 'chunked');
  res.setHeader('Cache-Control', 'no-store');

  const args = [
    '-hide_banner', '-loglevel', 'error',
    '-i', item.file_path,
    '-map', '0:v:0?',
    '-map', `0:a:${audioIdx}?`,
    '-c:v', 'copy',
    '-c:a', 'aac', '-b:a', '192k', '-ac', '2',
    '-f', 'mp4',
    '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
    'pipe:1',
  ];

  const ffmpeg = spawn('ffmpeg', args);

  ffmpeg.on('error', () => {
    if (!res.headersSent) res.status(500).json({ error: 'ffmpeg no disponible' });
    else res.end();
  });

  ffmpeg.stderr.on('data', chunk => {
    console.error('[ffmpeg compat]', chunk.toString().trim());
  });

  ffmpeg.stdout.pipe(res);

  const cleanup = () => ffmpeg.kill('SIGKILL');
  req.on('close', cleanup);
  res.on('close', cleanup);
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
    });

    fs.createReadStream(item.file_path, { start, end }).pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes',
    });
    fs.createReadStream(item.file_path).pipe(res);
  }
});

export default router;
