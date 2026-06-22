import { getTmdbApiKey } from '../config.js';
import type { MediaType, TmdbSearchResult } from '../types.js';

const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMAGE = 'https://image.tmdb.org/t/p';

export function posterUrl(path: string | null, size = 'w500'): string | null {
  return path ? `${TMDB_IMAGE}/${size}${path}` : null;
}

export function backdropUrl(path: string | null, size = 'w1280'): string | null {
  return path ? `${TMDB_IMAGE}/${size}${path}` : null;
}

async function tmdbFetch<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const apiKey = getTmdbApiKey();
  if (!apiKey) throw new Error('TMDB API key no configurada. Ve a Configuración.');

  const url = new URL(`${TMDB_BASE}${endpoint}`);
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('language', 'es-ES');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`TMDB error: ${res.status}`);
  return res.json() as Promise<T>;
}

function mapMovieResult(r: Record<string, unknown>): TmdbSearchResult {
  return {
    id: r.id as number,
    type: 'movie',
    title: r.title as string,
    original_title: r.original_title as string | undefined,
    overview: (r.overview as string) || '',
    poster_path: r.poster_path as string | null,
    backdrop_path: r.backdrop_path as string | null,
    release_date: r.release_date as string | null,
    vote_average: (r.vote_average as number) || 0,
    genre_ids: r.genre_ids as number[] | undefined,
  };
}

function mapSeriesResult(r: Record<string, unknown>): TmdbSearchResult {
  return {
    id: r.id as number,
    type: 'series',
    title: r.name as string,
    original_title: r.original_name as string | undefined,
    overview: (r.overview as string) || '',
    poster_path: r.poster_path as string | null,
    backdrop_path: r.backdrop_path as string | null,
    release_date: r.first_air_date as string | null,
    vote_average: (r.vote_average as number) || 0,
    genre_ids: r.genre_ids as number[] | undefined,
  };
}

let movieGenreMap: Map<number, string> | null = null;
let tvGenreMap: Map<number, string> | null = null;

async function ensureGenreMaps() {
  if (!movieGenreMap) {
    const data = await tmdbFetch<{ genres: Array<{ id: number; name: string }> }>('/genre/movie/list');
    movieGenreMap = new Map(data.genres.map(g => [g.id, g.name]));
  }
  if (!tvGenreMap) {
    const data = await tmdbFetch<{ genres: Array<{ id: number; name: string }> }>('/genre/tv/list');
    tvGenreMap = new Map(data.genres.map(g => [g.id, g.name]));
  }
}

export function genreIdsToString(type: MediaType, ids?: number[]): string | null {
  if (!ids?.length) return null;
  const map = type === 'movie' ? movieGenreMap : tvGenreMap;
  if (!map) return null;
  const names = ids.map(id => map.get(id)).filter(Boolean);
  return names.length ? names.join(', ') : null;
}

async function resolveGenres(type: MediaType, tmdb: TmdbSearchResult): Promise<string | null> {
  await ensureGenreMaps();
  const fromIds = genreIdsToString(type, tmdb.genre_ids);
  if (fromIds) return fromIds;
  try {
    const details = type === 'movie'
      ? await getMovieDetails(tmdb.id)
      : await getSeriesDetails(tmdb.id);
    const genres = (details as { genres?: Array<{ name: string }> }).genres;
    return genres?.map(g => g.name).join(', ') ?? null;
  } catch {
    return null;
  }
}

function pickByYear(results: TmdbSearchResult[], year?: number): TmdbSearchResult | null {
  if (!results.length) return null;
  if (!year) return results[0];

  const exact = results.find(r => {
    if (!r.release_date) return false;
    return parseInt(r.release_date.slice(0, 4)) === year;
  });
  if (exact) return exact;

  const close = results.find(r => {
    if (!r.release_date) return false;
    return Math.abs(parseInt(r.release_date.slice(0, 4)) - year) <= 1;
  });
  return close ?? results[0];
}

function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9áéíóúñ]/gi, '').trim();
}

function pickBestMatch(results: TmdbSearchResult[], title: string, year?: number): TmdbSearchResult | null {
  if (!results.length) return null;

  const norm = normalizeTitle(title);
  const byTitle = results.find(r =>
    normalizeTitle(r.title) === norm ||
    normalizeTitle(r.original_title || '') === norm
  );
  if (byTitle) return pickByYear([byTitle, ...results.filter(r => r.id !== byTitle.id)], year);

  return pickByYear(results, year);
}

export async function searchMovie(title: string, year?: number): Promise<TmdbSearchResult | null> {
  const params: Record<string, string> = { query: title };
  if (year) params.year = String(year);

  const data = await tmdbFetch<{ results: Array<Record<string, unknown>> }>('/search/movie', params);
  const results = data.results.map(mapMovieResult);
  return pickBestMatch(results, title, year);
}

