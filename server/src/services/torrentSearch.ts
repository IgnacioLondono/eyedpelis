import { getSettings } from '../config.js';
import { getExternalIds, getMovieDetails, getSeriesDetails } from './tmdb.js';
import type { MediaType } from '../types.js';

export interface TorrentResult {
  title: string;
  magnet_url: string | null;
  torrent_url: string | null;
  size_bytes: number;
  seeders: number;
  leechers: number;
  source: string;
  score: number;
}

export interface SourceStatus {
  ok: boolean;
  count: number;
  error?: string;
}

export interface SearchSourceReport {
  prowlarr: SourceStatus;
  jackett: SourceStatus;
  yts: SourceStatus;
  eztv: SourceStatus;
}

interface SearchParams {
  title: string;
  type: MediaType;
  year?: number;
  tmdb_id?: number;
  original_title?: string;
}

const BAD_QUALITY = /\b(cam|hdcam|ts|telesync|workprint|scr|screener)\b/i;
const RES_1080 = /\b1080p\b/i;
const RES_720 = /\b720p\b/i;
const RES_4K = /\b(2160p|4k)\b/i;
const GOOD_SOURCE = /\b(web-?dl|bluray|bdrip|remux|webrip)\b/i;

const YTS_MIRRORS = [
  'https://yts.mx/api/v2/list_movies.json',
  'https://yts.lt/api/v2/list_movies.json',
  'https://yts.rs/api/v2/list_movies.json',
];

const EZTV_MIRRORS = [
  'https://eztv.re/api/get-torrents',
  'https://eztvx.to/api/get-torrents',
];

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'los', 'las', 'del', 'una', 'uno', 'por', 'con', 'que',
]);

function emptyReport(): SearchSourceReport {
  return {
    prowlarr: { ok: false, count: 0 },
    jackett: { ok: false, count: 0 },
    yts: { ok: false, count: 0 },
    eztv: { ok: false, count: 0 },
  };
}

function buildMagnet(infoHash: string, title: string): string {
  const hash = infoHash.toLowerCase().replace(/^urn:btih:/i, '');
  if (!/^[a-f0-9]{40}$/i.test(hash)) return '';
  return `magnet:?xt=urn:btih:${hash}&dn=${encodeURIComponent(title)}`;
}

function extractMagnet(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('magnet:')) return url;
  const match = url.match(/magnet:\?[^"'\\s]+/i);
  return match ? match[0] : null;
}

/** Reescribe localhost en URLs de Prowlarr/Jackett para que qBittorrent pueda descargarlas. */
function rewriteIndexerUrl(url: string | null | undefined, configuredBase: string): string | null {
  if (!url) return null;
  try {
    const base = new URL(configuredBase.replace(/\/+$/, '') + '/');
    const parsed = new URL(url);
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.hostname === 'host.docker.internal') {
      parsed.protocol = base.protocol;
      parsed.hostname = base.hostname;
      parsed.port = base.port;
      return parsed.toString();
    }
    return url;
  } catch {
    return url;
  }
}

function normalizeImdbForEztv(imdbId: string): string {
  return imdbId.replace(/t/gi, '');
}

function titleKeywords(title: string): string[] {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s*\(\d{4}\)\s*$/, '')
    .replace(/[^\w\sáéíóúñ]/gi, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 2 && !STOP_WORDS.has(w));
}

function isRelevantTorrent(torrentTitle: string, searchTitle: string): boolean {
  const keywords = titleKeywords(searchTitle);
  if (!keywords.length) return true;

  const hay = torrentTitle
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');

  const hits = keywords.filter(k => hay.includes(k));
  if (keywords.length === 1) return hits.length >= 1;
  if (keywords.length === 2) return hits.length >= 1;
  return hits.length >= 2 || hits.length / keywords.length >= 0.45;
}

function isIndexerSource(source: string): boolean {
  return source.startsWith('Prowlarr') || source.startsWith('Jackett');
}

