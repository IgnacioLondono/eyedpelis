import { Link } from 'react-router-dom';
import {
  Play, Star, Calendar, Clock, Globe, Film, Tv, Subtitles, HardDrive, Tag,
} from 'lucide-react';
import { backdropUrl, posterUrl, formatDate, formatBytes } from '../api';
import { languageLabel, formatRuntime } from '../utils/tmdbHelpers';
import type { MediaItem, SubtitleTrack } from '../types';
import type { TmdbDetails } from '../utils/tmdbHelpers';

interface Props {
  media?: MediaItem | null;
  tmdb?: TmdbDetails | null;
  libraryId?: number;
  type: 'movie' | 'series';
  episodes?: MediaItem[];
}

export default function MediaDetailView({ media, tmdb, libraryId, type, episodes = [] }: Props) {
  const title = tmdb?.title || tmdb?.name || media?.title || 'Sin título';
  const originalTitle = tmdb?.original_title || tmdb?.original_name || media?.original_title;
  const overview = tmdb?.overview || media?.overview;
  const poster = tmdb?.poster_path ?? media?.poster_path;
  const backdrop = tmdb?.backdrop_path ?? media?.backdrop_path;
  const releaseDate = tmdb?.release_date || tmdb?.first_air_date || media?.release_date;
  const rating = tmdb?.vote_average ?? media?.vote_average;
  const voteCount = tmdb?.vote_count;
  const tagline = tmdb?.tagline;
  const genres = tmdb?.genres?.map(g => g.name) ?? (media?.genres?.split(',').filter(Boolean) || []);
  const runtime = tmdb?.runtime || tmdb?.episode_run_time?.[0];
  const language = languageLabel(tmdb?.original_language);
  const spoken = tmdb?.spoken_languages?.map(l => l.name || languageLabel(l.iso_639_1)).join(', ');
  const countries = tmdb?.production_countries?.map(c => c.name).join(', ');
  const subtitles: SubtitleTrack[] = media?.subtitles || [];
  const canPlay = media?.file_path && libraryId;
  const isSeries = type === 'series';

  return (
    <div className="pb-12">
      {/* Banner de fondo */}
      <div className="relative h-[45vh] md:h-[55vh] overflow-hidden">
        {backdrop ? (
          <img
            src={backdropUrl(backdrop)}
            alt=""
            className="absolute inset-0 w-full h-full object-cover animate-ken-burns"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-purple-900/40 to-surface" />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-surface via-surface/70 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-transparent to-transparent" />
      </div>

      {/* Contenido */}
      <div className="relative -mt-36 md:-mt-40 px-6 md:px-12 max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row gap-8 animate-fade-in-up">
          {/* Poster */}
          <div className="flex-shrink-0 mx-auto md:mx-0">
            <img
              src={posterUrl(poster ?? null)}
              alt={title}
              className="w-44 md:w-56 rounded-xl shadow-purple-lg ring-2 ring-purple-500/20"
            />
          </div>

          <div className="flex-1 min-w-0">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-accent-glow bg-accent/10 border border-purple-500/20 px-3 py-1 rounded-full mb-3">
              {isSeries ? <Tv size={12} /> : <Film size={12} />}
              {isSeries ? 'Serie' : 'Película'}
            </span>

            <h1 className="text-3xl md:text-5xl font-extrabold mb-1 leading-tight">{title}</h1>

            {originalTitle && originalTitle !== title && (
              <p className="text-gray-400 text-lg mb-2">{originalTitle}</p>
            )}

            {tagline && (
              <p className="text-accent-glow/80 italic text-sm md:text-base mb-4 flex items-start gap-2">
                <Tag size={16} className="mt-0.5 flex-shrink-0" />
                {tagline}
              </p>
            )}

            {/* Meta chips */}
            <div className="flex flex-wrap gap-2 mb-5">
              {rating != null && rating > 0 && (
                <span className="inline-flex items-center gap-1.5 bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 px-3 py-1.5 rounded-lg text-sm font-semibold">
                  <Star size={14} fill="currentColor" />
                  {rating.toFixed(1)}
                  {voteCount ? <span className="text-yellow-500/60 font-normal">({voteCount.toLocaleString()})</span> : null}
                </span>
              )}
              {releaseDate && (
                <span className="inline-flex items-center gap-1.5 bg-surface-card border border-purple-500/15 text-gray-300 px-3 py-1.5 rounded-lg text-sm">
                  <Calendar size={14} />
                  {formatDate(releaseDate)}
                </span>
              )}
              {runtime ? (
                <span className="inline-flex items-center gap-1.5 bg-surface-card border border-purple-500/15 text-gray-300 px-3 py-1.5 rounded-lg text-sm">
                  <Clock size={14} />
                  {formatRuntime(runtime)}
                </span>
              ) : null}
              {language && (
                <span className="inline-flex items-center gap-1.5 bg-surface-card border border-purple-500/15 text-gray-300 px-3 py-1.5 rounded-lg text-sm">
                  <Globe size={14} />
                  {language}
                </span>
              )}
              {isSeries && tmdb?.number_of_seasons && (
                <span className="inline-flex items-center gap-1.5 bg-surface-card border border-purple-500/15 text-gray-300 px-3 py-1.5 rounded-lg text-sm">
                  {tmdb.number_of_seasons} temp · {tmdb.number_of_episodes ?? episodes.length} eps
                </span>
              )}
              {media?.file_size && (
                <span className="inline-flex items-center gap-1.5 bg-surface-card border border-purple-500/15 text-gray-300 px-3 py-1.5 rounded-lg text-sm">
                  <HardDrive size={14} />
                  {formatBytes(media.file_size)}
                </span>
              )}
            </div>

            {/* Géneros */}
            {genres.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-5">
                {genres.map(g => (
                  <span key={g} className="text-xs bg-purple-500/10 text-purple-300 border border-purple-500/20 px-3 py-1 rounded-full">
                    {g}
                  </span>
                ))}
              </div>
            )}

            {/* Botón reproducir */}
            <div className="flex flex-wrap gap-3 mb-6">
              {canPlay ? (
                <Link to={`/watch/${libraryId}`} className="btn-primary inline-flex items-center gap-2 text-base px-8 py-3">
                  <Play size={20} fill="white" /> Reproducir
                </Link>
              ) : isSeries && episodes.length > 0 ? (
                <Link to={`/watch/${episodes[0].id}`} className="btn-primary inline-flex items-center gap-2">
                  <Play size={18} fill="white" /> Ver T1E1
                </Link>
              ) : null}
            </div>

            {/* Sinopsis */}
            {overview && (
              <div className="mb-6">
                <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">Sinopsis</h2>
                <p className="text-gray-300 leading-relaxed text-base max-w-3xl">{overview}</p>
              </div>
            )}

            {/* Detalles extra */}
            <div className="grid sm:grid-cols-2 gap-4 text-sm">
              {spoken && (
                <div className="bg-surface-card/50 border border-purple-500/10 rounded-xl p-4">
                  <p className="text-gray-500 mb-1">Idiomas</p>
                  <p className="text-gray-200">{spoken}</p>
                </div>
              )}
              {countries && (
                <div className="bg-surface-card/50 border border-purple-500/10 rounded-xl p-4">
                  <p className="text-gray-500 mb-1">País</p>
                  <p className="text-gray-200">{countries}</p>
                </div>
              )}
              {subtitles.length > 0 && (
                <div className="bg-surface-card/50 border border-purple-500/10 rounded-xl p-4">
                  <p className="text-gray-500 mb-1 flex items-center gap-1"><Subtitles size={14} /> Subtítulos disponibles</p>
                  <p className="text-gray-200">{subtitles.map(s => s.label).join(', ')}</p>
                </div>
              )}
              {tmdb?.status && (
                <div className="bg-surface-card/50 border border-purple-500/10 rounded-xl p-4">
                  <p className="text-gray-500 mb-1">Estado</p>
                  <p className="text-gray-200">{tmdb.status}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Episodios (series) */}
        {isSeries && episodes.length > 0 && (
          <div className="mt-12 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
            <h2 className="text-xl font-bold mb-4">Episodios en tu biblioteca</h2>
            <div className="space-y-2">
              {episodes.map(ep => (
                <Link
                  key={ep.id}
                  to={`/watch/${ep.id}`}
                  className="flex items-center gap-4 bg-surface-card border border-purple-500/10 rounded-xl p-4 hover:border-accent/40 hover:bg-surface-hover transition-all duration-300 group"
                >
                  <span className="text-sm font-mono text-accent w-16">
                    S{String(ep.season).padStart(2, '0')}E{String(ep.episode).padStart(2, '0')}
                  </span>
                  <span className="text-sm flex-1 truncate group-hover:text-white transition-colors">{ep.title}</span>
                  {ep.subtitles && ep.subtitles.length > 0 && (
                    <Subtitles size={14} className="text-gray-500" />
                  )}
                  <Play size={16} className="text-accent opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