export async function searchSeries(title: string, year?: number): Promise<TmdbSearchResult | null> {
  const params: Record<string, string> = { query: title };
  if (year) params.first_air_date_year = String(year);

  const data = await tmdbFetch<{ results: Array<Record<string, unknown>> }>('/search/tv', params);
  const results = data.results.map(mapSeriesResult);
  return pickBestMatch(results, title, year);
}

export async function searchMulti(query: string): Promise<TmdbSearchResult[]> {
  const data = await tmdbFetch<{ results: Array<Record<string, unknown>> }>('/search/multi', { query });
  return data.results
    .filter(r => r.media_type === 'movie' || r.media_type === 'tv')
    .map(r => ({
      id: r.id as number,
      type: (r.media_type === 'tv' ? 'series' : 'movie') as MediaType,
      title: (r.title || r.name) as string,
      original_title: (r.original_title || r.original_name) as string | undefined,
      overview: (r.overview as string) || '',
      poster_path: r.poster_path as string | null,
      backdrop_path: r.backdrop_path as string | null,
      release_date: (r.release_date || r.first_air_date) as string | null,
      vote_average: (r.vote_average as number) || 0,
      genre_ids: r.genre_ids as number[] | undefined,
    }));
}

export async function getMovieDetails(id: number) {
  return tmdbFetch(`/movie/${id}`);
}

export async function getSeriesDetails(id: number) {
  return tmdbFetch(`/tv/${id}`);
}

export async function getExternalIds(type: MediaType, tmdbId: number) {
  const endpoint = type === 'movie'
    ? `/movie/${tmdbId}/external_ids`
    : `/tv/${tmdbId}/external_ids`;
  return tmdbFetch<{ imdb_id: string | null; tvdb_id: number | null }>(endpoint);
}

export interface TmdbSeasonEpisode {
  episode_number: number;
  name: string;
  overview: string;
  still_path: string | null;
  air_date: string | null;
  runtime: number | null;
  vote_average: number;
}

export async function getSeasonDetails(seriesId: number, seasonNumber: number) {
  const data = await tmdbFetch<{
    season_number: number;
    name: string;
    overview: string;
    poster_path: string | null;
    episodes: Array<Record<string, unknown>>;
  }>(`/tv/${seriesId}/season/${seasonNumber}`);

  return {
    season_number: data.season_number,
    name: data.name,
    overview: data.overview || '',
    poster_path: data.poster_path as string | null,
    episodes: (data.episodes || []).map(e => ({
      episode_number: e.episode_number as number,
      name: (e.name as string) || `Episodio ${e.episode_number}`,
      overview: (e.overview as string) || '',
      still_path: e.still_path as string | null,
      air_date: (e.air_date as string) || null,
      runtime: (e.runtime as number) || null,
      vote_average: (e.vote_average as number) || 0,
    })) as TmdbSeasonEpisode[],
  };
}

export async function getPopular(type: MediaType, page = 1) {
  const endpoint = type === 'movie' ? '/movie/popular' : '/tv/popular';
  const data = await tmdbFetch<{ results: Array<Record<string, unknown>> }>(endpoint, { page: String(page) });
  return data.results.map(r => ({
    id: r.id as number,
    type,
    title: (r.title || r.name) as string,
    overview: (r.overview as string) || '',
    poster_path: r.poster_path as string | null,
    backdrop_path: r.backdrop_path as string | null,
    release_date: (r.release_date || r.first_air_date) as string | null,
    vote_average: (r.vote_average as number) || 0,
  }));
}

export async function enrichFromTmdb(
  title: string,
  type: MediaType,
  year?: number,
): Promise<TmdbSearchResult | null> {
  try {
    const search = type === 'movie' ? searchMovie : searchSeries;

    let result = await search(title, year);
    if (result?.poster_path) return result;

    const withoutParens = title.replace(/\s*\([^)]*\)\s*$/, '').trim();
    if (withoutParens && withoutParens !== title) {
      result = await search(withoutParens, year);
      if (result?.poster_path) return result;
    }

    if (year) {
      result = await search(withoutParens || title);
      if (result?.poster_path) return result;
    }

    const multi = await searchMulti(withoutParens || title);
    const match = multi.find(r => r.type === type && r.poster_path);
    if (match) return match;

    return result ?? multi.find(r => r.type === type) ?? null;
  } catch {
    return null;
  }
}

export function tmdbMetadataFields(tmdb: TmdbSearchResult | null, genres?: string | null) {
  if (!tmdb) return {};
  return {
    tmdb_id: tmdb.id,
    title: tmdb.title,
    original_title: tmdb.original_title ?? null,
    overview: tmdb.overview || null,
    poster_path: tmdb.poster_path,
    backdrop_path: tmdb.backdrop_path,
    release_date: tmdb.release_date,
    vote_average: tmdb.vote_average,
    genres: genres ?? null,
  };
}

export async function tmdbMetadataWithGenres(tmdb: TmdbSearchResult | null, type: MediaType) {
  if (!tmdb) return {};
  const genres = await resolveGenres(type, tmdb);
  return tmdbMetadataFields(tmdb, genres);
}
