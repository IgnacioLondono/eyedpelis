import fs from 'fs';
import { getSetting, setSetting } from '../db/database.js';

const PROWLARR_CONFIG = '/integration/prowlarr/config.xml';
const JACKETT_CONFIG = '/integration/jackett/Jackett/ServerConfig.json';

/** Lee API keys generadas por Prowlarr/Jackett en sus volúmenes compartidos. */
export function syncIntegrationApiKeys() {
  try {
    if (!getSetting('prowlarr_api_key') && fs.existsSync(PROWLARR_CONFIG)) {
      const xml = fs.readFileSync(PROWLARR_CONFIG, 'utf-8');
      const match = xml.match(/<ApiKey>([^<]+)<\/ApiKey>/);
      const key = match?.[1]?.trim();
      if (key) {
        setSetting('prowlarr_api_key', key);
        console.log('[integrations] API key de Prowlarr sincronizada desde config.xml');
      }
    }

    if (!getSetting('jackett_api_key') && fs.existsSync(JACKETT_CONFIG)) {
      const json = JSON.parse(fs.readFileSync(JACKETT_CONFIG, 'utf-8')) as { APIKey?: string; ApiKey?: string };
      const key = (json.APIKey || json.ApiKey || '').trim();
      if (key) {
        setSetting('jackett_api_key', key);
        console.log('[integrations] API key de Jackett sincronizada desde ServerConfig.json');
      }
    }
  } catch (err) {
    console.warn('[integrations] No se pudieron sincronizar API keys:', err);
  }
}
