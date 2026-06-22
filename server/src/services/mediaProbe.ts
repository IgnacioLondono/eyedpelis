import { execFile } from 'child_process';
import { promisify } from 'util';

const exec = promisify(execFile);

const BROWSER_AUDIO_CODECS = new Set(['aac', 'mp3', 'opus', 'vorbis', 'flac', 'pcm_s16le', 'pcm_s24le']);

export interface MediaProbeResult {
  audioTracks: Array<{ index: number; streamIndex: number; codec: string; language: string; channels: number }>;
  videoCodec: string | null;
  browserFriendlyAudio: boolean;
  /** Requiere transcode: códec incompatible o pista de audio distinta a la primera del archivo */
  needsCompatAudio: boolean;
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
        index?: number;
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
        needsCompatAudio: true,
        recommendedAudioIndex: 0,
        duration,
      };
    }

    const audioTracks = audioStreams.map((s, index) => ({
      index,
      streamIndex: s.index ?? index,
      codec: s.codec_name || 'unknown',
      language: s.tags?.language || 'und',
      channels: s.channels || 0,
    }));

    const isFriendly = (codec: string) => BROWSER_AUDIO_CODECS.has(codec.toLowerCase());

    const browserFriendlyAudio = audioTracks.some(t => isFriendly(t.codec));
    const firstTrackFriendly = audioTracks.length > 0 && isFriendly(audioTracks[0].codec);

    const preferLang = ['spa', 'es', 'eng', 'en', 'jpn', 'ja'];
    let recommended = 0;

    for (const lang of preferLang) {
      const idx = audioTracks.findIndex(t => t.language.toLowerCase().startsWith(lang));
      if (idx >= 0) {
        recommended = idx;
        break;
      }
    }

    if (!audioTracks.some(t => t.language.toLowerCase().startsWith(preferLang[0]))) {
      const friendlyIdx = audioTracks.findIndex(t => isFriendly(t.codec));
      if (friendlyIdx >= 0) recommended = friendlyIdx;
    }

    const recommendedTrack = audioTracks[recommended];
    const recommendedFriendly = recommendedTrack ? isFriendly(recommendedTrack.codec) : firstTrackFriendly;

    // Compat solo si el navegador no puede reproducir la pista que queremos escuchar
    const needsCompatAudio =
      !recommendedFriendly ||
      recommended !== 0 ||
      !firstTrackFriendly;

    return {
      audioTracks,
      videoCodec: videoStream?.codec_name ?? null,
      browserFriendlyAudio,
      needsCompatAudio,
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
