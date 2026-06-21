import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Play, Star, Calendar, Clock, Globe, Film, Tv, Subtitles, HardDrive, Tag, FolderOpen, ChevronDown,
} from 'lucide-react';
import { api, backdropUrl, posterUrl, stillUrl, formatDate, formatBytes } from '../api';
import { languageLabel, formatRuntime } from '../utils/tmdbHelpers';
import type { MediaItem, SubtitleTrack } from '../types';
import type { TmdbDetails, TmdbEpisodeInfo } from '../utils/tmdbHelpers';

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

  const episodesBySeason = useMemo(() => {
    const groups = new Map<number, MediaItem[]>();
    for (const ep of episodes) {
      const season = ep.season ?? 0;
      if (!groups.has(season)) groups.set(season, []);
      groups.get(season)!.push(ep);
    }
    return [...groups.entries()].sort(([a], [b]) => a - b);
  }, [episodes]);

  const firstEpisode = episodes.find(e => e.season === 1 && e.episode === 1) ?? episodes[0];

  const seasonMeta = useMemo(() => {
    const map = new Map<number, { poster: string | null; name: string; overview?: string }>();
    tmdb?.seasons?.forEach(s => {
      map.set(s.season_number, {
        poster: s.poster_path ?? null,
        name: s.name || `Temporada ${s.season_number}`,
        overview: s.overview,
      });
    });
    return map;
  }, [tmdb]);

  const [selectedSeason, setSelectedSeason] = useState<number | null>(null);
  const activeSeason = selectedSeason ?? episodesBySeason[0]?.[0] ?? null;
  const activeEpisodes = episodesBySeason.find(([s]) => s === activeSeason)?.[1] ?? [];

  function getSeasonPoster(season: number): string | null {
    return seasonMeta.get(season)?.poster ?? poster ?? null;
  }

  function getSeasonName(season: number): string {
    return seasonMeta.get(season)?.name ?? (season > 0 ? `Temporada ${season}` : 'Especiales');
  }

  const tmdbSeriesId = media?.tmdb_id ?? tmdb?.id;
  const [tmdbEpisodes, setTmdbEpisodes] = useState<Map<number, TmdbEpisodeInfo>>(new Map());
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);

  useEffect(() => {
    if (!tmdbSeriesId || activeSeason === null) {
      setTmdbEpisodes(new Map());
      return;
    }
    setLoadingEpisodes(true);
    api.getSeasonDetails(tmdbSeriesId, activeSeason)
      .then(data => {
        const map = new Map<number, TmdbEpisodeInfo>();
        data.episodes.forEach(ep => map.set(ep.episode_number, ep));
        setTmdbEpisodes(map);
      })
      .catch(() => setTmdbEpisodes(new Map()))
      .finally(() => setLoadingEpisodes(false));
  }, [tmdbSeriesId, activeSeason]);

  function getEpisodeMeta(ep: MediaItem): TmdbEpisodeInfo | undefined {
    return tmdbEpisodes.get(ep.episode ?? 0);
  }

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
                <Link to={`/watch/${firstEpisode.id}`} className="btn-primary inline-flex items-center gap-2">
                  <Play size={18} fill="white" /> Ver T{String(firstEpisode.season).padStart(2, '0')}E{String(firstEpisode.episode).padStart(2, '0')}
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
            <h2 className="text-xl font-bold mb-6">Temporadas en tu biblioteca</h2>

            {/* Carpetas con portada */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-8">
              {episodesBySeason.map(([season, seasonEpisodes]) => {
                const isActive = activeSeason === season;
                const seasonPoster = getSeasonPoster(season);
                return (
                  <button
                    key={season}
                    type="button"
                    onClick={() => setSelectedSeason(season)}
                    className={`group text-left rounded-xl overflow-hidden transition-all duration-300 ${
                      isActive
                        ? 'ring-2 ring-accent shadow-purple scale-[1.02]'
                        : 'ring-1 ring-purple-500/15 hover:ring-purple-500/40 hover:scale-[1.03]'
                    }`}
                  >
                    <div className="relative aspect-[2/3] bg-surface-card">
                      {/* Pestaña carpeta */}
                      <div className="absolute top-0 left-3 right-3 h-3 bg-purple-900/80 rounded-t-md z-10 border border-b-0 border-purple-500/30" />
                      <img
                        src={posterUrl(seasonPoster)}
                        alt={getSeasonName(season)}
                        className="absolute inset-0 w-full h-full object-cover pt-2 transition-transform duration-500 group-hover:scale-105"
                        onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder-poster.svg'; }}
                      />
                      <div className="absolute inset-0 pt-2 bg-gradient-to-t from-black via-black/50 to-transparent" />
                      <div className="absolute top-4 left-3 z-20">
                        <FolderOpen size={18} className="text-accent-glow drop-shadow" />
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 p-3 z-20">
                        <p className="font-bold text-sm leading-tight">{getSeasonName(season)}</p>
                        <p className="text-xs text-gray-300 mt-1">
                          {seasonEpisodes.length} {seasonEpisodes.length === 1 ? 'episodio' : 'episodios'}
                        </p>
                      </div>
                      {isActive && (
                        <div className="absolute top-4 right-3 z-20 bg-accent rounded-full p-1">
                          <ChevronDown size={14} />
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Episodios de la temporada seleccionada */}
            {activeSeason !== null && activeEpisodes.length > 0 && (
              <section className="bg-surface-card/40 border border-purple-500/15 rounded-2xl p-5 md:p-6">
                <div className="flex items-center justify-between gap-4 mb-4">
                  <h3 className="text-lg font-semibold text-accent-glow flex items-center gap-2">
                    <Tv size={18} />
                    {getSeasonName(activeSeason)}
                  </h3>
                  <Link
                    to={`/watch/${activeEpisodes[0].id}`}
                    className="btn-primary text-sm py-2 px-4 inline-flex items-center gap-2"
                  >
                    <Play size={14} fill="white" />
                    Reproducir T{String(activeSeason).padStart(2, '0')}E{String(activeEpisodes[0].episode).padStart(2, '0')}
                  </Link>
                </div>
                {seasonMeta.get(activeSeason)?.overview && (
                  <p className="text-sm text-gray-400 mb-4 line-clamp-2">{seasonMeta.get(activeSeason)?.overview}</p>
                )}
                <div className="space-y-3">
                  {loadingEpisodes && (
                    <div className="space-y-3">
                      {activeEpisodes.map(ep => (
                        <div key={ep.id} className="h-28 rounded-xl shimmer-bg" />
                      ))}
                    </div>
                  )}
                  {!loadingEpisodes && activeEpisodes.map(ep => {
                    const meta = getEpisodeMeta(ep);
                    const epName = meta?.name || `Episodio ${ep.episode}`;
                    const epOverview = meta?.overview;
                    const still = meta?.still_path ?? null;
                    return (
                      <Link
                        key={ep.id}
                        to={`/watch/${ep.id}`}
                        className="flex gap-4 bg-surface border border-purple-500/10 rounded-xl overflow-hidden hover:border-accent/40 hover:bg-surface-hover transition-all duration-300 group"
                      >
                        <div className="relative w-36 sm:w-44 md:w-52 flex-shrink-0 aspect-video bg-surface-card">
                          <img
                            src={stillUrl(still)}
                            alt={epName}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                            loading="lazy"
                            onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder-poster.svg'; }}
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-accent rounded-full p-2.5 shadow-purple">
                              <Play size={20} fill="white" />
                            </div>
                          </div>
                          <span className="absolute top-2 left-2 bg-black/75 backdrop-blur text-xs font-bold px-2 py-0.5 rounded-md text-accent-glow">
                            E{String(ep.episode).padStart(2, '0')}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0 py-3 pr-4 flex flex-col justify-center">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <h4 className="font-semibold text-sm md:text-base group-hover:text-white transition-colors line-clamp-2">
                              {epName}
                            </h4>
                            {meta?.vote_average != null && meta.vote_average > 0 && (
                              <span className="flex items-center gap-1 text-xs text-yellow-400 flex-shrink-0">
                                <Star size={12} fill="currentColor" />
                                {meta.vote_average.toFixed(1)}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 mb-1.5">
                            {meta?.air_date && (
                              <span className="inline-flex items-center gap-1">
                                <Calendar size={12} />
                                {formatDate(meta.air_date)}
                              </span>
                            )}
                            {meta?.runtime ? (
                              <span className="inline-flex items-center gap-1">
                                <Clock size={12} />
                                {formatRuntime(meta.runtime)}
                              </span>
                            ) : null}
                            {ep.subtitles && ep.subtitles.length > 0 && (
                              <span className="inline-flex items-center gap-1">
                                <Subtitles size={12} />
                                {ep.subtitles.length} subs
                              </span>
                            )}
                          </div>
                          {epOverview && (
                            <p className="text-xs md:text-sm text-gray-400 line-clamp-2 leading-relaxed">{epOverview}</p>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
