export interface TmdbDetails {
  id: number;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  tagline?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  vote_count?: number;
  runtime?: number;
  episode_run_time?: number[];
  number_of_seasons?: number;
  number_of_episodes?: number;
  status?: string;
  original_language?: string;
  spoken_languages?: Array<{ iso_639_1: string; name: string; english_name: string }>;
  genres?: Array<{ id: number; name: string }>;
  production_countries?: Array<{ iso_3166_1: string; name: string }>;
  seasons?: Array<{
    season_number: number;
    name?: string;
    poster_path?: string | null;
    episode_count?: number;
    air_date?: string;
    overview?: string;
  }>;
}

export interface TmdbEpisodeInfo {
  episode_number: number;
  name: string;
  overview?: string;
  still_path?: string | null;
  air_date?: string | null;
  runtime?: number | null;
  vote_average?: number;
}

export interface TmdbSeasonDetails {
  season_number: number;
  name: string;
  overview?: string;
  poster_path?: string | null;
  episodes: TmdbEpisodeInfo[];
}

export const LANGUAGE_NAMES: Record<string, string> = {
  es: 'Español', en: 'Inglés', fr: 'Francés', de: 'Alemán', it: 'Italiano',
  pt: 'Portugués', ja: 'Japonés', ko: 'Coreano', zh: 'Chino', ru: 'Ruso',
  ar: 'Árabe', hi: 'Hindi', sv: 'Sueco', nl: 'Neerlandés', pl: 'Polaco',
};

export function languageLabel(code: string | undefined): string {
  if (!code) return '';
  return LANGUAGE_NAMES[code] || code.toUpperCase();
}

export function formatRuntime(minutes: number | undefined): string {
  if (!minutes) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m > 0 ? `${h} h ${m} min` : `${h} h`;
}