function filterRelevant(results: TorrentResult[], searchTitle: string): TorrentResult[] {
  const strict = results.filter(r => isRelevantTorrent(r.title, searchTitle));
  if (strict.length >= 3) return strict;

  const indexerHits = results.filter(r => isIndexerSource(r.source) && isRelevantTorrent(r.title, searchTitle));
  if (indexerHits.length > 0) return indexerHits;

  if (strict.length > 0) return strict;

  // Último recurso: indexadores con score alto aunque el título difiera (anime, nombres alternativos)
  const indexerScored = results
    .filter(r => isIndexerSource(r.source) && r.score > 20)
    .sort((a, b) => b.score - a.score);
  if (indexerScored.length > 0) return indexerScored.slice(0, 25);

  return results.slice(0, 15);
}

function normalizeResult(raw: {
  title: string;
  magnet_url?: string | null;
  magnetUrl?: string | null;
  infoHash?: string | null;
  torrent_url?: string | null;
  downloadUrl?: string | null;
  guid?: string | null;
  size_bytes?: number;
  size?: number;
  seeders?: number;
  leechers?: number;
  source: string;
}, year?: number, searchTitle?: string, indexerBase?: string): TorrentResult | null {
  const downloadUrl = rewriteIndexerUrl(raw.downloadUrl, indexerBase || '') || raw.downloadUrl;
  const infoMagnet = raw.infoHash ? buildMagnet(String(raw.infoHash), raw.title) : null;

  const magnet =
    extractMagnet(raw.magnet_url) ||
    extractMagnet(raw.magnetUrl) ||
    (infoMagnet || null) ||
    extractMagnet(raw.guid) ||
    extractMagnet(downloadUrl) ||
    null;

  const torrentUrl =
    raw.torrent_url ||
    (downloadUrl && !downloadUrl.startsWith('magnet:') ? downloadUrl : null) ||
    null;

  if (!magnet && !torrentUrl) return null;

  const seeders = raw.seeders ?? 0;
  const result: TorrentResult = {
    title: raw.title,
    magnet_url: magnet || null,
    torrent_url: torrentUrl,
    size_bytes: raw.size_bytes ?? raw.size ?? 0,
    seeders,
    leechers: raw.leechers ?? 0,
    source: raw.source,
    score: 0,
  };
  result.score = scoreTorrent(result, year, searchTitle);
  return result;
}

function scoreTorrent(t: TorrentResult, year?: number, searchTitle?: string): number {
  let score = Math.min(t.seeders, 500) * 3;
  const title = t.title.toLowerCase();

  if (RES_1080.test(title)) score += 50;
  else if (RES_720.test(title)) score += 25;
  else if (RES_4K.test(title)) score += 35;

  if (GOOD_SOURCE.test(title)) score += 30;
  if (BAD_QUALITY.test(title)) score -= 300;
  if (year && title.includes(String(year))) score += 40;
  if (t.seeders < 1) score -= 100;

  if (searchTitle) {
    for (const word of titleKeywords(searchTitle)) {
      if (title.includes(word)) score += 45;
    }
  }

  return score;
}

