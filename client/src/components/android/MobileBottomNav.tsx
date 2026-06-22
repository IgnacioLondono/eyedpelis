import { Link, useLocation } from 'react-router-dom';
import { Home, Film, Tv, Search, MoreHorizontal } from 'lucide-react';
import { mobileTapClass } from './focus';

const tabs = [
  { to: '/', icon: Home, label: 'Inicio', end: true },
  { to: '/movies', icon: Film, label: 'Películas' },
  { to: '/series', icon: Tv, label: 'Series' },
  { to: '/search', icon: Search, label: 'Buscar' },
  { to: '/more', icon: MoreHorizontal, label: 'Más' },
];

export default function MobileBottomNav() {
  const { pathname } = useLocation();

  if (pathname.startsWith('/watch/')) return null;

  return (
    <nav
      className="android-bottom-nav fixed bottom-0 left-0 right-0 z-50 border-t border-purple-500/15 bg-surface/95 backdrop-blur-xl safe-bottom"
      aria-label="Navegación principal"
    >
      <div className="flex items-stretch justify-around max-w-lg mx-auto">
        {tabs.map(({ to, icon: Icon, label, end }) => {
          const active = end ? pathname === '/' : pathname.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] min-w-[56px] ${mobileTapClass} ${
                active ? 'text-accent-glow' : 'text-gray-500'
              }`}
            >
              <Icon size={22} strokeWidth={active ? 2.5 : 2} />
              <span className="text-[10px] font-medium">{label}</span>
              {active && <span className="absolute bottom-1 w-1 h-1 rounded-full bg-accent-glow" />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
