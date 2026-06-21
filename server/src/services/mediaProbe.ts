import { execFile } from 'child_process';
import { promisify } from 'util';

const exec = promisify(execFile);

const BROWSER_AUDIO_CODECS = new Set(['aac', 'mp3', 'opus', 'vorbis', 'flac', 'pcm_s16le', 'pcm_s24le']);

export interface MediaProbeResult {
  audioTracks: Array<{ index: number; codec: string; language: string; channels: number }>;
  videoCodec: string | null;
  browserFriendlyAudio: boolean;
  recommendedAudioIndex: number;
  duration: number | null;
}

export async function probeMedia(filePath: string): Promise<MediaProbeResult | null> {
  try {
    const { stdout } = await exec('ffprobe', [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_streams',
      '-show_format',
      filePath,
    ]);
    const data = JSON.parse(stdout) as {
      format?: { duration?: string };
      streams?: Array<{
        codec_type?: string;
        codec_name?: string;
        tags?: { language?: string };
        channels?: number;
      }>;
    };

    const audioStreams = (data.streams || []).filter(s => s.codec_type === 'audio');
    const videoStream = (data.streams || []).find(s => s.codec_type === 'video');

    const durationRaw = parseFloat(data.format?.duration || '');
    const duration = Number.isFinite(durationRaw) && durationRaw > 0 ? durationRaw : null;

    if (audioStreams.length === 0) {
      return {
        audioTracks: [],
        videoCodec: videoStream?.codec_name ?? null,
        browserFriendlyAudio: false,
        recommendedAudioIndex: 0,
        duration,
      };
    }

    const audioTracks = audioStreams.map((s, index) => ({
      index,
      codec: s.codec_name || 'unknown',
      language: s.tags?.language || 'und',
      channels: s.channels || 0,
    }));

    const browserFriendlyAudio = audioTracks.some(t =>
      BROWSER_AUDIO_CODECS.has(t.codec.toLowerCase()),
    );

    const preferLang = ['spa', 'es', 'eng', 'en', 'jpn', 'ja'];
    let recommended = audioTracks.findIndex(t => BROWSER_AUDIO_CODECS.has(t.codec.toLowerCase()));
    if (recommended < 0) recommended = 0;

    for (const lang of preferLang) {
      const idx = audioTracks.findIndex(
        t => t.language.toLowerCase().startsWith(lang) && BROWSER_AUDIO_CODECS.has(t.codec.toLowerCase()),
      );
      if (idx >= 0) {
        recommended = idx;
        break;
      }
    }

    if (recommended < 0) {
      const anyFriendly = audioTracks.findIndex(t => BROWSER_AUDIO_CODECS.has(t.codec.toLowerCase()));
      recommended = anyFriendly >= 0 ? anyFriendly : 0;
    }

    return {
      audioTracks,
      videoCodec: videoStream?.codec_name ?? null,
      browserFriendlyAudio,
      recommendedAudioIndex: recommended,
      duration,
    };
  } catch {
    return null;
  }
}

export function codecLabel(codec: string): string {
  const map: Record<string, string> = {
    aac: 'AAC', ac3: 'AC3 (Dolby)', eac3: 'E-AC3', dts: 'DTS',
    truehd: 'TrueHD', flac: 'FLAC', mp3: 'MP3', opus: 'Opus',
    vorbis: 'Vorbis', h264: 'H.264', hevc: 'H.265/HEVC', h265: 'H.265/HEVC',
  };
  return map[codec.toLowerCase()] || codec.toUpperCase();
}
