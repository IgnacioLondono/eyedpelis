import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Subtitles } from 'lucide-react';
import { api } from '../api';
import type { MediaItem, SubtitleTrack } from '../types';

export default function Player() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [media, setMedia] = useState<MediaItem | null>(null);
  const [activeSub, setActiveSub] = useState<number>(-1);

  useEffect(() => {
    if (!id) return;
    api.getMedia(parseInt(id)).then(setMedia).catch(console.error);
  }, [id]);

  if (!media) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-pulse text-gray-400">Cargando reproductor...</div>
      </div>
    );
  }

  const title = media.season
    ? `${media.title} - S${String(media.season).padStart(2, '0')}E${String(media.episode).padStart(2, '0')}`
    : media.title;

  const subtitles: SubtitleTrack[] = media.subtitles || [];

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <div className="flex items-center gap-4 p-4 bg-black/80">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-lg font-semibold truncate flex-1">{title}</h1>

        {subtitles.length > 0 && (
          <div className="flex items-center gap-2">
            <Subtitles size={18} className="text-gray-400" />
            <select
              value={activeSub}
              onChange={e => setActiveSub(parseInt(e.target.value))}
              className="bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-sm focus:outline-none"
            >
              <option value={-1}>Sin subtítulos</option>
              {subtitles.map((sub, i) => (
                <option key={i} value={i}>{sub.label}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="flex-1 flex items-center justify-center">
        <video
          key={`${media.id}-${activeSub}`}
          src={api.streamUrl(media.id)}
          controls
          autoPlay
          className="w-full max-h-[calc(100vh-80px)]"
          controlsList="nodownload"
        >
          {activeSub >= 0 && subtitles[activeSub] && (
            <track
              kind="subtitles"
              src={api.subtitleUrl(media.id, activeSub)}
              srcLang={subtitles[activeSub].language}
              label={subtitles[activeSub].label}
              default
            />
          )}
          Tu navegador no soporta reproducción de video.
        </video>
      </div>
    </div>
  );
}
