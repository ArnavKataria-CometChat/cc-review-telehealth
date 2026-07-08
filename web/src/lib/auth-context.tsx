'use client';

// Client-side auth/session layer. The backend issues a JWT carrying a stable
// { userId, role }; we persist it in localStorage, feed it to the API client,
// and expose the current user + role to the component tree. Every protected
// screen consults this via <Guard> (see components/Guard.tsx).

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { api, setAuthToken, setUnauthorizedHandler } from './api';
import type { PublicUser, Role } from './types';

const STORAGE_KEY = 'telehealth.session';

type Status = 'loading' | 'authenticated' | 'anonymous';

interface StoredSession {
  token: string;
  user: PublicUser;
}

interface AuthContextValue {
  status: Status;
  user: PublicUser | null;
  role: Role | null;
  login: (email: string, password: string) => Promise<PublicUser>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readStored(): StoredSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<PublicUser | null>(null);

  const logout = useCallback(() => {
    setAuthToken(null);
    setUser(null);
    setStatus('anonymous');
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  // Restore any persisted session on first mount and validate it against the
  // backend so a revoked/expired token doesn't leave a stale UI logged in.
  useEffect(() => {
    setUnauthorizedHandler(() => logout());

    const stored = readStored();
    if (!stored) {
      setStatus('anonymous');
      return;
    }

    setAuthToken(stored.token);
    setUser(stored.user);

    let cancelled = false;
    api
      .me()
      .then((me) => {
        if (cancelled) return;
        const fresh: PublicUser = {
          id: me.id,
          role: me.role,
          name: me.name,
          email: me.email,
        };
        setUser(fresh);
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ token: stored.token, user: fresh }),
        );
        setStatus('authenticated');
      })
      .catch(() => {
        if (!cancelled) logout();
      });

    return () => {
      cancelled = true;
    };
  }, [logout]);

  const login = useCallback(async (email: string, password: string) => {
    const { token, user: loggedIn } = await api.login(email, password);
    setAuthToken(token);
    setUser(loggedIn);
    setStatus('authenticated');
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ token, user: loggedIn }),
      );
    }
    return loggedIn;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, role: user?.role ?? null, login, logout }),
    [status, user, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}

/** Where each role lands after login / when visiting the app root. */
export const ROLE_HOME: Record<Role, string> = {
  patient: '/doctors',
  doctor: '/schedule',
  staff: '/slots',
  admin: '/admin',
};
