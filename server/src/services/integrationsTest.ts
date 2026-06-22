import { getSettings } from '../config.js';
import { testJackettConnection, testProwlarrConnection } from './torrentSearch.js';
import { testQbittorrentConnection } from './qbittorrent.js';
import type { IndexersVerifyReport } from './indexerVerify.js';
import { verifyAllIndexers } from './indexerVerify.js';

export interface IntegrationTestResult {
  ok: boolean;
  message: string;
}

export interface AllIntegrationsReport {
  qbittorrent: IntegrationTestResult;
  prowlarr: IntegrationTestResult;
  jackett: IntegrationTestResult;
  flaresolverr: IntegrationTestResult;
  indexers: IndexersVerifyReport;
  webUrls: {
    qbittorrent: string;
    prowlarr: string;
    jackett: string;
    flaresolverr: string;
  };
}

const FLARESOLVERR_URL = process.env.FLARESOLVERR_URL || 'http://flaresolverr:8191';

async function testServiceReachable(name: string, baseUrl: string): Promise<IntegrationTestResult> {
  try {
    const res = await fetch(baseUrl.replace(/\/+$/, '') + '/', {
      signal: AbortSignal.timeout(8000),
      headers: { Accept: 'text/html,application/json' },
    });
    const text = (await res.text()).slice(0, 500);
    const plainUnauthorized = text.trim() === 'Unauthorized' || text.trim() === '{"error":"Unauthorized"}';
    if (plainUnauthorized) {
      return {
        ok: false,
        message: `${name}: pantalla "Unauthorized" — haz Pull and redeploy del stack o revisa docker/*-init.sh`,
      };
    }
    if (!res.ok) {
      return { ok: false, message: `${name}: HTTP ${res.status}` };
    }
    return { ok: true, message: `${name}: Web UI accesible` };
  } catch (err) {
    return {
      ok: false,
      message: `${name}: ${err instanceof Error ? err.message : 'sin conexión'}`,
    };
  }
}

export async function testFlareSolverrConnection(): Promise<IntegrationTestResult> {
  try {
    const res = await fetch(`${FLARESOLVERR_URL.replace(/\/+$/, '')}/v1`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cmd: 'sessions.list' }),
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) {
      return { ok: false, message: `FlareSolverr HTTP ${res.status}` };
    }
    const data = await res.json() as { status?: string };
    if (data.status === 'ok') {
      return { ok: true, message: 'FlareSolverr listo (para indexadores con Cloudflare)' };
    }
    return { ok: false, message: 'FlareSolverr respondió pero status no es ok' };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'FlareSolverr no responde',
    };
  }
}

export async function testAllIntegrations(): Promise<AllIntegrationsReport> {
  const s = getSettings();
  const host = process.env.PUBLIC_HOST || '192.168.50.197';
  const webUrls = {
    qbittorrent: `http://${host}:${process.env.QBIT_HOST_PORT || '18787'}`,
    prowlarr: `http://${host}:${process.env.PROWLARR_HOST_PORT || '19696'}`,
    jackett: `http://${host}:${process.env.JACKETT_HOST_PORT || '19117'}`,
    flaresolverr: `http://${host}:${process.env.FLARESOLVERR_HOST_PORT || '18191'}`,
  };

  const [qbittorrent, prowlarrApi, jackettApi, flaresolverr, indexers] = await Promise.all([
    testQbittorrentConnection(),
    testProwlarrConnection(),
    testJackettConnection(),
    testFlareSolverrConnection(),
    verifyAllIndexers(),
  ]);

  let prowlarr = prowlarrApi;
  if (!prowlarrApi.ok && s.prowlarr_url) {
    const reach = await testServiceReachable('Prowlarr', s.prowlarr_url);
    if (reach.ok && !s.prowlarr_api_key) {
      prowlarr = {
        ok: false,
        message: 'Prowlarr accesible pero falta API key — abre :19696 → Settings → General → copia API Key',
      };
    } else if (!prowlarrApi.ok && reach.ok) {
      prowlarr = prowlarrApi;
    } else if (!reach.ok) {
      prowlarr = reach;
    }
  }

  let jackett = jackettApi;
  if (!jackettApi.ok && s.jackett_url) {
    const reach = await testServiceReachable('Jackett', s.jackett_url);
    if (reach.ok && !s.jackett_api_key) {
      jackett = {
        ok: false,
        message: 'Jackett accesible pero falta API key — cópiala de la portada de :19117',
      };
    } else if (!reach.ok && !jackettApi.ok) {
      jackett = reach;
    }
  }

  let qb = qbittorrent;
  if (!qbittorrent.ok) {
    const reach = await testServiceReachable('qBittorrent', s.qbittorrent_url || 'http://qbittorrent:8080');
    if (!reach.ok && qbittorrent.message.includes('401')) {
      qb = {
        ok: false,
        message: 'qBittorrent: login fallido — revisa QBITTORRENT_USER y QBITTORRENT_PASS en Portainer',
      };
    }
  }

  return { qbittorrent: qb, prowlarr, jackett, flaresolverr, indexers, webUrls };
}
