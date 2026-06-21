import { Router } from 'express';
import fs from 'fs';
import mime from 'mime-types';
import { getMediaById } from '../db/database.js';
import { getSubtitleContent } from '../services/subtitles.js';

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

router.get('/:id/info', (req, res) => {
  const item = getMediaById(parseInt(req.params.id));
  if (!item) return res.status(404).json({ error: 'No encontrado' });

  res.json({
    title: item.title,
    file_path: item.file_path,
    file_size: item.file_size,
    subtitles: item.subtitles || [],
    exists: item.file_path ? fs.existsSync(item.file_path) : false,
  });
});

export default router;
