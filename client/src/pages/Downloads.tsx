import { useEffect, useState } from 'react';
import { Trash2, RefreshCw, CheckCircle, XCircle, Clock, Download as DownloadIcon, FolderOpen, Film, Tv } from 'lucide-react';
import { api, posterUrl, formatBytes } from '../api';
import Modal from '../components/Modal';
import type { DownloadItem } from '../types';

const statusConfig: Record<string, { icon: typeof Clock; color: string; label: string }> = {
  queued: { icon: Clock, color: 'text-gray-400', label: 'En cola' },
  downloading: { icon: DownloadIcon, color: 'text-blue-400', label: 'Descargando' },
  awaiting_folder: { icon: FolderOpen, color: 'text-purple-400', label: 'Elige carpeta' },
  completed: { icon: CheckCircle, color: 'text-green-400', label: 'Completado' },
  failed: { icon: XCircle, color: 'text-red-400', label: 'Error' },
  paused: { icon: Clock, color: 'text-yellow-400', label: 'Pausado' },
};

export default function Downloads() {
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  const [folderModal, setFolderModal] = useState<DownloadItem | null>(null);
  const [folder, setFolder] = useState<'movies' | 'series'>('movies');
  const [subfolder, setSubfolder] = useState('');
  const [finalizing, setFinalizing] = useState(false);
  const [finalizeError, setFinalizeError] = useState<string | null>(null);
  const [dismissedIds, setDismissedIds] = useState<Set<number>>(new Set());

  function load() {
    api.getDownloads().then(setDownloads).catch(console.error);
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const pending = downloads.find(d => d.status === 'awaiting_folder' && !dismissedIds.has(d.id));
    if (pending && !folderModal) {
      openFolderModal(pending);
    }
  }, [downloads, folderModal, dismissedIds]);

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
      alert(`Archivo movido correctamente. Biblioteca actualizada (+${result.scan.added} nuevos).`);
    } catch (err) {
      setFinalizeError(err instanceof Error ? err.message : 'Error al mover');
    } finally {
      setFinalizing(false);
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Descargas</h1>
        <button onClick={load} className="btn-secondary flex items-center gap-2">
          <RefreshCw size={16} /> Actualizar
        </button>
      </div>

      {downloads.length === 0 ? (
        <div className="text-center py-20 text-gray-400 max-w-lg mx-auto">
          <DownloadIcon size={48} className="mx-auto mb-4 opacity-50" />
          <p className="mb-4">No hay descargas activas.</p>
          <div className="text-left text-sm bg-surface-card border border-purple-500/15 rounded-xl p-5 space-y-2">
            <p className="font-semibold text-white">¿Cómo descargar?</p>
            <p>1. Ve a <strong className="text-accent">Buscar</strong> y encuentra una película o serie en TMDB.</p>
            <p>2. Pulsa <strong className="text-accent">Descargar</strong> y pega un enlace <strong>magnet</strong> o <strong>URL directa</strong> (Eyedpelis no baja de TMDB solo).</p>
            <p>3. Cuando termine, elige si va a <strong>Películas</strong> o <strong>Series</strong>.</p>
            <p className="text-xs text-gray-500 pt-2">Para torrents necesitas qBittorrent configurado en Configuración.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {downloads.map(d => {
            const cfg = statusConfig[d.status] || statusConfig.queued;
            const Icon = cfg.icon;
            return (
              <div key={d.id} className="flex items-center gap-4 bg-surface-card border border-surface-border rounded-xl p-4">
                <img
                  src={posterUrl(d.poster_path, 'w200')}
                  alt=""
                  className="w-12 h-16 object-cover rounded-lg flex-shrink-0"
                  onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder-poster.svg'; }}
                />
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">{d.title}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <Icon size={14} className={cfg.color} />
                    <span className={`text-xs ${cfg.color}`}>{cfg.label}</span>
                    {d.size_bytes && <span className="text-xs text-gray-500">· {formatBytes(d.size_bytes)}</span>}
                  </div>
                  {d.status === 'downloading' && (
                    <div className="mt-2 h-1.5 bg-surface rounded-full overflow-hidden">
                      <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${d.progress}%` }} />
                    </div>
                  )}
                  {d.error_message && <p className="text-xs text-red-400 mt-1">{d.error_message}</p>}
                </div>
                {d.status === 'awaiting_folder' && (
                  <button onClick={() => openFolderModal(d)} className="btn-primary text-sm py-2 px-4">
                    Elegir carpeta
                  </button>
                )}
                <button onClick={() => handleDelete(d.id)} className="p-2 text-gray-500 hover:text-red-400 transition-colors">
                  <Trash2 size={18} />
                </button>
              </div>
            );
          })}
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
            </div>
          )}
        </div>

        {finalizeError && (
          <p className="text-sm text-red-400 mt-4">{finalizeError}</p>
        )}

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
