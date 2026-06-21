import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, setAuthToken, getAuthToken } from '../api';

interface AuthState {
  username: string | null;
  enabled: boolean;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [username, setUsername] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.authMe()
      .then((info: { enabled: boolean; username: string; authenticated?: boolean }) => {
        setEnabled(info.enabled);
        if (!info.enabled || info.authenticated) {
          setUsername(info.username);
        }
      })
      .catch(() => {
        if (getAuthToken()) setAuthToken(null);
      })
      .finally(() => setLoading(false));
  }, []);

  async function login(user: string, pass: string) {
    const res = await api.login(user, pass);
    setAuthToken(res.token);
    setUsername(res.username);
  }

  function logout() {
    setAuthToken(null);
    setUsername(null);
  }

  return (
    <AuthContext.Provider value={{ username, enabled, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
