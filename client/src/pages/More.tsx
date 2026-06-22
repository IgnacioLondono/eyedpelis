import { Link } from 'react-router-dom';
import { Download, FolderOpen, Settings, LogOut, ChevronRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { usePlatform } from '../context/PlatformContext';
import { mobileTapClass, tvFocusClass } from '../components/android/focus';

const items = [
  { to: '/downloads', icon: Download, label: 'Descargas', desc: 'Cola y progreso de torrents' },
  { to: '/files', icon: FolderOpen, label: 'Archivos', desc: 'Gestionar vídeos en el NAS' },
  { to: '/settings', icon: Settings, label: 'Configuración', desc: 'Biblioteca, indexadores y cuenta' },
];

export default function MorePage() {
  const { logout, username, enabled } = useAuth();
  const { isAndroidTv } = usePlatform();
  const focus = isAndroidTv ? tvFocusClass : mobileTapClass;

  return (
    <div className={isAndroidTv ? 'p-10 max-w-2xl' : 'px-4 py-6 pb-8'}>
      <h1 className={`font-bold mb-6 ${isAndroidTv ? 'text-4xl' : 'text-2xl'}`}>Más opciones</h1>

      <div className="space-y-3">
        {items.map(({ to, icon: Icon, label, desc }) => (
          <Link
            key={to}
            to={to}
            className={`flex items-center gap-4 p-4 rounded-2xl bg-surface-card border border-purple-500/10 hover:border-accent/30 min-h-[64px] ${focus}`}
          >
            <div className="w-12 h-12 rounded-xl bg-accent/15 flex items-center justify-center shrink-0">
              <Icon size={24} className="text-accent-glow" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold">{label}</p>
              <p className="text-sm text-gray-500 truncate">{desc}</p>
            </div>
            <ChevronRight size={20} className="text-gray-600 shrink-0" />
          </Link>
        ))}
      </div>

      {enabled && username && (
        <button
          type="button"
          onClick={logout}
          className={`mt-8 flex items-center justify-center gap-2 w-full py-4 rounded-xl border border-red-500/20 text-red-400 hover:bg-red-500/10 min-h-[52px] ${focus}`}
        >
          <LogOut size={20} />
          Cerrar sesión ({username})
        </button>
      )}
    </div>
  );
}
