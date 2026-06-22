import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Film, Tv, Search, Download, Settings, Home, Menu, X, LogOut, Eye, FolderOpen } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { isTv } from '../utils/device';
import PageTransition from './PageTransition';

const navItems = [
  { to: '/', icon: Home, label: 'Inicio' },
  { to: '/movies', icon: Film, label: 'Películas' },
  { to: '/series', icon: Tv, label: 'Series' },
  { to: '/search', icon: Search, label: 'Buscar' },
  { to: '/downloads', icon: Download, label: 'Descargas' },
  { to: '/files', icon: FolderOpen, label: 'Archivos' },
  { to: '/settings', icon: Settings, label: 'Config' },
];

const TV_HIDDEN_ROUTES = new Set(['/downloads', '/files', '/settings']);

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const { username, enabled, logout } = useAuth();
  const tvMode = isTv();
  const visibleNavItems = tvMode
    ? navItems.filter(({ to }) => !TV_HIDDEN_ROUTES.has(to))
    : navItems;

  return (
    <div className={`min-h-screen flex ${tvMode ? 'tv-layout' : ''}`}>
      {/* Sidebar desktop / TV */}
      <aside
        className={
          tvMode
            ? 'flex flex-col w-[280px] bg-surface-card border-r border-purple-500/10 fixed h-full z-50'
            : 'hidden md:flex flex-col w-64 bg-surface-card border-r border-purple-500/10 fixed h-full z-50 animate-slide-in-left'
        }
      >
        <div className="p-6">
          <h1
            className={`font-extrabold cursor-pointer tracking-tight flex items-center gap-2 group ${tvMode ? 'text-3xl' : 'text-2xl'}`}
            onClick={() => navigate('/')}
          >
            <Eye size={tvMode ? 32 : 28} className="text-accent animate-float transition-transform duration-300 group-hover:scale-110" />
            <span className="brand-text">Eyedpelis</span>
          </h1>
        </div>
        <nav className="flex-1 px-3 space-y-1">
          {visibleNavItems.map(({ to, icon: Icon, label }, i) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `nav-link flex items-center gap-3 px-4 rounded-lg font-medium animate-fade-in-up focus-visible:outline-none ${
                  tvMode ? 'py-4 text-base min-h-[48px]' : 'py-3 text-sm'
                } ${
                  isActive
                    ? 'bg-accent/15 text-accent shadow-purple'
                    : 'text-gray-400 hover:text-white hover:bg-surface-hover hover:translate-x-1'
                }`
              }
              style={{ animationDelay: `${100 + i * 60}ms` }}
            >
              <Icon size={tvMode ? 24 : 20} className="transition-transform duration-300 group-hover:scale-110" />
              {label}
            </NavLink>
          ))}
        </nav>
        {enabled && username && (
          <div className="p-4 border-t border-surface-border">
            <p className="text-xs text-gray-500 mb-2 truncate">{username}</p>
            <button
              onClick={logout}
              className={`flex items-center gap-2 text-gray-400 hover:text-white w-full px-4 rounded-lg hover:bg-surface-hover transition-colors focus-visible:outline-none ${
                tvMode ? 'py-3 text-base min-h-[48px]' : 'py-2 text-sm'
              }`}
            >
              <LogOut size={tvMode ? 20 : 16} /> Cerrar sesión
            </button>
          </div>
        )}
      </aside>

      {/* Mobile header */}
      {!tvMode && (
        <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-surface/95 backdrop-blur border-b border-purple-500/10">
          <div className="flex items-center justify-between p-4">
            <h1 className="text-xl font-extrabold flex items-center gap-2" onClick={() => navigate('/')}>
              <Eye size={22} className="text-accent" />
              <span className="brand-text">Eyedpelis</span>
            </h1>
            <button onClick={() => setMobileOpen(!mobileOpen)} className="p-2 min-h-[48px] min-w-[48px]">
              {mobileOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
          {mobileOpen && (
            <nav className="px-4 pb-4 space-y-1 animate-fade-in-down">
              {visibleNavItems.map(({ to, icon: Icon, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/'}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium min-h-[48px] ${
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
      )}

      <main className={tvMode ? 'flex-1 ml-[280px] pt-0 tv-main' : 'flex-1 md:ml-64 pt-16 md:pt-0'}>
        <PageTransition>
          <Outlet />
        </PageTransition>
      </main>
    </div>
  );
}
