import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { AlertCircle, CheckCircle, Info } from 'lucide-react';
import Modal from '../components/Modal';

export type NoticeVariant = 'success' | 'error' | 'info';

interface Notice {
  title: string;
  message: string;
  variant: NoticeVariant;
}

interface NoticeOptions {
  title?: string;
  message: string;
  variant?: NoticeVariant;
}

interface NoticeContextValue {
  showNotice: (options: NoticeOptions) => void;
  showError: (message: string, title?: string) => void;
  showSuccess: (message: string, title?: string) => void;
  showInfo: (message: string, title?: string) => void;
}

const NoticeContext = createContext<NoticeContextValue | null>(null);

const variantConfig: Record<NoticeVariant, { icon: typeof Info; color: string; border: string; defaultTitle: string }> = {
  success: { icon: CheckCircle, color: 'text-green-400', border: 'border-green-500/30', defaultTitle: 'Listo' },
  error: { icon: AlertCircle, color: 'text-red-400', border: 'border-red-500/30', defaultTitle: 'Error' },
  info: { icon: Info, color: 'text-blue-400', border: 'border-blue-500/30', defaultTitle: 'Aviso' },
};

export function errorMessage(err: unknown, fallback = 'Ha ocurrido un error'): string {
  if (err instanceof Error) {
    if (err.message === 'Failed to fetch') {
      return 'No se pudo conectar con el servidor. Comprueba que Eyedpelis esté en marcha.';
    }
    return err.message;
  }
  return fallback;
}

export function NoticeProvider({ children }: { children: ReactNode }) {
  const [notice, setNotice] = useState<Notice | null>(null);

  const showNotice = useCallback((options: NoticeOptions) => {
    const variant = options.variant ?? 'info';
    setNotice({
      title: options.title ?? variantConfig[variant].defaultTitle,
      message: options.message,
      variant,
    });
  }, []);

  const showError = useCallback((message: string, title?: string) => {
    showNotice({ title: title ?? 'Error', message, variant: 'error' });
  }, [showNotice]);

  const showSuccess = useCallback((message: string, title?: string) => {
    showNotice({ title: title ?? 'Listo', message, variant: 'success' });
  }, [showNotice]);

  const showInfo = useCallback((message: string, title?: string) => {
    showNotice({ title: title ?? 'Aviso', message, variant: 'info' });
  }, [showNotice]);

  const cfg = notice ? variantConfig[notice.variant] : null;
  const Icon = cfg?.icon ?? Info;

  return (
    <NoticeContext.Provider value={{ showNotice, showError, showSuccess, showInfo }}>
      {children}
      <Modal open={!!notice} onClose={() => setNotice(null)} title={notice?.title}>
        {notice && cfg && (
          <div className={`flex gap-4 p-4 rounded-xl border ${cfg.border} bg-black/20 mb-6`}>
            <Icon size={24} className={`${cfg.color} shrink-0 mt-0.5`} />
            <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">{notice.message}</p>
          </div>
        )}
        <div className="flex justify-end">
          <button type="button" onClick={() => setNotice(null)} className="btn-primary px-8">
            Aceptar
          </button>
        </div>
      </Modal>
    </NoticeContext.Provider>
  );
}

export function useNotice() {
  const ctx = useContext(NoticeContext);
  if (!ctx) throw new Error('useNotice debe usarse dentro de NoticeProvider');
  return ctx;
}
