import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Film, Tv, Search, Download, Settings, Home, Menu, X, LogOut, Eye } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import PageTransition from './PageTransition';

const navItems = [
  { to: '/', icon: Home, label: 'Inicio' },
  { to: '/movies', icon: Film, label: 'Películas' },
  { to: '/series', icon: Tv, label: 'Series' },
  { to: '/search', icon: Search, label: 'Buscar' },
  { to: '/downloads', icon: Download, label: 'Descargas' },
  { to: '/settings', icon: Settings, label: 'Config' },
];

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const { username, enabled, logout } = useAuth();

  return (
    <div className="min-h-screen flex">
      {/* Sidebar desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-surface-card border-r border-purple-500/10 fixed h-full z-50 animate-slide-in-left">
        <div className="p-6">
          <h1
            className="text-2xl font-extrabold cursor-pointer tracking-tight flex items-center gap-2 group"
            onClick={() => navigate('/')}
          >
            <Eye size={28} className="text-accent animate-float transition-transform duration-300 group-hover:scale-110" />
            <span className="brand-text">Eyedpelis</span>
          </h1>
        </div>
        <nav className="flex-1 px-3 space-y-1">
          {navItems.map(({ to, icon: Icon, label }, i) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `nav-link flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium animate-fade-in-up ${
                  isActive
                    ? 'bg-accent/15 text-accent shadow-purple'
                    : 'text-gray-400 hover:text-white hover:bg-surface-hover hover:translate-x-1'
                }`
              }
              style={{ animationDelay: `${100 + i * 60}ms` }}
            >
              <Icon size={20} className="transition-transform duration-300 group-hover:scale-110" />
              {label}
            </NavLink>
          ))}
        </nav>
        {enabled && username && (
          <div className="p-4 border-t border-surface-border">
            <p className="text-xs text-gray-500 mb-2 truncate">{username}</p>
            <button
              onClick={logout}
              className="flex items-center gap-2 text-sm text-gray-400 hover:text-white w-full px-4 py-2 rounded-lg hover:bg-surface-hover transition-colors"
            >
              <LogOut size={16} /> Cerrar sesión
            </button>
          </div>
        )}
      </aside>

      {/* Mobile header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-surface/95 backdrop-blur border-b border-purple-500/10">
        <div className="flex items-center justify-between p-4">
          <h1 className="text-xl font-extrabold flex items-center gap-2" onClick={() => navigate('/')}>
            <Eye size={22} className="text-accent" />
            <span className="brand-text">Eyedpelis</span>
          </h1>
          <button onClick={() => setMobileOpen(!mobileOpen)} className="p-2">
            {mobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
        {mobileOpen && (
          <nav className="px-4 pb-4 space-y-1 animate-fade-in-down">
            {navItems.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium ${
                    isActive ? 'bg-accent/15 text-accent' : 'text-gray-400'
                  }`
                }
              >
                <Icon size={20} />
                {label}
              </NavLink>
            ))}
          </nav>
        )}
      </div>

      <main className="flex-1 md:ml-64 pt-16 md:pt-0">
        <PageTransition>
          <Outlet />
        </PageTransition>
      </main>
    </div>
  );
}
