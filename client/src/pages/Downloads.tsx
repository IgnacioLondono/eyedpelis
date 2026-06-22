import { useEffect, useMemo, useState } from 'react';
import {
  Trash2, RefreshCw, CheckCircle, XCircle, Clock, Download as DownloadIcon,
  FolderOpen, Film, Tv, Gauge, Timer, HardDrive,
} from 'lucide-react';
import { api, posterUrl, formatBytes, formatSpeed, formatEta } from '../api';
import Modal from '../components/Modal';
import { useNotice } from '../context/NoticeContext';
import type { DownloadItem } from '../types';

const statusConfig: Record<string, { icon: typeof Clock; color: string; label: string; bar?: string }> = {
  queued: { icon: Clock, color: 'text-gray-400', label: 'En cola', bar: 'bg-gray-500' },
  downloading: { icon: DownloadIcon, color: 'text-blue-400', label: 'Descargando', bar: 'bg-blue-500' },
  awaiting_folder: { icon: FolderOpen, color: 'text-purple-400', label: 'Elige carpeta', bar: 'bg-purple-500' },
  completed: { icon: CheckCircle, color: 'text-green-400', label: 'Completado', bar: 'bg-green-500' },
  failed: { icon: XCircle, color: 'text-red-400', label: 'Error', bar: 'bg-red-500' },
  paused: { icon: Clock, color: 'text-yellow-400', label: 'Pausado', bar: 'bg-yellow-500' },
};

function isActive(d: DownloadItem) {
  return d.status === 'queued' || d.status === 'downloading' || d.status === 'paused';
}

