import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ChevronRight,
  Download,
  File,
  FileVideo,
  Film,
  Folder,
  FolderPlus,
  HardDrive,
  Home,
  Pencil,
  RefreshCw,
  Trash2,
  Tv,
  Upload,
} from 'lucide-react';
import { api, formatBytes } from '../api';
import Modal from '../components/Modal';
import ScanProgressModal, { useScanProgress } from '../components/ScanProgressModal';
import { errorMessage, useNotice } from '../context/NoticeContext';
import type { LibraryStats } from '../types';

interface FileEntry {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size: number;
  modified: string;
  extension: string | null;
  category: 'video' | 'subtitle' | 'other';
}

interface FilesInfo {
  mediaPath: string;
  moviesPath: string;
  seriesPath: string;
  readOnly: boolean;
}

function EntryIcon({ entry }: { entry: FileEntry }) {
  if (entry.type === 'directory') return <Folder size={20} className="text-amber-400 shrink-0" />;
  if (entry.category === 'video') return <FileVideo size={20} className="text-purple-400 shrink-0" />;
  if (entry.category === 'subtitle') return <File size={20} className="text-blue-400 shrink-0" />;
  return <File size={20} className="text-gray-500 shrink-0" />;
}

const UPLOAD_ACCEPT = '.mkv,.mp4,.avi,.mov,.wmv,.m4v,.webm,.ts,.m2ts,.srt,.vtt,.ass,.ssa,.nfo';

