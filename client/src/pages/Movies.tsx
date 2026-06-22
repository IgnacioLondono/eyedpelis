import LibraryToolbar, { useLibraryPage } from '../components/LibraryToolbar';
import LibraryMediaGrid from '../components/LibraryMediaGrid';
import { usePageShell } from '../hooks/usePageShell';

export default function Movies() {
  const { filters, setFilters, items, filterOptions, loading, error, viewMode, setViewMode } = useLibraryPage('movie');
  const { shell, title } = usePageShell();

  return (
    <div className={shell}>
      <h1 className={title}>Películas</h1>

      <LibraryToolbar
        filters={filters}
        onChange={setFilters}
        options={filterOptions}
        loading={loading}
        resultCount={loading ? undefined : items.length}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] rounded-xl shimmer-bg" />
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-20">
          <p className="text-red-400 mb-4">{error}</p>
          <button type="button" onClick={() => setFilters(f => ({ ...f }))} className="btn-secondary">
            Reintentar
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p>No hay películas con esos filtros.</p>
        </div>
      ) : (
        <LibraryMediaGrid items={items} showPlay viewMode={viewMode} />
      )}
    </div>
  );
}