export default function Downloads() {
  const { showSuccess } = useNotice();
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  const [folderModal, setFolderModal] = useState<DownloadItem | null>(null);
  const [folder, setFolder] = useState<'movies' | 'series'>('movies');
  const [subfolder, setSubfolder] = useState('');
  const [finalizing, setFinalizing] = useState(false);
  const [finalizeError, setFinalizeError] = useState<string | null>(null);
  const [dismissedIds, setDismissedIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);

  function load() {
    api.getDownloads()
      .then(setDownloads)
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const pending = downloads.find(d => d.status === 'awaiting_folder' && !dismissedIds.has(d.id));
    if (pending && !folderModal) openFolderModal(pending);
  }, [downloads, folderModal, dismissedIds]);

  const { active, finished } = useMemo(() => ({
    active: downloads.filter(d => isActive(d) || d.status === 'awaiting_folder'),
    finished: downloads.filter(d => d.status === 'completed' || d.status === 'failed'),
  }), [downloads]);

  const activeCount = downloads.filter(d => d.status === 'downloading' || d.status === 'queued').length;

  function openFolderModal(item: DownloadItem) {
    setFolderModal(item);
    setFolder(item.type === 'series' ? 'series' : 'movies');
    setSubfolder(item.type === 'series' ? item.title : '');
    setFinalizeError(null);
  }

  async function handleDelete(id: number) {
    await api.deleteDownload(id);
    if (folderModal?.id === id) setFolderModal(null);
    load();
  }

  async function handleFinalize() {
    if (!folderModal) return;
    setFinalizing(true);
    setFinalizeError(null);
    try {
      const result = await api.finalizeDownload(folderModal.id, folder, subfolder || undefined);
      setFolderModal(null);
      load();
      showSuccess(`Archivo movido correctamente.\nBiblioteca actualizada (+${result.scan.added} nuevos).`);
    } catch (err) {
      setFinalizeError(err instanceof Error ? err.message : 'Error al mover');
    } finally {
      setFinalizing(false);
    }
  }

  function renderCard(d: DownloadItem) {
    const cfg = statusConfig[d.status] || statusConfig.queued;
    const Icon = cfg.icon;
    const showProgress = d.status === 'downloading' || d.status === 'queued' || d.status === 'paused';
    const progress = Math.max(0, Math.min(100, d.progress ?? 0));

    return (
      <div
        key={d.id}
        className="bg-surface-card border border-purple-500/15 rounded-2xl p-4 md:p-5 hover:border-purple-500/30 transition-colors"
      >
        <div className="flex gap-4">
          <img
            src={posterUrl(d.poster_path, 'w200')}
            alt=""
            className="w-14 h-20 md:w-16 md:h-24 object-cover rounded-lg flex-shrink-0 ring-1 ring-purple-500/20"
            onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder-poster.svg'; }}
          />

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {d.type === 'movie' ? <Film size={13} className="text-purple-400 shrink-0" /> : <Tv size={13} className="text-violet-400 shrink-0" />}
                  <span className="text-[10px] uppercase tracking-wider text-gray-500">{d.type === 'movie' ? 'Película' : 'Serie'}</span>
                </div>
                <h3 className="font-semibold truncate text-base">{d.title}</h3>
              </div>
              <button
                onClick={() => handleDelete(d.id)}
                className="p-2 text-gray-500 hover:text-red-400 transition-colors shrink-0"
                title="Eliminar"
              >
                <Trash2 size={18} />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              <span className={`inline-flex items-center gap-1 ${cfg.color}`}>
                <Icon size={13} />
                {cfg.label}
              </span>
              {showProgress && (
                <span className="text-gray-300 font-semibold tabular-nums">{progress}%</span>
              )}
              {d.size_bytes != null && d.size_bytes > 0 && (
                <span className="inline-flex items-center gap-1 text-gray-500">
                  <HardDrive size={12} />
                  {formatBytes(d.size_bytes)}
                </span>
              )}
              {d.download_speed != null && d.download_speed > 0 && (
                <span className="inline-flex items-center gap-1 text-blue-300">
                  <Gauge size={12} />
                  {formatSpeed(d.download_speed)}
                </span>
              )}
              {d.eta_seconds != null && d.eta_seconds > 0 && d.status === 'downloading' && (
                <span className="inline-flex items-center gap-1 text-gray-500">
                  <Timer size={12} />
                  {formatEta(d.eta_seconds)}
                </span>
              )}
            </div>

            {showProgress && (
              <div className="mt-3">
                <div className="h-2.5 bg-black/40 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${cfg.bar || 'bg-accent'} ${d.status === 'downloading' ? 'bg-gradient-to-r from-blue-600 to-accent' : ''}`}
                    style={{ width: `${Math.max(progress, d.status === 'queued' ? 2 : 0)}%` }}
                  />
                </div>
              </div>
            )}

            {d.status === 'awaiting_folder' && (
              <button onClick={() => openFolderModal(d)} className="btn-primary text-sm py-2 px-4 mt-3">
                Elegir carpeta
              </button>
            )}

            {d.error_message && (
              <p className="text-xs text-red-400 mt-2 leading-relaxed">{d.error_message}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Descargas</h1>
          <p className="text-sm text-gray-500 mt-1">
            {activeCount > 0 ? `${activeCount} activa(s) · actualización cada 3s` : 'Sin descargas activas'}
          </p>
        </div>
        <button onClick={load} className="btn-secondary flex items-center gap-2">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Actualizar
        </button>
      </div>

      {downloads.length === 0 ? (
        <div className="text-center py-16 text-gray-400 max-w-lg mx-auto">
          <DownloadIcon size={48} className="mx-auto mb-4 opacity-50" />
          <p className="mb-4">No hay descargas.</p>
          <div className="text-left text-sm bg-surface-card border border-purple-500/15 rounded-xl p-5 space-y-2">
            <p className="font-semibold text-white">¿Cómo descargar?</p>
            <p>1. Ve a <strong className="text-accent">Buscar</strong> y elige una película o serie.</p>
            <p>2. Pulsa <strong className="text-accent">Descargar</strong> — busca torrents automáticamente.</p>
            <p>3. Sigue el progreso aquí y elige carpeta al terminar.</p>
            <p className="text-xs text-gray-500 pt-2">Necesitas qBittorrent en Configuración.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {active.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">En curso</h2>
              <div className="space-y-3">{active.map(renderCard)}</div>
            </section>
          )}
          {finished.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Historial</h2>
              <div className="space-y-3">{finished.map(renderCard)}</div>
            </section>
          )}
        </div>
      )}

      <Modal
        open={!!folderModal}
        onClose={() => setFolderModal(null)}
        title={folderModal ? `¿Dónde guardar "${folderModal.title}"?` : undefined}
        maxWidth="max-w-md"
      >
        <p className="text-sm text-gray-400 mb-5">
          La descarga terminó. Elige la carpeta de destino en tu biblioteca.
        </p>

        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setFolder('movies')}
            className={`w-full flex items-center gap-3 p-4 rounded-xl border transition-colors ${
              folder === 'movies'
                ? 'border-accent bg-accent/10 text-white'
                : 'border-surface-border bg-surface hover:border-purple-500/30'
            }`}
          >
            <Film size={20} className={folder === 'movies' ? 'text-accent' : 'text-gray-400'} />
            <div className="text-left">
              <p className="font-medium">Películas</p>
              <p className="text-xs text-gray-500">Carpeta Peliculas/</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setFolder('series')}
            className={`w-full flex items-center gap-3 p-4 rounded-xl border transition-colors ${
              folder === 'series'
                ? 'border-accent bg-accent/10 text-white'
                : 'border-surface-border bg-surface hover:border-purple-500/30'
            }`}
          >
            <Tv size={20} className={folder === 'series' ? 'text-accent' : 'text-gray-400'} />
            <div className="text-left">
              <p className="font-medium">Series</p>
              <p className="text-xs text-gray-500">Carpeta Series/</p>
            </div>
          </button>

          {folder === 'series' && (
            <div>
              <label className="text-sm text-gray-400 block mb-1">Subcarpeta (nombre de la serie)</label>
              <input
                type="text"
                value={subfolder}
                onChange={e => setSubfolder(e.target.value)}
                placeholder="Ej: Dragon Ball Z"
                className="w-full bg-surface border border-surface-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-accent"
              />
              <p className="text-xs text-gray-500 mt-1">
                Ruta: Series/{subfolder || '…'}/archivo.mkv — idealmente con S01E01 en el nombre del archivo.
              </p>
            </div>
          )}
        </div>

        {finalizeError && <p className="text-sm text-red-400 mt-4">{finalizeError}</p>}

        <div className="flex gap-3 mt-6">
          <button
            onClick={handleFinalize}
            disabled={finalizing || (folder === 'series' && !subfolder.trim())}
            className="btn-primary flex-1 disabled:opacity-50"
          >
            {finalizing ? 'Moviendo...' : 'Guardar aquí'}
          </button>
          <button
            type="button"
            onClick={() => {
              if (folderModal) setDismissedIds(prev => new Set(prev).add(folderModal.id));
              setFolderModal(null);
            }}
            className="btn-secondary"
          >
            Después
          </button>
        </div>
      </Modal>
    </div>
  );
}
