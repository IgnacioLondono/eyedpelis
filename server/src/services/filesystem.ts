import fs from 'fs';
import path from 'path';
import { getSettings } from '../config.js';

const VIDEO_EXT = new Set(['.mkv', '.mp4', '.avi', '.mov', '.wmv', '.m4v', '.webm', '.ts', '.m2ts']);
const SUB_EXT = new Set(['.srt', '.vtt', '.ass', '.ssa']);

export interface FileEntry {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size: number;
  modified: string;
  extension: string | null;
  category: 'video' | 'subtitle' | 'other';
}

export function getMediaRoot(): string {
  return path.resolve(getSettings().media_path);
}

export function isMediaReadOnly(): boolean {
  return process.env.MEDIA_READ_ONLY === 'true';
}

/** Resuelve ruta relativa dentro de media_path; bloquea path traversal. */
export function resolveMediaPath(relativePath = ''): string {
  const root = getMediaRoot();
  const normalized = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
  const target = path.resolve(root, normalized || '.');

  if (target !== root && !target.startsWith(root + path.sep)) {
    throw new Error('Ruta no permitida');
  }
  return target;
}

export function toRelativePath(absolutePath: string): string {
  const root = getMediaRoot();
  const rel = path.relative(root, absolutePath).replace(/\\/g, '/');
  return rel === '' ? '' : rel;
}

function categorize(ext: string | null): FileEntry['category'] {
  if (!ext) return 'other';
  const e = ext.toLowerCase();
  if (VIDEO_EXT.has(e)) return 'video';
  if (SUB_EXT.has(e)) return 'subtitle';
  return 'other';
}

export function listDirectory(relativePath = ''): { path: string; entries: FileEntry[] } {
  const dir = resolveMediaPath(relativePath);
  if (!fs.existsSync(dir)) throw new Error('Carpeta no encontrada');
  if (!fs.statSync(dir).isDirectory()) throw new Error('No es una carpeta');

  const entries: FileEntry[] = [];
  for (const name of fs.readdirSync(dir)) {
    if (name.startsWith('.')) continue;
    const full = path.join(dir, name);
    let stat: fs.Stats;
    try {
      stat = fs.statSync(full);
    } catch {
      continue;
    }
    const ext = stat.isFile() ? path.extname(name) : null;
    entries.push({
      name,
      path: toRelativePath(full),
      type: stat.isDirectory() ? 'directory' : 'file',
      size: stat.isFile() ? stat.size : 0,
      modified: stat.mtime.toISOString(),
      extension: ext || null,
      category: stat.isDirectory() ? 'other' : categorize(ext),
    });
  }

  entries.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
    return a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });
  });

  return { path: relativePath.replace(/\\/g, '/'), entries };
}

export function createDirectory(relativePath: string, name: string): FileEntry {
  if (isMediaReadOnly()) throw new Error('Almacenamiento en solo lectura');
  const safeName = sanitizeName(name);
  const parent = resolveMediaPath(relativePath);
  const full = path.join(parent, safeName);
  if (fs.existsSync(full)) throw new Error('Ya existe');
  fs.mkdirSync(full, { recursive: false });
  const stat = fs.statSync(full);
  return {
    name: safeName,
    path: toRelativePath(full),
    type: 'directory',
    size: 0,
    modified: stat.mtime.toISOString(),
    extension: null,
    category: 'other',
  };
}

export function renameEntry(relativePath: string, newName: string): FileEntry {
  if (isMediaReadOnly()) throw new Error('Almacenamiento en solo lectura');
  const safeName = sanitizeName(newName);
  const full = resolveMediaPath(relativePath);
  if (!fs.existsSync(full)) throw new Error('No encontrado');
  const parent = path.dirname(full);
  const dest = path.join(parent, safeName);
  if (fs.existsSync(dest)) throw new Error('Ya existe un archivo con ese nombre');
  fs.renameSync(full, dest);
  const stat = fs.statSync(dest);
  const ext = stat.isFile() ? path.extname(safeName) : null;
  return {
    name: safeName,
    path: toRelativePath(dest),
    type: stat.isDirectory() ? 'directory' : 'file',
    size: stat.isFile() ? stat.size : 0,
    modified: stat.mtime.toISOString(),
    extension: ext,
    category: stat.isDirectory() ? 'other' : categorize(ext),
  };
}

export function deleteEntry(relativePath: string): void {
  if (isMediaReadOnly()) throw new Error('Almacenamiento en solo lectura');
  const full = resolveMediaPath(relativePath);
  if (!fs.existsSync(full)) throw new Error('No encontrado');
  const root = getMediaRoot();
  if (full === root) throw new Error('No se puede eliminar la raíz');

  const stat = fs.statSync(full);
  if (stat.isDirectory()) {
    fs.rmSync(full, { recursive: true, force: true });
  } else {
    fs.unlinkSync(full);
  }
}

function sanitizeName(name: string): string {
  const trimmed = name.trim().replace(/[/\\<>:"|?*\x00-\x1f]/g, '');
  if (!trimmed || trimmed === '.' || trimmed === '..') {
    throw new Error('Nombre no válido');
  }
  return trimmed;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
