export interface VttCue {
  start: number;
  end: number;
  text: string;
}

function parseVttTimestamp(raw: string): number {
  const t = raw.trim().replace(',', '.');
  const parts = t.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parseFloat(t) || 0;
}

function cleanCueText(text: string): string {
  return text
    .replace(/<\/?[^>]+>/g, '')
    .replace(/\{[^}]*\}/g, '')
    .replace(/\\N/g, '\n')
    .replace(/\\n/g, '\n')
    .trim();
}

function parseCueBlock(lines: string[]): VttCue | null {
  const timeLineIdx = lines.findIndex(l => l.includes('-->'));
  if (timeLineIdx < 0) return null;

  const timeLine = lines[timeLineIdx];
  const [startRaw, endPart] = timeLine.split('-->');
  if (!startRaw || !endPart) return null;

  const start = parseVttTimestamp(startRaw);
  const end = parseVttTimestamp(endPart.split(/\s+/)[0]);
  const text = cleanCueText(lines.slice(timeLineIdx + 1).join('\n'));
  if (!text || end <= start) return null;

  return { start, end, text };
}

/** Parser línea a línea — más tolerante con salida de ffmpeg. */
function parseVttLineByLine(content: string): VttCue[] {
  const cues: VttCue[] = [];
  const lines = content.replace(/^\uFEFF/, '').replace(/\r/g, '').split('\n');

  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    i++;

    if (!line || line.startsWith('WEBVTT') || line.startsWith('NOTE') || line.startsWith('STYLE')
      || line.startsWith('REGION') || line.startsWith('Kind:') || line.startsWith('Language:')) {
      continue;
    }

    if (line.includes('-->')) {
      const cue = parseCueBlock([line, ...lines.slice(i).filter((l, idx) => {
        if (idx === 0) return true;
        const t = l.trim();
        return t !== '' && !t.includes('-->');
      }).slice(0, 8)]);
      if (cue) {
        cues.push(cue);
        while (i < lines.length && lines[i].trim() !== '' && !lines[i].includes('-->')) i++;
      }
      continue;
    }

    if (/^\d+$/.test(line) && i < lines.length && lines[i].includes('-->')) {
      const block: string[] = [];
      while (i < lines.length) {
        const l = lines[i];
        if (block.length > 0 && l.trim() === '') break;
        block.push(l);
        i++;
        if (block.some(x => x.includes('-->')) && i < lines.length && lines[i].trim() === '') break;
      }
      const cue = parseCueBlock(block);
      if (cue) cues.push(cue);
    }
  }

  return cues;
}

export function parseVtt(content: string): VttCue[] {
  const normalized = content.replace(/^\uFEFF/, '').replace(/\r/g, '').trim();
  if (!normalized) return [];

  const cues: VttCue[] = [];
  const blocks = normalized.split(/\n\n+/);

  for (const block of blocks) {
    const lines = block.split('\n').filter(l => {
      const t = l.trim();
      return t && !t.startsWith('STYLE') && !t.startsWith('REGION');
    });
    if (lines.length === 0 || lines[0].startsWith('WEBVTT') || lines[0].startsWith('NOTE')) continue;

    let timeLineIdx = lines.findIndex(l => l.includes('-->'));
    if (timeLineIdx < 0 && lines.length >= 2 && /^\d+$/.test(lines[0])) {
      timeLineIdx = lines.findIndex((l, idx) => idx > 0 && l.includes('-->'));
    }
    if (timeLineIdx < 0) continue;

    const cue = parseCueBlock(lines.slice(timeLineIdx));
    if (cue) cues.push(cue);
  }

  if (cues.length === 0) {
    return parseVttLineByLine(normalized);
  }

  return cues.sort((a, b) => a.start - b.start);
}

export function findActiveCue(cues: VttCue[], timeSec: number): VttCue | null {
  if (cues.length === 0) return null;

  let lo = 0;
  let hi = cues.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (cues[mid].start > timeSec) hi = mid - 1;
    else lo = mid + 1;
  }

  for (let i = Math.min(hi, cues.length - 1); i >= 0; i--) {
    const cue = cues[i];
    if (timeSec >= cue.start && timeSec < cue.end) return cue;
  }
  return null;
}
