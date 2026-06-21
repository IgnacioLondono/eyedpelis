import { useState } from 'react';
import { LogIn, Eye } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface p-4 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-transparent to-transparent pointer-events-none" />
      <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-purple-600/10 rounded-full blur-3xl animate-pulse-glow pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-48 h-48 bg-violet-600/10 rounded-full blur-3xl animate-float pointer-events-none" />

      <div className="w-full max-w-md relative animate-scale-in">
        <div className="text-center mb-8 animate-fade-in-down">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-accent/15 rounded-2xl mb-4 shadow-purple border border-purple-500/20 animate-pulse-glow">
            <Eye size={32} className="text-accent animate-float" />
          </div>
          <h1 className="text-3xl font-extrabold brand-text">Eyedpelis</h1>
          <p className="text-gray-400 mt-2">Inicia sesión para acceder a tu biblioteca</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-surface-card border border-purple-500/15 rounded-2xl p-8 space-y-5 shadow-purple-lg animate-fade-in-up"
          style={{ animationDelay: '150ms' }}
        >
          {error && (
            <div className="bg-red-500/15 border border-red-500/30 text-red-400 rounded-lg px-4 py-3 text-sm animate-fade-in">
              {error}
            </div>
          )}

          <div className="animate-fade-in-up" style={{ animationDelay: '250ms' }}>
            <label className="text-sm text-gray-400 block mb-1">Usuario</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="w-full bg-surface border border-surface-border rounded-lg px-4 py-3 focus:outline-none focus:border-accent input-field"
              autoFocus
              required
            />
          </div>

          <div className="animate-fade-in-up" style={{ animationDelay: '350ms' }}>
            <label className="text-sm text-gray-400 block mb-1">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-surface border border-surface-border rounded-lg px-4 py-3 focus:outline-none focus:border-accent input-field"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full flex items-center justify-center gap-2 py-3 animate-fade-in-up"
            style={{ animationDelay: '450ms' }}
          >
            <LogIn size={18} className={loading ? 'animate-spin' : ''} />
            {loading ? 'Entrando...' : 'Entrar'}
          </button>

          <p className="text-xs text-gray-500 text-center animate-fade-in" style={{ animationDelay: '550ms' }}>
            Usuario: eyedpelis
          </p>
        </form>
      </div>
    </div>
  );
}
