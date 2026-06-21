import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import { getSetting, setSetting } from '../db/database.js';

const JWT_SECRET = process.env.JWT_SECRET || 'peliculas-web-secret-change-me';
const TOKEN_EXPIRY = '7d';

export interface AuthPayload {
  username: string;
}

export async function initAuth() {
  const hash = getSetting('auth_password_hash');
  if (!hash) {
    const defaultHash = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'admin', 10);
    setSetting('auth_username', process.env.ADMIN_USER || 'admin');
    setSetting('auth_password_hash', defaultHash);
    setSetting('auth_enabled', process.env.AUTH_ENABLED ?? 'true');
    console.log('🔐 Usuario por defecto: admin / admin (cámbialo en Configuración)');
  }
}

export function isAuthEnabled(): boolean {
  return getSetting('auth_enabled') !== 'false';
}

export async function login(username: string, password: string): Promise<string | null> {
  const storedUser = getSetting('auth_username') || 'admin';
  const storedHash = getSetting('auth_password_hash');
  if (!storedHash || username !== storedUser) return null;
  const valid = await bcrypt.compare(password, storedHash);
  if (!valid) return null;
  return jwt.sign({ username } as AuthPayload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

export async function changePassword(current: string, newPass: string): Promise<boolean> {
  const hash = getSetting('auth_password_hash');
  if (!hash) return false;
  const valid = await bcrypt.compare(current, hash);
  if (!valid) return false;
  const newHash = await bcrypt.hash(newPass, 10);
  setSetting('auth_password_hash', newHash);
  return true;
}

export function verifyToken(token: string): AuthPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthPayload;
  } catch {
    return null;
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!isAuthEnabled()) return next();

  const url = req.originalUrl.split('?')[0];

  // Solo proteger la API — la web (HTML/JS/CSS) debe cargar sin token
  if (!url.startsWith('/api')) return next();

  if (url === '/api/auth/login' || url === '/api/auth/me' || url === '/api/health') return next();

  const header = req.headers.authorization;
  const queryToken = req.query.token as string | undefined;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : queryToken;

  if (!token) return res.status(401).json({ error: 'No autenticado' });

  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ error: 'Token inválido o expirado' });

  (req as Request & { user?: AuthPayload }).user = payload;
  next();
}

export function getAuthInfo() {
  return {
    enabled: isAuthEnabled(),
    username: getSetting('auth_username') || 'admin',
  };
}
