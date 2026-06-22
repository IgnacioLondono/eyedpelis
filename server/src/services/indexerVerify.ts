import { getSettings } from '../config.js';

export interface IndexerCheck {
  name: string;
  ok: boolean;
  message: string;
  source: 'prowlarr' | 'jackett' | 'yts' | 'eztv';
}

export interface IndexersVerifyReport {
  checks: IndexerCheck[];
  summary: { total: number; ok: number; failed: number };
  prowlarr: { ok: boolean; message: string };
  jackett: { ok: boolean; message: string };
  public: { ok: boolean; message: string };
}

const YTS_PROBE = 'https://yts.mx/api/v2/list_movies.json?limit=1';
const EZTV_PROBE = 'https://eztv.re/api/get-torrents?limit=1';

async function verifyProwlarrIndexers(): Promise<{ checks: IndexerCheck[]; ok: boolean; message: string }> {
  const { prowlarr_url, prowlarr_api_key } = getSettings();
  if (!prowlarr_url || !prowlarr_api_key) {
    return { checks: [], ok: false, message: 'Prowlarr no configurado' };
  }

  const base = prowlarr_url.replace(/\/+$/, '');
  const headers = { 'X-Api-Key': prowlarr_api_key };

  try {
    const listRes = await fetch(`${base}/api/v1/indexer`, {
      headers,
      signal: AbortSignal.timeout(10000),
    });
    if (!listRes.ok) {
      return { checks: [], ok: false, message: `Prowlarr HTTP ${listRes.status}` };
    }

    const indexers = (await listRes.json()) as Array<{ id?: number; name?: string; enable?: boolean }>;
    const enabled = indexers.filter(i => i.enable !== false);
    const nameById = new Map(indexers.map(i => [i.id, i.name || `Indexer ${i.id}`]));

    if (!enabled.length) {
      return { checks: [], ok: false, message: 'Sin indexadores activos — añádelos en :19696' };
    }

    const testRes = await fetch(`${base}/api/v1/indexer/testall`, {
      method: 'POST',
      headers,
      signal: AbortSignal.timeout(120000),
    });
    if (!testRes.ok) {
      return { checks: [], ok: false, message: `testall HTTP ${testRes.status}` };
    }

    const results = (await testRes.json()) as Array<{
      id?: number;
      isValid?: boolean;
      validationFailures?: Array<{ errorMessage?: string }>;
    }>;

    const checks: IndexerCheck[] = results.map(r => {
      const name = nameById.get(r.id) || `ID ${r.id}`;
      const err = r.validationFailures?.map(f => f.errorMessage).filter(Boolean).join('; ');
      return {
        name,
        ok: r.isValid === true,
        message: r.isValid ? 'OK' : (err || 'Falló la prueba'),
        source: 'prowlarr' as const,
      };
    });

    const okCount = checks.filter(c => c.ok).length;
    return {
      checks,
      ok: okCount > 0,
      message: `${okCount}/${checks.length} indexadores OK`,
    };
  } catch (err) {
    return {
      checks: [],
      ok: false,
      message: err instanceof Error ? err.message : 'Error al probar Prowlarr',
    };
  }
}

