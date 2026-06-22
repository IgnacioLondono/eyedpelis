import LibraryToolbar, { useLibraryPage } from '../components/LibraryToolbar';
import LibraryMediaGrid from '../components/LibraryMediaGrid';

export default function Series() {
  const { filters, setFilters, items, filterOptions, loading, error } = useLibraryPage('series');

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Series</h1>

      <LibraryToolbar
        filters={filters}
        onChange={setFilters}
        options={filterOptions}
        loading={loading}
        resultCount={loading ? undefined : items.length}
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
        <p className="text-gray-400 text-center py-20">No hay series con esos filtros.</p>
      ) : (
        <LibraryMediaGrid
          items={items}
          alphabetIndex={filters.sort === 'title' && !filters.search}
        />
      )}
    </div>
  );
}
