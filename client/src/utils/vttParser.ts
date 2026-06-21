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
    .replace(/<(\/?)(b|i|u)>/gi, '')
    .replace(/<\d{2}:\d{2}[^>]*>/g, '')
    .replace(/\{[^}]*\}/g, '')
    .replace(/\\N/g, '\n')
    .replace(/\\n/g, '\n')
    .trim();
}

export function parseVtt(content: string): VttCue[] {
  const cues: VttCue[] = [];
  const normalized = content.replace(/\r/g, '').trim();
  if (!normalized) return cues;

  const blocks = normalized.split(/\n\n+/);
  for (const block of blocks) {
    const lines = block.split('\n').filter(Boolean);
    if (lines.length === 0 || lines[0].startsWith('WEBVTT') || lines[0].startsWith('NOTE')) continue;

    let timeLineIdx = lines.findIndex(l => l.includes('-->'));
    if (timeLineIdx < 0 && lines.length >= 2 && /^\d+$/.test(lines[0])) {
      timeLineIdx = lines.findIndex((l, i) => i > 0 && l.includes('-->'));
    }
    if (timeLineIdx < 0) continue;

    const timeLine = lines[timeLineIdx];
    const [startRaw, endRaw] = timeLine.split('-->');
    const start = parseVttTimestamp(startRaw);
    const end = parseVttTimestamp(endRaw.split(/\s+/)[0]);
    const text = cleanCueText(lines.slice(timeLineIdx + 1).join('\n'));
    if (!text || end <= start) continue;

    cues.push({ start, end, text });
  }

  return cues.sort((a, b) => a.start - b.start);
}

export function findActiveCue(cues: VttCue[], timeSec: number): VttCue | null {
  for (const cue of cues) {
    if (timeSec >= cue.start && timeSec < cue.end) return cue;
  }
  return null;
}
