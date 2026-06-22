import { useEffect, useState } from 'react';
import { Save, RefreshCw, FolderOpen, Key, Server, Shield, Link2, Lock, CheckCircle, XCircle, Info } from 'lucide-react';
import { api } from '../api';
import { errorMessage, useNotice } from '../context/NoticeContext';
import ScanProgressModal, { useScanProgress } from '../components/ScanProgressModal';
import type { Settings } from '../types';

export default function SettingsPage() {
  const { showError } = useNotice();
  const scanProgress = useScanProgress(() => api.getSettingsScanStatus());
  const [settings, setSettings] = useState<Settings>({
    media_path: '',
    movies_path: 'movies',
    series_path: 'series',
    tmdb_api_key: '',
    scan_interval: '*/30 * * * *',
    auto_scan: true,
    qbittorrent_url: '',
    qbittorrent_user: '',
    qbittorrent_pass: '',
    jellyfin_url: '',
    jellyfin_api_key: '',
    plex_url: '',
    plex_token: '',
    prowlarr_url: '',
    prowlarr_api_key: '',
    jackett_url: '',
    jackett_api_key: '',
    auth_enabled: true,
  });
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanScope, setScanScope] = useState<'all' | 'movie' | 'series'>('all');
  const [enriching, setEnriching] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [integrationMsg, setIntegrationMsg] = useState<{ ok?: boolean; text: string } | null>(null);
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [passMsg, setPassMsg] = useState<string | null>(null);

  useEffect(() => {
    api.getSettings().then(s => setSettings({ ...s, auto_scan: s.auto_scan ?? true })).catch(console.error);
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.saveSettings(settings);
      setMessage('Configuración guardada');
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      showError(errorMessage(err, 'Error al guardar'));
    } finally {
      setSaving(false);
    }
  }

  async function handleScan() {
    setScanning(true);
    setScanResult(null);
    const final = await scanProgress.start(() => api.scanLibrary(scanScope));
    setScanning(false);
    if (final?.error) {
      setScanResult(final.error);
    } else if (final?.result) {
      const label = scanScope === 'movie' ? 'películas' : scanScope === 'series' ? 'series' : 'archivos';
      setScanResult(`Escaneo de ${label}: ${final.result.total} en disco (+${final.result.added} nuevos, ${final.result.updated} actualizados, -${final.result.removed} eliminados)`);
    }
  }

  async function handleReEnrich() {
    setEnriching(true);
    setScanResult(null);
    try {
      const result = await api.reEnrichMetadata();
      setScanResult(`Metadatos TMDB actualizados en ${result.enriched} títulos`);
    } catch (err) {
      setScanResult(err instanceof Error ? err.message : 'Error al actualizar metadatos');
    } finally {
      setEnriching(false);
    }
  }

  function update(key: keyof Settings, value: string | boolean) {
    setSettings(prev => ({ ...prev, [key]: value }));
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPassMsg(null);
    try {
      await api.changePassword(currentPass, newPass);
      setPassMsg('Contraseña actualizada');
      setCurrentPass('');
      setNewPass('');
    } catch (err) {
      setPassMsg(err instanceof Error ? err.message : 'Error');
    }
  }

  async function handleIntegration(action: 'testJellyfin' | 'testPlex' | 'syncJellyfin' | 'syncPlex') {
    setIntegrationMsg(null);
    try {
      if (action === 'testJellyfin') {
        const r = await api.testJellyfin();
        setIntegrationMsg({ ok: r.ok, text: r.message });
      } else if (action === 'testPlex') {
        const r = await api.testPlex();
        setIntegrationMsg({ ok: r.ok, text: r.message });
      } else if (action === 'syncJellyfin') {
        const r = await api.syncJellyfin();
        setIntegrationMsg({
          ok: r.errors.length === 0,
          text: `Jellyfin: ${r.matched} coincidencias, ${r.updated} actualizados${r.errors.length ? `. Errores: ${r.errors.join(', ')}` : ''}`,
        });
      } else {
        const r = await api.syncPlex();
        setIntegrationMsg({
          ok: r.errors.length === 0,
          text: `Plex: ${r.matched} coincidencias, ${r.updated} actualizados${r.errors.length ? `. Errores: ${r.errors.join(', ')}` : ''}`,
        });
      }
    } catch (err) {
      setIntegrationMsg({ ok: false, text: err instanceof Error ? err.message : 'Error' });
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Configuración</h1>

      {message && (
        <div className="bg-green-500/15 border border-green-500/30 text-green-400 rounded-lg px-4 py-3 mb-6 text-sm">
          {message}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-8">
        {/* Rutas de medios */}
        <section className="bg-surface-card border border-surface-border rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <FolderOpen size={20} className="text-accent" />
            <h2 className="text-lg font-semibold">Carpeta de medios (Linux)</h2>
          </div>
          <p className="text-sm text-gray-400 mb-4">
            Ruta absoluta en tu servidor Linux donde están tus películas y series.
          </p>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-400 block mb-1">Ruta base</label>
              <input
                type="text"
                value={settings.media_path}
                onChange={e => update('media_path', e.target.value)}
                placeholder="/home/usuario/peliculas"
                className="w-full bg-surface border border-surface-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-accent font-mono"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-400 block mb-1">Subcarpeta películas</label>
                <input
                  type="text"
                  value={settings.movies_path}
                  onChange={e => update('movies_path', e.target.value)}
                  className="w-full bg-surface border border-surface-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-accent"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-1">Subcarpeta series</label>
                <input
                  type="text"
                  value={settings.series_path}
                  onChange={e => update('series_path', e.target.value)}
                  className="w-full bg-surface border border-surface-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-accent"
                />
              </div>
            </div>
          </div>
        </section>

        {/* TMDB */}
        <section className="bg-surface-card border border-surface-border rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Key size={20} className="text-accent" />
            <h2 className="text-lg font-semibold">TMDB API</h2>
          </div>
          <p className="text-sm text-gray-400 mb-4">
            Obtén tu API key gratis en{' '}
            <a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noreferrer" className="text-accent hover:underline">
              themoviedb.org
            </a>
          </p>
          <input
            type="password"
            value={settings.tmdb_api_key}
            onChange={e => update('tmdb_api_key', e.target.value)}
            placeholder="Tu API key de TMDB"
            className="w-full bg-surface border border-surface-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-accent"
          />
        </section>

        {/* qBittorrent & indexadores */}
        <section className="bg-surface-card border border-surface-border rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Server size={20} className="text-accent" />
            <h2 className="text-lg font-semibold">Descargas (qBittorrent + indexadores)</h2>
          </div>
          <p className="text-sm text-gray-400 mb-4">
            qBittorrent gestiona los torrents. Si ya tienes uno en otro stack (p. ej. jellyfinn), usa su URL interna.
            Prowlarr o Jackett amplían la búsqueda automática a cientos de indexadores.
          </p>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-400 block mb-1">qBittorrent URL</label>
              <input
                type="text"
                value={settings.qbittorrent_url}
                onChange={e => update('qbittorrent_url', e.target.value)}
                placeholder="http://qbittorrent:8787"
                className="w-full bg-surface border border-surface-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-accent"
              />
              <p className="text-xs text-gray-500 mt-1">
                Misma red Docker: <code className="text-purple-400">http://qbittorrent:8787</code> ·
                Desde el host: <code className="text-purple-400">http://192.168.50.197:8787</code>
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <input
                type="text"
                value={settings.qbittorrent_user}
                onChange={e => update('qbittorrent_user', e.target.value)}
                placeholder="Usuario qBittorrent"
                className="w-full bg-surface border border-surface-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-accent"
              />
              <input
                type="password"
                value={settings.qbittorrent_pass}
                onChange={e => update('qbittorrent_pass', e.target.value)}
                placeholder="Contraseña qBittorrent"
                className="w-full bg-surface border border-surface-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-accent"
              />
            </div>
            <div className="border-t border-surface-border pt-4">
              <label className="text-sm text-gray-400 block mb-1">Prowlarr URL (recomendado)</label>
              <input
                type="text"
                value={settings.prowlarr_url}
                onChange={e => update('prowlarr_url', e.target.value)}
                placeholder="http://localhost:9696"
                className="w-full bg-surface border border-surface-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-accent mb-2"
              />
              <input
                type="password"
                value={settings.prowlarr_api_key}
                onChange={e => update('prowlarr_api_key', e.target.value)}
                placeholder="API Key de Prowlarr"
                className="w-full bg-surface border border-surface-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="text-sm text-gray-400 block mb-1">Jackett URL (alternativa)</label>
              <input
                type="text"
                value={settings.jackett_url}
                onChange={e => update('jackett_url', e.target.value)}
                placeholder="http://localhost:9117"
                className="w-full bg-surface border border-surface-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-accent mb-2"
              />
              <input
                type="password"
                value={settings.jackett_api_key}
                onChange={e => update('jackett_api_key', e.target.value)}
                placeholder="API Key de Jackett"
                className="w-full bg-surface border border-surface-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-accent"
              />
            </div>
          </div>
        </section>

        {/* Jellyfin & Plex */}
        <section className="bg-surface-card border border-surface-border rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Link2 size={20} className="text-accent" />
            <h2 className="text-lg font-semibold">Jellyfin / Plex</h2>
          </div>
          <p className="text-sm text-gray-400 mb-4">
            Sincroniza metadatos (sinopsis, valoraciones) desde tu servidor existente.
          </p>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-400 block mb-1">Jellyfin URL</label>
              <input type="text" value={settings.jellyfin_url} onChange={e => update('jellyfin_url', e.target.value)}
                placeholder="http://localhost:8096" className="w-full bg-surface border border-surface-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-accent mb-2" />
              <input type="password" value={settings.jellyfin_api_key} onChange={e => update('jellyfin_api_key', e.target.value)}
                placeholder="API Key" className="w-full bg-surface border border-surface-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-accent" />
            </div>
            <div>
              <label className="text-sm text-gray-400 block mb-1">Plex URL</label>
              <input type="text" value={settings.plex_url} onChange={e => update('plex_url', e.target.value)}
                placeholder="http://localhost:32400" className="w-full bg-surface border border-surface-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-accent mb-2" />
              <input type="password" value={settings.plex_token} onChange={e => update('plex_token', e.target.value)}
                placeholder="X-Plex-Token" className="w-full bg-surface border border-surface-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-accent" />
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => handleIntegration('testJellyfin')} className="btn-secondary text-sm">Probar Jellyfin</button>
              <button type="button" onClick={() => handleIntegration('testPlex')} className="btn-secondary text-sm">Probar Plex</button>
              <button type="button" onClick={() => handleIntegration('syncJellyfin')} className="btn-secondary text-sm">Sync Jellyfin</button>
              <button type="button" onClick={() => handleIntegration('syncPlex')} className="btn-secondary text-sm">Sync Plex</button>
            </div>
            {integrationMsg && (
              <p className={`text-sm flex items-start gap-2 ${integrationMsg.ok === true ? 'text-green-400' : integrationMsg.ok === false ? 'text-red-400' : 'text-gray-400'}`}>
                {integrationMsg.ok === true && <CheckCircle size={16} className="flex-shrink-0 mt-0.5" />}
                {integrationMsg.ok === false && <XCircle size={16} className="flex-shrink-0 mt-0.5" />}
                {integrationMsg.ok === undefined && <Info size={16} className="flex-shrink-0 mt-0.5" />}
                {integrationMsg.text}
              </p>
            )}
          </div>
        </section>

        {/* Seguridad */}
        <section className="bg-surface-card border border-surface-border rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Shield size={20} className="text-accent" />
            <h2 className="text-lg font-semibold">Seguridad</h2>
          </div>
          <label className="flex items-center gap-2 text-sm mb-4">
            <input type="checkbox" checked={settings.auth_enabled} onChange={e => update('auth_enabled', e.target.checked)} className="rounded accent-accent" />
            Requerir login para acceder
          </label>
          <form onSubmit={handleChangePassword} className="space-y-3 border-t border-surface-border pt-4">
            <div className="flex items-center gap-2 mb-2">
              <Lock size={16} className="text-gray-400" />
              <span className="text-sm font-medium">Cambiar contraseña</span>
            </div>
            <input type="password" value={currentPass} onChange={e => setCurrentPass(e.target.value)} placeholder="Contraseña actual"
              className="w-full bg-surface border border-surface-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-accent" />
            <input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="Nueva contraseña (mín. 4 caracteres)"
              className="w-full bg-surface border border-surface-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-accent" />
            <button type="submit" className="btn-secondary text-sm">Actualizar contraseña</button>
            {passMsg && <p className="text-sm text-gray-400">{passMsg}</p>}
          </form>
        </section>

        {/* Escaneo */}
        <section className="bg-surface-card border border-surface-border rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">Escaneo automático</h2>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-400 block mb-1">Intervalo cron</label>
              <input
                type="text"
                value={settings.scan_interval}
                onChange={e => update('scan_interval', e.target.value)}
                placeholder="*/30 * * * *"
                className="w-full bg-surface border border-surface-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-accent font-mono"
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={settings.auto_scan}
                onChange={e => update('auto_scan', e.target.checked)}
                className="rounded accent-accent"
              />
              Escaneo automático activado
            </label>
          </div>
          <div className="flex flex-wrap gap-3 mt-4 items-center">
            <select
              value={scanScope}
              onChange={e => setScanScope(e.target.value as 'all' | 'movie' | 'series')}
              disabled={scanning || enriching}
              className="bg-surface border border-surface-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-accent"
            >
              <option value="all">Todo</option>
              <option value="movie">Solo películas</option>
              <option value="series">Solo series</option>
            </select>
            <button
              type="button"
              onClick={handleScan}
              disabled={scanning || enriching}
              className="btn-secondary flex items-center gap-2"
            >
              <RefreshCw size={16} className={scanning ? 'animate-spin' : ''} />
              {scanning ? 'Escaneando...' : 'Escanear ahora'}
            </button>
            <button
              type="button"
              onClick={handleReEnrich}
              disabled={scanning || enriching}
              className="btn-secondary flex items-center gap-2"
            >
              <RefreshCw size={16} className={enriching ? 'animate-spin' : ''} />
              {enriching ? 'Actualizando...' : 'Actualizar posters TMDB'}
            </button>
          </div>
          {scanResult && <p className="text-sm text-gray-400 mt-3">{scanResult}</p>}
        </section>

        <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2 w-full justify-center">
          <Save size={18} />
          {saving ? 'Guardando...' : 'Guardar configuración'}
        </button>
      </form>

      <ScanProgressModal
        open={scanProgress.open}
        status={scanProgress.status}
        onClose={() => scanProgress.close()}
      />
    </div>
  );
}