function dedupeResults(results: TorrentResult[]): TorrentResult[] {
  const seen = new Set<string>();
  const out: TorrentResult[] = [];

  for (const r of results.sort((a, b) => b.score - a.score)) {
    const hashMatch = r.magnet_url?.match(/btih:([a-f0-9]{40})/i)?.[1]?.toLowerCase();
    const key = hashMatch || r.title.toLowerCase().slice(0, 60);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

function buildQuery(title: string, year?: number): string {
  const clean = title.replace(/\s*\(\d{4}\)\s*$/, '').trim();
  return year ? `${clean} ${year}` : clean;
}

async function searchProwlarr(
  query: string,
  type: MediaType,
  year?: number,
  searchTitle?: string,
): Promise<{ results: TorrentResult[]; status: SourceStatus }> {
  const { prowlarr_url, prowlarr_api_key } = getSettings();
  if (!prowlarr_url || !prowlarr_api_key) {
    return { results: [], status: { ok: false, count: 0, error: 'No configurado' } };
  }

  const base = prowlarr_url.replace(/\/+$/, '');
  const url = new URL(`${base}/api/v1/search`);
  url.searchParams.set('query', query);
  url.searchParams.set('type', type === 'movie' ? 'movie' : 'tvsearch');
  url.searchParams.set('limit', '100');
  url.searchParams.set('offset', '0');
  if (type === 'movie') {
    url.searchParams.append('categories', '2000');
  } else {
    url.searchParams.append('categories', '5000');
    url.searchParams.append('categories', '5070');
  }

  try {
    const res = await fetch(url.toString(), {
      headers: { 'X-Api-Key': prowlarr_api_key },
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error('[prowlarr]', res.status, errText.slice(0, 200));
      return { results: [], status: { ok: false, count: 0, error: `HTTP ${res.status}` } };
    }

    const data = (await res.json()) as Array<Record<string, unknown>>;
    const results = data
      .map(item => normalizeResult({
        title: String(item.title || ''),
        downloadUrl: item.downloadUrl as string | undefined,
        magnetUrl: item.magnetUrl as string | undefined,
        infoHash: item.infoHash as string | undefined,
        guid: item.guid as string | undefined,
        size: item.size as number | undefined,
        seeders: item.seeders as number | undefined,
        leechers: item.leechers as number | undefined,
        source: `Prowlarr · ${item.indexer || 'indexer'}`,
      }, year, searchTitle, base))
      .filter((r): r is TorrentResult => r !== null);

    return { results, status: { ok: true, count: results.length } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error de red';
    console.error('[prowlarr]', msg);
    return { results: [], status: { ok: false, count: 0, error: msg } };
  }
}

async function searchJackett(
  query: string,
  type: MediaType,
  year?: number,
  searchTitle?: string,
): Promise<{ results: TorrentResult[]; status: SourceStatus }> {
  const { jackett_url, jackett_api_key } = getSettings();
  if (!jackett_url || !jackett_api_key) {
    return { results: [], status: { ok: false, count: 0, error: 'No configurado' } };
  }

  const base = jackett_url.replace(/\/+$/, '');
  const url = new URL(`${base}/api/v2.0/indexers/all/results`);
  url.searchParams.set('apikey', jackett_api_key);
  url.searchParams.set('Query', query);
  if (type === 'movie') {
    url.searchParams.append('Category[]', '2000');
  } else {
    url.searchParams.append('Category[]', '5000');
    url.searchParams.append('Category[]', '5070');
  }

  try {
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(30000) });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error('[jackett]', res.status, errText.slice(0, 200));
      return { results: [], status: { ok: false, count: 0, error: `HTTP ${res.status}` } };
    }

    const data = (await res.json()) as { Results?: Array<Record<string, unknown>> };
    const results = (data.Results || [])
      .map(item => {
        const link = (item.MagnetUri || item.Link) as string | undefined;
        return normalizeResult({
          title: String(item.Title || ''),
          magnetUrl: item.MagnetUri as string | undefined,
          infoHash: item.InfoHash as string | undefined,
          downloadUrl: link,
          guid: item.Guid as string | undefined,
          size: item.Size as number | undefined,
          seeders: item.Seeders as number | undefined,
          leechers: item.Peers as number | undefined,
          source: `Jackett · ${item.Tracker || 'tracker'}`,
        }, year, searchTitle, base);
      })
      .filter((r): r is TorrentResult => r !== null);

    return { results, status: { ok: true, count: results.length } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error de red';
    console.error('[jackett]', msg);
    return { results: [], status: { ok: false, count: 0, error: msg } };
  }
}

async function searchYts(title: string, year?: number, searchTitle?: string): Promise<{ results: TorrentResult[]; status: SourceStatus }> {
  let lastError = 'Sin respuesta';

  for (const mirror of YTS_MIRRORS) {
    try {
      const url = new URL(mirror);
      url.searchParams.set('query_term', title);
      url.searchParams.set('limit', '10');

      const res = await fetch(url.toString(), { signal: AbortSignal.timeout(12000) });
      if (!res.ok) {
        lastError = `HTTP ${res.status}`;
        continue;
      }

      const data = (await res.json()) as {
        status?: string;
        data?: { movies?: Array<{
          title: string;
          year?: number;
          torrents?: Array<{ hash: string; quality: string; size: string; seeds: number; peers: number }>;
        }> };
      };

      if (data.status === 'error') {
        lastError = 'YTS sin resultados';
        continue;
      }

      const movies = data.data?.movies || [];
      let best = movies.find(m => isRelevantTorrent(m.title, title)) ?? movies[0];
      if (year) {
        const match = movies.find(m => m.year === year && isRelevantTorrent(m.title, title));
        if (match) best = match;
      }
      if (!best?.torrents?.length || !isRelevantTorrent(best.title, title)) {
        lastError = 'Sin coincidencias';
        continue;
      }

      const results = best.torrents
        .map(t => {
          const sizeMatch = t.size.match(/([\d.]+)\s*(GB|MB)/i);
          let sizeBytes = 0;
          if (sizeMatch) {
            const n = parseFloat(sizeMatch[1]);
            sizeBytes = sizeMatch[2].toUpperCase() === 'GB' ? n * 1024 ** 3 : n * 1024 ** 2;
          }
          const fullTitle = `${best!.title} ${t.quality} YTS`;
          return normalizeResult({
            title: fullTitle,
            magnet_url: buildMagnet(t.hash, fullTitle),
            size_bytes: sizeBytes,
            seeders: t.seeds,
            leechers: t.peers,
            source: 'YTS',
          }, year, searchTitle);
        })
        .filter((r): r is TorrentResult => r !== null);

      if (results.length > 0) {
        return { results, status: { ok: true, count: results.length } };
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : 'Error de red';
    }
  }

  return { results: [], status: { ok: false, count: 0, error: lastError } };
}

async function searchEztv(imdbId: string, searchTitle: string, year?: number): Promise<{ results: TorrentResult[]; status: SourceStatus }> {
  const numericId = normalizeImdbForEztv(imdbId);
  if (!numericId) {
    return { results: [], status: { ok: false, count: 0, error: 'Sin IMDB ID' } };
  }

  let lastError = 'Sin respuesta';

  for (const mirror of EZTV_MIRRORS) {
    try {
      const url = `${mirror}?imdb_id=${encodeURIComponent(numericId)}&limit=100`;
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) {
        lastError = `HTTP ${res.status}`;
        continue;
      }

      const data = (await res.json()) as {
        imdb_id?: string;
        torrents?: Array<{
          title: string;
          magnet_url: string;
          torrent_url?: string;
          seeds: number;
          peers: number;
          size_bytes: number;
        }>;
      };

      if (!data.torrents?.length) {
        lastError = 'Sin torrents';
        continue;
      }

      const responseId = String(data.imdb_id || '').replace(/t/gi, '');
      if (responseId && responseId !== numericId && !responseId.endsWith(numericId) && !numericId.endsWith(responseId)) {
        lastError = 'IMDB no coincide';
        continue;
      }

      const results = data.torrents
        .map(t => normalizeResult({
          title: t.title,
          magnet_url: t.magnet_url,
          torrent_url: t.torrent_url,
          size_bytes: t.size_bytes,
          seeders: t.seeds,
          leechers: t.peers,
          source: 'EZTV',
        }, year, searchTitle))
        .filter((r): r is TorrentResult => r !== null);

      if (results.length > 0) {
        return { results, status: { ok: true, count: results.length } };
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : 'Error de red';
    }
  }

  return { results: [], status: { ok: false, count: 0, error: lastError } };
}

async function resolveSearchTitles(params: SearchParams): Promise<string[]> {
  const titles = new Set<string>();
  titles.add(params.title);
  if (params.original_title) titles.add(params.original_title);

  if (params.tmdb_id) {
    try {
      if (params.type === 'movie') {
        const d = await getMovieDetails(params.tmdb_id) as { original_title?: string; title?: string };
        if (d.original_title) titles.add(d.original_title);
        if (d.title) titles.add(d.title);
      } else {
        const d = await getSeriesDetails(params.tmdb_id) as { original_name?: string; name?: string };
        if (d.original_name) titles.add(d.original_name);
        if (d.name) titles.add(d.name);
      }
    } catch { /* opcional */ }
  }

  return [...titles].filter(Boolean);
}

export async function searchTorrents(params: SearchParams): Promise<{ results: TorrentResult[]; sources: SearchSourceReport }> {
  const report = emptyReport();
  const sources: TorrentResult[] = [];
  const searchTitles = await resolveSearchTitles(params);
  const primaryTitle = params.title;

  for (const title of searchTitles) {
    const query = buildQuery(title, params.year);

    const [prowlarr, jackett] = await Promise.all([
      searchProwlarr(query, params.type, params.year, primaryTitle),
      searchJackett(query, params.type, params.year, primaryTitle),
    ]);

    if (prowlarr.results.length > 0 || prowlarr.status.ok) report.prowlarr = prowlarr.status;
    else if (!report.prowlarr.ok) report.prowlarr = prowlarr.status;

    if (jackett.results.length > 0 || jackett.status.ok) report.jackett = jackett.status;
    else if (!report.jackett.ok) report.jackett = jackett.status;

    sources.push(...prowlarr.results, ...jackett.results);

    if (prowlarr.results.length > 0 || jackett.results.length > 0) break;
  }

  if (params.type === 'movie' && report.yts.count === 0) {
    const yts = await searchYts(primaryTitle, params.year, primaryTitle);
    report.yts = yts.status;
    sources.push(...yts.results);
  }

  if (params.tmdb_id) {
    try {
      const ids = await getExternalIds(params.type, params.tmdb_id);
      if (ids.imdb_id && params.type === 'series' && report.eztv.count === 0) {
        const eztv = await searchEztv(ids.imdb_id, primaryTitle, params.year);
        report.eztv = eztv.status;
        sources.push(...eztv.results);
      }
      if (ids.imdb_id && params.type === 'movie' && sources.length < 5) {
        const jackettImdb = await searchJackett(ids.imdb_id, params.type, params.year, primaryTitle);
        if (jackettImdb.results.length > 0) {
          report.jackett = { ok: true, count: report.jackett.count + jackettImdb.results.length };
          sources.push(...jackettImdb.results);
        }
      }
    } catch { /* TMDB opcional */ }
  }

  const relevant = filterRelevant(sources, primaryTitle);
  return { results: dedupeResults(relevant).slice(0, 40), sources: report };
}

export function pickBestTorrent(results: TorrentResult[]): TorrentResult | null {
  if (!results.length) return null;
  return [...results].sort((a, b) => b.score - a.score)[0];
}

export function getSearchCapabilities() {
  const s = getSettings();
  return {
    prowlarr: !!(s.prowlarr_url && s.prowlarr_api_key),
    jackett: !!(s.jackett_url && s.jackett_api_key),
    publicIndexers: true,
    qbittorrent: !!s.qbittorrent_url,
  };
}

export async function testProwlarrConnection(): Promise<{ ok: boolean; message: string }> {
  const { prowlarr_url, prowlarr_api_key } = getSettings();
  if (!prowlarr_url || !prowlarr_api_key) {
    return { ok: false, message: 'URL o API key de Prowlarr no configurados' };
  }
  try {
    const base = prowlarr_url.replace(/\/+$/, '');
    const res = await fetch(`${base}/api/v1/indexer`, {
      headers: { 'X-Api-Key': prowlarr_api_key },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { ok: false, message: `Prowlarr HTTP ${res.status}` };
    const indexers = (await res.json()) as Array<{ name?: string; enable?: boolean }>;
    const active = indexers.filter(i => i.enable !== false).length;
    return { ok: true, message: `Conectado · ${active} indexadores activos` };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'No se pudo conectar' };
  }
}

export async function testJackettConnection(): Promise<{ ok: boolean; message: string }> {
  const { jackett_url, jackett_api_key } = getSettings();
  if (!jackett_url || !jackett_api_key) {
    return { ok: false, message: 'URL o API key de Jackett no configurados' };
  }
  try {
    const base = jackett_url.replace(/\/+$/, '');
    const res = await fetch(`${base}/api/v2.0/indexers/all/results/torznab/api?apikey=${jackett_api_key}&t=indexers`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { ok: false, message: `Jackett HTTP ${res.status}` };
    return { ok: true, message: 'Conectado correctamente' };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'No se pudo conectar' };
  }
}
