import { useEffect, useState } from 'react';
import { Trash2, RefreshCw, CheckCircle, XCircle, Clock, Download as DownloadIcon } from 'lucide-react';
import { api, posterUrl, formatBytes } from '../api';
import type { DownloadItem } from '../types';

const statusConfig: Record<string, { icon: typeof Clock; color: string; label: string }> = {
  queued: { icon: Clock, color: 'text-gray-400', label: 'En cola' },
  downloading: { icon: DownloadIcon, color: 'text-blue-400', label: 'Descargando' },
  completed: { icon: CheckCircle, color: 'text-green-400', label: 'Completado' },
  failed: { icon: XCircle, color: 'text-red-400', label: 'Error' },
  paused: { icon: Clock, color: 'text-yellow-400', label: 'Pausado' },
};

export default function Downloads() {
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);

  function load() {
    api.getDownloads().then(setDownloads).catch(console.error);
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, []);

  async function handleDelete(id: number) {
    await api.deleteDownload(id);
    load();
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
        <div className="text-center py-20 text-gray-400">
          <DownloadIcon size={48} className="mx-auto mb-4 opacity-50" />
          <p>No hay descargas. Busca contenido en la sección Buscar.</p>
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
                <button onClick={() => handleDelete(d.id)} className="p-2 text-gray-500 hover:text-red-400 transition-colors">
                  <Trash2 size={18} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
