import { useEffect, useState } from 'react';
import { Search as SearchIcon, SlidersHorizontal, X, LayoutGrid, List, BookA } from 'lucide-react';
import { api } from '../api';
import type { MediaItem } from '../types';

export type LibraryViewMode = 'grid' | 'alphabet' | 'list';

const VIEW_STORAGE_KEY = 'library-view-mode';

export const viewModeOptions: { id: LibraryViewMode; icon: typeof LayoutGrid; label: string }[] = [
  { id: 'grid', icon: LayoutGrid, label: 'Cuadrícula' },
  { id: 'alphabet', icon: BookA, label: 'Abecedario' },
  { id: 'list', icon: List, label: 'Lista' },
];

function loadViewMode(): LibraryViewMode {
  try {
    const v = localStorage.getItem(VIEW_STORAGE_KEY);
    if (v === 'grid' || v === 'alphabet' || v === 'list') return v;
  } catch { /* ignore */ }
  return 'grid';
}

export interface LibraryFilters {
  search: string;
  genre: string;
  year: string;
  sort: string;
}

export const defaultLibraryFilters: LibraryFilters = {
  search: '',
  genre: '',
  year: '',
  sort: 'title',
};

interface FilterOptions {
  genres: string[];
  years: number[];
}

interface Props {
  filters: LibraryFilters;
  onChange: (filters: LibraryFilters) => void;
  options: FilterOptions;
  loading?: boolean;
  resultCount?: number;
  viewMode: LibraryViewMode;
  onViewModeChange: (mode: LibraryViewMode) => void;
}

function useDebouncedValue<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function LibraryToolbar({ filters, onChange, options, loading, resultCount, viewMode, onViewModeChange }: Props) {
  const [searchInput, setSearchInput] = useState(filters.search);
  const debouncedSearch = useDebouncedValue(searchInput);

  useEffect(() => {
    setSearchInput(filters.search);
  }, [filters.search]);

  useEffect(() => {
    if (debouncedSearch !== filters.search) {
      onChange({ ...filters, search: debouncedSearch });
    }
  }, [debouncedSearch]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasFilters = filters.search || filters.genre || filters.year;

  function update(partial: Partial<LibraryFilters>) {
    onChange({ ...filters, ...partial });
  }

  function clearAll() {
    setSearchInput('');
    onChange(defaultLibraryFilters);
  }

  return (
    <div className="space-y-4 mb-8">
      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <SearchIcon size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Buscar por título, nombre original..."
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            className="w-full bg-surface-card border border-surface-border rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-accent"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-gray-500 text-sm mr-1">
            <SlidersHorizontal size={16} />
            <span className="hidden sm:inline">Filtrar</span>
          </div>

          <select
            value={filters.genre}
            onChange={e => update({ genre: e.target.value })}
            className="bg-surface-card border border-surface-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-accent min-w-[140px]"
          >
            <option value="">Todos los géneros</option>
            {options.genres.map(g => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>

          <select
            value={filters.year}
            onChange={e => update({ year: e.target.value })}
            className="bg-surface-card border border-surface-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-accent"
          >
            <option value="">Todos los años</option>
            {options.years.map(y => (
              <option key={y} value={String(y)}>{y}</option>
            ))}
          </select>

          <select
            value={filters.sort}
            onChange={e => update({ sort: e.target.value })}
            className="bg-surface-card border border-surface-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-accent"
          >
            <option value="title">Título A-Z</option>
            <option value="date">Más recientes (año)</option>
            <option value="rating">Mejor valoradas</option>
            <option value="recent">Añadidas recientemente</option>
          </select>

          {hasFilters && (
            <button type="button" onClick={clearAll} className="btn-secondary text-sm py-2 px-3 flex items-center gap-1">
              <X size={14} /> Limpiar
            </button>
          )}

          <div className="hidden sm:block w-px h-8 bg-surface-border mx-1" />

          <div className="flex items-center rounded-lg border border-surface-border bg-surface-card p-0.5" role="group" aria-label="Modo de vista">
            {viewModeOptions.map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => onViewModeChange(id)}
                title={label}
                className={`p-2 rounded-md transition-all ${
                  viewMode === id
                    ? 'bg-accent/20 text-accent-glow shadow-sm'
                    : 'text-gray-500 hover:text-white hover:bg-surface-hover'
                }`}
                aria-label={label}
                aria-pressed={viewMode === id}
              >
                <Icon size={18} />
              </button>
            ))}
          </div>
        </div>
      </div>

      {!loading && resultCount !== undefined && (
        <p className="text-sm text-gray-500">
          {resultCount} {resultCount === 1 ? 'resultado' : 'resultados'}
          {filters.genre && <span> · Género: <span className="text-accent-glow">{filters.genre}</span></span>}
          {filters.year && <span> · Año: {filters.year}</span>}
          <span className="hidden sm:inline text-gray-600"> · Vista: {viewModeOptions.find(v => v.id === viewMode)?.label}</span>
        </p>
      )}
    </div>
  );
}

export function useLibraryPage(type: 'movie' | 'series') {
  const [filters, setFilters] = useState<LibraryFilters>(defaultLibraryFilters);
  const [viewMode, setViewMode] = useState<LibraryViewMode>(loadViewMode);
  const [items, setItems] = useState<MediaItem[]>([]);
  const [filterOptions, setFilterOptions] = useState<{ genres: string[]; years: number[] }>({ genres: [], years: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getLibraryFilters(type).then(setFilterOptions).catch(console.error);
  }, [type]);

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, viewMode);
    } catch { /* ignore */ }
  }, [viewMode]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const params = {
      search: filters.search || undefined,
      genre: filters.genre || undefined,
      year: filters.year || undefined,
      sort: filters.sort,
    };
    const fetch = type === 'movie' ? api.getMovies(params) : api.getSeries(params);
    fetch
      .then(setItems)
      .catch(err => {
        setError(err instanceof Error ? err.message : 'Error al cargar');
        setItems([]);
      })
      .finally(() => setLoading(false));
  }, [type, filters]);

  return { filters, setFilters, items, filterOptions, loading, error, viewMode, setViewMode };
}
