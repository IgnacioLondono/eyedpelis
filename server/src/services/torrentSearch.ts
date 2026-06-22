import { getSettings } from '../config.js';
import { getExternalIds } from './tmdb.js';
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

interface SearchParams {
  title: string;
  type: MediaType;
  year?: number;
  tmdb_id?: number;
}

const BAD_QUALITY = /\b(cam|hdcam|ts|telesync|workprint|scr|screener)\b/i;
const RES_1080 = /\b1080p\b/i;
const RES_720 = /\b720p\b/i;
const RES_4K = /\b(2160p|4k)\b/i;
const GOOD_SOURCE = /\b(web-?dl|bluray|bdrip|remux|webrip)\b/i;

function buildMagnet(infoHash: string, title: string): string {
  const hash = infoHash.toLowerCase().replace(/^urn:btih:/i, '');
  return `magnet:?xt=urn:btih:${hash}&dn=${encodeURIComponent(title)}`;
}

function extractMagnet(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('magnet:')) return url;
  const match = url.match(/magnet:\?[^"'\\s]+/i);
  return match ? match[0] : null;
}

function normalizeResult(raw: {
  title: string;
  magnet_url?: string | null;
  torrent_url?: string | null;
  downloadUrl?: string | null;
  guid?: string | null;
  size_bytes?: number;
  size?: number;
  seeders?: number;
  leechers?: number;
  source: string;
}, year?: number): TorrentResult | null {
  const magnet =
    extractMagnet(raw.magnet_url) ||
    extractMagnet(raw.downloadUrl) ||
    extractMagnet(raw.guid) ||
    null;

  const torrentUrl =
    raw.torrent_url ||
    (raw.downloadUrl && !raw.downloadUrl.startsWith('magnet:') ? raw.downloadUrl : null) ||
    null;

  if (!magnet && !torrentUrl) return null;

  const seeders = raw.seeders ?? 0;
  const result: TorrentResult = {
    title: raw.title,
    magnet_url: magnet,
    torrent_url: torrentUrl,
    size_bytes: raw.size_bytes ?? raw.size ?? 0,
    seeders,
    leechers: raw.leechers ?? 0,
    source: raw.source,
    score: 0,
  };
  result.score = scoreTorrent(result, year);
  return result;
}

function scoreTorrent(t: TorrentResult, year?: number): number {
  let score = Math.min(t.seeders, 500) * 3;
  const title = t.title.toLowerCase();

  if (RES_1080.test(title)) score += 50;
  else if (RES_720.test(title)) score += 25;
  else if (RES_4K.test(title)) score += 35;

  if (GOOD_SOURCE.test(title)) score += 30;
  if (BAD_QUALITY.test(title)) score -= 300;
  if (year && title.includes(String(year))) score += 40;
  if (t.seeders < 1) score -= 100;

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

async function searchProwlarr(query: string, type: MediaType, year?: number): Promise<TorrentResult[]> {
  const { prowlarr_url, prowlarr_api_key } = getSettings();
  if (!prowlarr_url || !prowlarr_api_key) return [];

  const base = prowlarr_url.replace(/\/+$/, '');
  const url = new URL(`${base}/api/v1/search`);
  url.searchParams.set('query', query);
  url.searchParams.set('type', 'search');
  url.searchParams.set('limit', '50');
  url.searchParams.set('offset', '0');
  if (type === 'movie') url.searchParams.set('categories', '2000');
  else url.searchParams.set('categories', '5000');

  try {
    const res = await fetch(url.toString(), {
      headers: { 'X-Api-Key': prowlarr_api_key },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return [];

    const data = (await res.json()) as Array<Record<string, unknown>>;
    return data
      .map(item => normalizeResult({
        title: String(item.title || ''),
        downloadUrl: item.downloadUrl as string | undefined,
        guid: item.guid as string | undefined,
        size: item.size as number | undefined,
        seeders: item.seeders as number | undefined,
        leechers: item.leechers as number | undefined,
        source: `Prowlarr · ${item.indexer || 'indexer'}`,
      }, year))
      .filter((r): r is TorrentResult => r !== null);
  } catch {
    return [];
  }
}

async function searchJackett(query: string, type: MediaType, year?: number): Promise<TorrentResult[]> {
  const { jackett_url, jackett_api_key } = getSettings();
  if (!jackett_url || !jackett_api_key) return [];

  const base = jackett_url.replace(/\/+$/, '');
  const url = new URL(`${base}/api/v2.0/indexers/all/results`);
  url.searchParams.set('apikey', jackett_api_key);
  url.searchParams.set('Query', query);
  if (type === 'movie') url.searchParams.append('Category[]', '2000');
  else url.searchParams.append('Category[]', '5000');

  try {
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(20000) });
    if (!res.ok) return [];

    const data = (await res.json()) as { Results?: Array<Record<string, unknown>> };
    return (data.Results || [])
      .map(item => normalizeResult({
        title: String(item.Title || ''),
        downloadUrl: (item.MagnetUri || item.Link) as string | undefined,
        guid: item.Guid as string | undefined,
        size: item.Size as number | undefined,
        seeders: item.Seeders as number | undefined,
        leechers: item.Peers as number | undefined,
        source: `Jackett · ${item.Tracker || 'tracker'}`,
      }, year))
      .filter((r): r is TorrentResult => r !== null);
  } catch {
    return [];
  }
}

async function searchYts(title: string, year?: number): Promise<TorrentResult[]> {
  try {
    const url = new URL('https://yts.mx/api/v2/list_movies.json');
    url.searchParams.set('query_term', title);
    url.searchParams.set('limit', '10');

    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return [];

    const data = (await res.json()) as {
      data?: { movies?: Array<{
        title: string;
        year?: number;
        torrents?: Array<{ hash: string; quality: string; size: string; seeds: number; peers: number }>;
      }> };
    };

    const movies = data.data?.movies || [];
    let best = movies[0];
    if (year) {
      const match = movies.find(m => m.year === year);
      if (match) best = match;
    }
    if (!best?.torrents?.length) return [];

    return best.torrents
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
        }, year);
      })
      .filter((r): r is TorrentResult => r !== null);
  } catch {
    return [];
  }
}