function formatModified(iso: string) {
  return new Date(iso).toLocaleString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function FileManager() {
  const { showError } = useNotice();
  const scanProgress = useScanProgress(() => api.getFilesScanStatus());
  const [info, setInfo] = useState<FilesInfo | null>(null);
  const [currentPath, setCurrentPath] = useState('');
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const [mkdirOpen, setMkdirOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [mkdirLoading, setMkdirLoading] = useState(false);

  const [renameTarget, setRenameTarget] = useState<FileEntry | null>(null);
  const [renameName, setRenameName] = useState('');
  const [renameLoading, setRenameLoading] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<FileEntry | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [scanning, setScanning] = useState(false);
  const [stats, setStats] = useState<LibraryStats | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadLabel, setUploadLabel] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const readOnly = info?.readOnly ?? false;

  const loadDir = useCallback(async (path: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.listFiles(path);
      setCurrentPath(data.path);
      setEntries(data.entries);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    api.getFilesInfo().then(setInfo).catch(console.error);
    api.getStats().then(setStats).catch(console.error);
    loadDir('');
  }, [loadDir]);

  function showMsg(text: string) {
    setActionMsg(text);
    setTimeout(() => setActionMsg(null), 4000);
  }

  function navigateTo(path: string) {
    loadDir(path);
  }

  function goUp() {
    if (!currentPath) return;
    const parts = currentPath.split('/').filter(Boolean);
    parts.pop();
    loadDir(parts.join('/'));
  }

  const breadcrumbs = currentPath ? currentPath.split('/').filter(Boolean) : [];

  async function handleMkdir(e: React.FormEvent) {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    setMkdirLoading(true);
    try {
      await api.mkdirFile(currentPath, newFolderName.trim());
      setMkdirOpen(false);
      setNewFolderName('');
      showMsg('Carpeta creada');
      loadDir(currentPath);
    } catch (err) {
      showError(errorMessage(err));
    } finally {
      setMkdirLoading(false);
    }
  }

  async function handleRename(e: React.FormEvent) {
    e.preventDefault();
    if (!renameTarget || !renameName.trim()) return;
    setRenameLoading(true);
    try {
      const res = await api.renameFile(renameTarget.path, renameName.trim());
      setRenameTarget(null);
      showMsg(`Renombrado — biblioteca: +${res.scan.added} / -${res.scan.removed}`);
      loadDir(currentPath);
    } catch (err) {
      showError(errorMessage(err));
    } finally {
      setRenameLoading(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const res = await api.deleteFile(deleteTarget.path);
      setDeleteTarget(null);
      showMsg(`Eliminado — biblioteca: -${res.scan.removed} entradas`);
      loadDir(currentPath);
    } catch (err) {
      showError(errorMessage(err));
    } finally {
      setDeleteLoading(false);
    }
  }

  async function handleScan() {
    setScanning(true);
    const final = await scanProgress.start(() => api.scanFilesLibrary());
    setScanning(false);
    if (final?.result) {
      api.getStats().then(setStats).catch(console.error);
    } else if (final?.error) {
      showError(final.error);
    }
  }

  function handleScanClose() {
    scanProgress.close();
  }

  async function handleUploadFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList);
    if (!files.length || readOnly || uploading) return;

    setUploading(true);
    setUploadProgress(0);
    setUploadLabel(files.length === 1 ? files[0].name : `${files.length} archivos`);

    try {
      const res = await api.uploadFiles(currentPath, files, setUploadProgress);
      showMsg(`Subida completada — biblioteca: +${res.scan.added} nuevo(s)`);
      loadDir(currentPath);
      api.getStats().then(setStats).catch(console.error);
    } catch (err) {
      showError(errorMessage(err, 'Error al subir'));
    } finally {
      setUploading(false);
      setUploadProgress(0);
      setUploadLabel('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (readOnly || uploading) return;
    if (e.dataTransfer.files.length) handleUploadFiles(e.dataTransfer.files);
  }

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Archivos</h1>
          <p className="text-gray-400 text-sm mt-1">
            Explora y gestiona la carpeta de medios
            {info && (
              <span className="text-gray-500"> · {info.mediaPath}</span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => loadDir(currentPath)}
            disabled={loading}
            className="btn-secondary flex items-center gap-2 text-sm"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Actualizar
          </button>
          <button
            type="button"
            onClick={handleScan}
            disabled={scanning}
            className="btn-secondary flex items-center gap-2 text-sm"
          >
            <RefreshCw size={16} className={scanning ? 'animate-spin' : ''} />
            Escanear biblioteca
          </button>
          {!readOnly && (
            <>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="btn-primary flex items-center gap-2 text-sm"
              >
                <Upload size={16} />
                Subir archivos
              </button>
              <button
                type="button"
                onClick={() => setMkdirOpen(true)}
                className="btn-secondary flex items-center gap-2 text-sm"
              >
                <FolderPlus size={16} />
                Nueva carpeta
              </button>
            </>
          )}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={UPLOAD_ACCEPT}
        className="hidden"
        onChange={e => {
          if (e.target.files?.length) handleUploadFiles(e.target.files);
        }}
      />

      {readOnly && (
        <div className="mb-4 flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm">
          <AlertTriangle size={20} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Almacenamiento en solo lectura</p>
            <p className="text-amber-200/80 mt-1">
              El volumen está montado como <code className="text-amber-100">:ro</code> o{' '}
              <code className="text-amber-100">MEDIA_READ_ONLY=true</code>. Cambia la configuración de Docker para
              permitir subir, editar, renombrar y eliminar.
            </p>
          </div>
        </div>
      )}

      {actionMsg && (
        <div className="mb-4 p-3 rounded-lg bg-green-500/15 border border-green-500/30 text-green-300 text-sm">
          {actionMsg}
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {[
            { icon: Film, label: 'Películas', value: stats.totalMovies, color: 'text-purple-400' },
            { icon: Tv, label: 'Series', value: stats.totalSeries, color: 'text-violet-400' },
            { icon: HardDrive, label: 'Almacenamiento', value: formatBytes(stats.totalSize), color: 'text-fuchsia-400' },
            { icon: Download, label: 'Descargas activas', value: stats.activeDownloads, color: 'text-accent-glow' },
          ].map(({ icon: Icon, label, value, color }) => (
            <div
              key={label}
              className="bg-surface-card border border-purple-500/15 rounded-xl p-4 hover:border-purple-500/30 transition-colors"
            >
              <Icon size={18} className={`${color} mb-2`} />
              <p className="text-xl md:text-2xl font-bold tabular-nums">{value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      )}

      {info && (
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            type="button"
            onClick={() => navigateTo('')}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm bg-surface-card border border-purple-500/20 hover:border-purple-500/40 transition-colors"
          >
            <Home size={14} /> Raíz
          </button>
          <button
            type="button"
            onClick={() => navigateTo(info.moviesPath)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm bg-surface-card border border-purple-500/20 hover:border-purple-500/40 transition-colors"
          >
            <Film size={14} /> {info.moviesPath}
          </button>
          <button
            type="button"
            onClick={() => navigateTo(info.seriesPath)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm bg-surface-card border border-purple-500/20 hover:border-purple-500/40 transition-colors"
          >
            <Tv size={14} /> {info.seriesPath}
          </button>
        </div>
      )}

      <nav className="flex items-center flex-wrap gap-1 text-sm text-gray-400 mb-4 min-h-[28px]">
        <button type="button" onClick={() => navigateTo('')} className="hover:text-white transition-colors">
          media
        </button>
        {breadcrumbs.map((part, i) => {
          const path = breadcrumbs.slice(0, i + 1).join('/');
          return (
            <span key={path} className="flex items-center gap-1">
              <ChevronRight size={14} className="text-gray-600" />
              <button
                type="button"
                onClick={() => navigateTo(path)}
                className="hover:text-white transition-colors truncate max-w-[160px]"
              >
                {part}
              </button>
            </span>
          );
        })}
      </nav>

      {uploading && (
        <div className="mb-4 p-4 rounded-xl bg-accent/10 border border-accent/30">
          <div className="flex items-center justify-between gap-3 mb-2 text-sm">
            <span className="text-accent-glow font-medium truncate">Subiendo {uploadLabel}</span>
            <span className="text-gray-400 tabular-nums shrink-0">{uploadProgress}%</span>
          </div>
          <div className="h-2 rounded-full bg-black/40 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-accent to-accent-glow transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm mb-4">{error}</div>
      )}

      <div
        className={`bg-surface-card border rounded-2xl overflow-hidden transition-colors ${
          dragOver ? 'border-accent bg-accent/5' : 'border-purple-500/15'
        }`}
        onDragOver={e => { e.preventDefault(); if (!readOnly) setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        {!readOnly && (
          <div
            className={`px-4 py-6 border-b border-purple-500/10 text-center transition-colors ${
              dragOver ? 'bg-accent/10' : 'bg-surface/40'
            }`}
          >
            <Upload size={28} className={`mx-auto mb-2 ${dragOver ? 'text-accent-glow' : 'text-gray-500'}`} />
            <p className="text-sm text-gray-400">
              Arrastra películas, episodios o subtítulos aquí
            </p>
            <p className="text-xs text-gray-600 mt-1">
              MKV, MP4, AVI, MOV, SRT, VTT… · carpeta: {currentPath || '(raíz)'}
            </p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="mt-3 text-sm text-accent-glow hover:text-accent underline-offset-2 hover:underline disabled:opacity-50"
            >
              o selecciona archivos
            </button>
          </div>
        )}

        {currentPath && (
          <button
            type="button"
            onClick={goUp}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-400 hover:bg-surface-hover border-b border-purple-500/10 transition-colors"
          >
            <Folder size={18} className="text-gray-500" />
            ..
          </button>
        )}

        {loading ? (
          <div className="p-12 text-center text-gray-500">
            <RefreshCw size={24} className="animate-spin mx-auto mb-2" />
            Cargando...
          </div>
        ) : entries.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            {readOnly ? 'Carpeta vacía' : 'Carpeta vacía — sube archivos con el botón de arriba'}
          </div>
        ) : (
          <ul className="divide-y divide-purple-500/10">
            {entries.map(entry => (
              <li
                key={entry.path}
                className="flex items-center gap-3 px-4 py-3 hover:bg-surface-hover/50 group transition-colors"
              >
                <button
                  type="button"
                  onClick={() => entry.type === 'directory' && navigateTo(entry.path)}
                  className={`flex-1 flex items-center gap-3 min-w-0 text-left ${
                    entry.type === 'directory' ? 'cursor-pointer' : 'cursor-default'
                  }`}
                >
                  <EntryIcon entry={entry} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{entry.name}</p>
                    <p className="text-xs text-gray-500">
                      {entry.type === 'file' ? formatBytes(entry.size) : 'Carpeta'} · {formatModified(entry.modified)}
                    </p>
                  </div>
                </button>

                {!readOnly && (
                  <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={() => {
                        setRenameTarget(entry);
                        setRenameName(entry.name);
                      }}
                      className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-surface-hover"
                      title="Renombrar"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(entry)}
                      className="p-2 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10"
                      title="Eliminar"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <Modal open={mkdirOpen} onClose={() => setMkdirOpen(false)} title="Nueva carpeta">
        <form onSubmit={handleMkdir} className="space-y-4">
          <p className="text-sm text-gray-400">
            Se creará dentro de: <span className="text-gray-300">{currentPath || '(raíz)'}</span>
          </p>
          <input
            type="text"
            value={newFolderName}
            onChange={e => setNewFolderName(e.target.value)}
            placeholder="Nombre de la carpeta"
            className="w-full bg-surface border border-surface-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-accent"
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setMkdirOpen(false)} className="btn-secondary">
              Cancelar
            </button>
            <button type="submit" disabled={mkdirLoading || !newFolderName.trim()} className="btn-primary">
              {mkdirLoading ? 'Creando...' : 'Crear'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={!!renameTarget} onClose={() => setRenameTarget(null)} title="Renombrar">
        <form onSubmit={handleRename} className="space-y-4">
          <input
            type="text"
            value={renameName}
            onChange={e => setRenameName(e.target.value)}
            className="w-full bg-surface border border-surface-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-accent"
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setRenameTarget(null)} className="btn-secondary">
              Cancelar
            </button>
            <button type="submit" disabled={renameLoading || !renameName.trim()} className="btn-primary">
              {renameLoading ? 'Guardando...' : 'Renombrar'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Confirmar eliminación">
        <p className="text-gray-300 mb-2">
          ¿Eliminar{' '}
          <strong>{deleteTarget?.type === 'directory' ? 'la carpeta' : 'el archivo'}</strong>{' '}
          <span className="text-white">{deleteTarget?.name}</span>?
        </p>
        {deleteTarget?.type === 'directory' && (
          <p className="text-sm text-amber-300/90 mb-4">
            Se borrarán todos los archivos dentro. Esta acción no se puede deshacer.
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setDeleteTarget(null)} className="btn-secondary">
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleteLoading}
            className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-medium transition-colors disabled:opacity-50"
          >
            {deleteLoading ? 'Eliminando...' : 'Eliminar'}
          </button>
        </div>
      </Modal>

      <ScanProgressModal
        open={scanProgress.open}
        status={scanProgress.status}
        onClose={handleScanClose}
      />
    </div>
  );
}