async function testJackettIndexer(base: string, apiKey: string, id: string): Promise<{ ok: boolean; message: string }> {
  try {
    const url = `${base}/api/v2.0/indexers/${encodeURIComponent(id)}/test?apikey=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, { method: 'POST', signal: AbortSignal.timeout(25000) });
    if (!res.ok) return { ok: false, message: `HTTP ${res.status}` };
    const data = (await res.json()) as Array<{ result?: string; error?: string }> | { result?: string; error?: string };
    const items = Array.isArray(data) ? data : [data];
    const failed = items.find(i => i.result === 'error' || i.error);
    if (failed) return { ok: false, message: failed.error || 'Error en prueba' };
    return { ok: true, message: 'OK' };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Timeout' };
  }
}

async function verifyJackettIndexers(): Promise<{ checks: IndexerCheck[]; ok: boolean; message: string }> {
  const { jackett_url, jackett_api_key } = getSettings();
  if (!jackett_url || !jackett_api_key) {
    return { checks: [], ok: false, message: 'Jackett no configurado' };
  }

  const base = jackett_url.replace(/\/+$/, '');

  try {
    const listRes = await fetch(`${base}/api/v2.0/indexers?apikey=${encodeURIComponent(jackett_api_key)}`, {
      signal: AbortSignal.timeout(10000),
    });
    if (!listRes.ok) {
      return { checks: [], ok: false, message: `Jackett HTTP ${listRes.status}` };
    }

    const indexers = (await listRes.json()) as Array<{ id?: string; name?: string; configured?: boolean }>;
    const configured = indexers.filter(i => i.configured !== false && i.id);

    if (!configured.length) {
      return { checks: [], ok: false, message: 'Sin indexadores configurados — añádelos en :19117' };
    }

    const checks: IndexerCheck[] = [];
    const batchSize = 4;
    for (let i = 0; i < configured.length; i += batchSize) {
      const batch = configured.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(async idx => {
          const result = await testJackettIndexer(base, jackett_api_key, idx.id!);
          return {
            name: idx.name || idx.id!,
            ok: result.ok,
            message: result.message,
            source: 'jackett' as const,
          };
        }),
      );
      checks.push(...batchResults);
    }

    const okCount = checks.filter(c => c.ok).length;
    return {
      checks,
      ok: okCount > 0,
      message: `${okCount}/${checks.length} indexadores OK`,
    };
  } catch (err) {
    return {
      checks: [],
      ok: false,
      message: err instanceof Error ? err.message : 'Error al probar Jackett',
    };
  }
}

async function verifyPublicIndexers(): Promise<{ checks: IndexerCheck[]; ok: boolean; message: string }> {
  const checks: IndexerCheck[] = [];

  try {
    const ytsRes = await fetch(YTS_PROBE, { signal: AbortSignal.timeout(12000) });
    const ytsOk = ytsRes.ok;
    checks.push({
      name: 'YTS',
      ok: ytsOk,
      message: ytsOk ? 'Mirror yts.mx responde' : `HTTP ${ytsRes.status}`,
      source: 'yts',
    });
  } catch (err) {
    checks.push({
      name: 'YTS',
      ok: false,
      message: err instanceof Error ? err.message : 'Sin conexión',
      source: 'yts',
    });
  }

  try {
    const eztvRes = await fetch(EZTV_PROBE, { signal: AbortSignal.timeout(12000) });
    const eztvOk = eztvRes.ok;
    checks.push({
      name: 'EZTV',
      ok: eztvOk,
      message: eztvOk ? 'Mirror eztv.re responde' : `HTTP ${eztvRes.status}`,
      source: 'eztv',
    });
  } catch (err) {
    checks.push({
      name: 'EZTV',
      ok: false,
      message: err instanceof Error ? err.message : 'Sin conexión',
      source: 'eztv',
    });
  }

  const okCount = checks.filter(c => c.ok).length;
  return {
    checks,
    ok: okCount > 0,
    message: `${okCount}/${checks.length} fuentes públicas OK`,
  };
}

export async function verifyAllIndexers(): Promise<IndexersVerifyReport> {
  const [prowlarr, jackett, publicSrc] = await Promise.all([
    verifyProwlarrIndexers(),
    verifyJackettIndexers(),
    verifyPublicIndexers(),
  ]);

  const checks = [...prowlarr.checks, ...jackett.checks, ...publicSrc.checks];
  const ok = checks.filter(c => c.ok).length;

  return {
    checks,
    summary: { total: checks.length, ok, failed: checks.length - ok },
    prowlarr: { ok: prowlarr.ok, message: prowlarr.message },
    jackett: { ok: jackett.ok, message: jackett.message },
    public: { ok: publicSrc.ok, message: publicSrc.message },
  };
}
