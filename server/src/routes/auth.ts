import { Router } from 'express';
import { login, changePassword, getAuthInfo, verifyToken } from '../services/auth.js';

const router = Router();

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
  }
  const token = await login(username, password);
  if (!token) return res.status(401).json({ error: 'Credenciales incorrectas' });
  res.json({ token, username });
});

router.get('/me', (req, res) => {
  const info = getAuthInfo();
  if (!info.enabled) {
    return res.json({ ...info, authenticated: true });
  }
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.json({ ...info, authenticated: false });
  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ error: 'Token inválido o expirado' });
  res.json({ ...info, authenticated: true });
});

router.put('/password', async (req, res) => {
  const { current, newPassword } = req.body;
  if (!current || !newPassword || newPassword.length < 4) {
    return res.status(400).json({ error: 'Contraseña nueva debe tener al menos 4 caracteres' });
  }
  const ok = await changePassword(current, newPassword);
  if (!ok) return res.status(401).json({ error: 'Contraseña actual incorrecta' });
  res.json({ ok: true });
});

export default router;