async function searchEztv(imdbId: string, year?: number): Promise<TorrentResult[]> {
  try {
    const url = `https://eztv.re/api/get-torrents?imdb_id=${imdbId}&limit=100`;
    const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (!res.ok) return [];

    const data = (await res.json()) as {
      torrents?: Array<{
        title: string;
        magnet_url: string;
        torrent_url?: string;
        seeds: number;
        peers: number;
        size_bytes: number;
      }>;
    };

    return (data.torrents || [])
      .map(t => normalizeResult({
        title: t.title,
        magnet_url: t.magnet_url,
        torrent_url: t.torrent_url,
        size_bytes: t.size_bytes,
        seeders: t.seeds,
        leechers: t.peers,
        source: 'EZTV',
      }, year))
      .filter((r): r is TorrentResult => r !== null);
  } catch {
    return [];
  }
}

function buildQuery(title: string, year?: number): string {
  const clean = title.replace(/\s*\(\d{4}\)\s*$/, '').trim();
  return year ? `${clean} ${year}` : clean;
}

export async function searchTorrents(params: SearchParams): Promise<TorrentResult[]> {
  const query = buildQuery(params.title, params.year);
  const sources: TorrentResult[] = [];

  const [prowlarr, jackett] = await Promise.all([
    searchProwlarr(query, params.type, params.year),
    searchJackett(query, params.type, params.year),
  ]);
  sources.push(...prowlarr, ...jackett);

  if (params.type === 'movie') {
    const yts = await searchYts(params.title, params.year);
    sources.push(...yts);
  }

  if (params.tmdb_id) {
    try {
      const ids = await getExternalIds(params.type, params.tmdb_id);
      if (ids.imdb_id) {
        if (params.type === 'series') {
          const eztv = await searchEztv(ids.imdb_id, params.year);
          sources.push(...eztv);
        }
        if (params.type === 'movie' && sources.length < 3) {
          const jackettImdb = await searchJackett(`${ids.imdb_id}`, params.type, params.year);
          sources.push(...jackettImdb);
        }
      }
    } catch { /* TMDB opcional */ }
  }

  return dedupeResults(sources).slice(0, 30);
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
