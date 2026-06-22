import { useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import Modal from './Modal';
import type { ScanStatus } from '../types';

interface Props {
  open: boolean;
  status: ScanStatus | null;
  onClose: () => void;
}

const phaseLabel: Record<ScanStatus['phase'], string> = {
  idle: 'Preparando...',
  indexing: 'Indexando archivos',
  enriching: 'Metadatos TMDB',
  done: 'Completado',
};

export default function ScanProgressModal({ open, status, onClose }: Props) {
  const percent = status && status.total > 0
    ? Math.round((status.current / status.total) * 100)
    : status?.phase === 'done' ? 100 : 0;

  const canClose = status && !status.running && status.phase === 'done';

  return (
    <Modal open={open} onClose={canClose ? onClose : () => {}} title="Escaneando biblioteca" maxWidth="max-w-md">
      <div className="space-y-4">
        <div className="flex items-center gap-3 text-sm text-gray-300">
          <RefreshCw size={18} className={status?.running ? 'animate-spin text-accent shrink-0' : 'text-green-400 shrink-0'} />
          <span>{status ? phaseLabel[status.phase] : 'Iniciando...'}</span>
        </div>

        {(status?.running || status?.phase === 'enriching') && (
          <>
            <div className="h-2.5 bg-black/40 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-600 to-accent rounded-full transition-all duration-300"
                style={{ width: `${Math.max(percent, status?.running ? 4 : 0)}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 truncate">
              {status.total > 0
                ? `${status.current} / ${status.total} — ${status.message}`
                : status.message}
            </p>
          </>
        )}

        {status?.result && (
          <div className="rounded-xl border border-green-500/25 bg-green-500/10 px-4 py-3 text-sm text-green-200">
            <p className="font-medium">{status.result.total} archivos en disco</p>
            <p className="text-green-300/80 mt-1">
              +{status.result.added} nuevos · {status.result.updated} actualizados · -{status.result.removed} eliminados
            </p>
            {status.enrichCount > 0 && (
              <p className="text-green-300/70 mt-1 text-xs">{status.enrichCount} títulos con metadatos TMDB</p>
            )}
          </div>
        )}

        {status?.error && (
          <p className="text-sm text-red-400">{status.error}</p>
        )}

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={!canClose}
            className="btn-primary px-8 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {canClose ? 'Aceptar' : 'Escaneando...'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function useScanProgress(pollFn: () => Promise<ScanStatus>) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<ScanStatus | null>(null);
  const abortRef = useRef(false);

  async function start(startFn: () => Promise<{ started: boolean } & ScanStatus>): Promise<ScanStatus | null> {
    setOpen(true);
    abortRef.current = false;
    setStatus({
      running: true,
      phase: 'indexing',
      current: 0,
      total: 0,
      message: 'Iniciando...',
      result: null,
      enrichCount: 0,
      error: null,
    });

    try {
      await startFn();
      while (!abortRef.current) {
        const s = await pollFn();
        setStatus(s);
        if (!s.running && s.phase === 'done') return s;
        await new Promise(r => setTimeout(r, 400));
      }
    } catch (err) {
      const failed: ScanStatus = {
        running: false,
        phase: 'done',
        current: 0,
        total: 0,
        message: '',
        result: null,
        enrichCount: 0,
        error: err instanceof Error ? err.message : 'Error al escanear',
      };
      setStatus(failed);
      return failed;
    }
    return null;
  }

  function close() {
    abortRef.current = true;
    setOpen(false);
    setStatus(null);
  }

  return { open, status, start, close };
}
