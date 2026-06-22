import { NavLink, useNavigate } from 'react-router-dom';
import { Film, Tv, Search, Home, Eye, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { tvFocusClass } from './focus';

const navItems = [
  { to: '/', icon: Home, label: 'Inicio', end: true },
  { to: '/movies', icon: Film, label: 'Películas' },
  { to: '/series', icon: Tv, label: 'Series' },
  { to: '/search', icon: Search, label: 'Buscar' },
];

export default function TvSidebar() {
  const navigate = useNavigate();
  const { username, enabled, logout } = useAuth();

  return (
    <aside className="tv-sidebar flex flex-col w-[220px] bg-black/60 border-r border-purple-500/15 fixed h-full z-50 backdrop-blur-md">
      <div className="p-6 pb-4">
        <button
          type="button"
          onClick={() => navigate('/')}
          className={`font-extrabold tracking-tight flex items-center gap-3 text-2xl w-full text-left ${tvFocusClass}`}
        >
          <Eye size={30} className="text-accent" />
          <span className="brand-text">Eyedpelis</span>
        </button>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {navItems.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-3 px-5 py-4 rounded-xl font-semibold text-base min-h-[52px] ${tvFocusClass} ${
                isActive
                  ? 'bg-accent/20 text-accent-glow shadow-purple'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`
            }
          >
            <Icon size={26} />
            {label}
          </NavLink>
        ))}
      </nav>

      {enabled && username && (
        <div className="p-4 border-t border-surface-border">
          <p className="text-xs text-gray-500 mb-2 truncate px-2">{username}</p>
          <button
            type="button"
            onClick={logout}
            className={`flex items-center gap-3 text-gray-400 hover:text-white w-full px-5 py-3 rounded-xl hover:bg-white/5 min-h-[48px] ${tvFocusClass}`}
          >
            <LogOut size={20} /> Salir
          </button>
        </div>
      )}
    </aside>
  );
}
