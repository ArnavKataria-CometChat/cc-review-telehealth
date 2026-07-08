'use client';

// Email + password login. On success the backend returns a session JWT carrying
// { userId, role }; the auth context persists it and we route to the role home.
// Demo-account chips mirror the backend seed so the app is usable immediately.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ROLE_HOME, useAuth } from '@/lib/auth-context';
import { ApiError } from '@/lib/api';
import type { Role } from '@/lib/types';
import { ROLE_LABEL } from '@/lib/format';

const DEMO_ACCOUNTS: { role: Role; email: string }[] = [
  { role: 'admin', email: 'admin@telehealth.test' },
  { role: 'staff', email: 'staff@telehealth.test' },
  { role: 'doctor', email: 'house@telehealth.test' },
  { role: 'patient', email: 'patient@telehealth.test' },
];

// Matches the backend SEED_PASSWORD default (documented; overridable in env).
const DEMO_PASSWORD = 'Passw0rd!';

export default function LoginPage() {
  const { status, role, login } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Already signed in? Bounce to the role home.
  useEffect(() => {
    if (status === 'authenticated' && role) {
      router.replace(ROLE_HOME[role]);
    }
  }, [status, role, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const user = await login(email.trim(), password);
      router.replace(ROLE_HOME[user.role]);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'Login failed. Please try again.';
      setError(message);
      setSubmitting(false);
    }
  }

  function useDemo(demoEmail: string) {
    setEmail(demoEmail);
    setPassword(DEMO_PASSWORD);
    setError(null);
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="brand-mark" aria-hidden>
            ✚
          </span>
          TeleHealth
        </div>
        <p className="auth-sub">Sign in to your consult portal</p>

        <form onSubmit={onSubmit}>
          <label className="field">
            <span className="field-label">Email</span>
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@telehealth.test"
              required
            />
          </label>

          <label className="field">
            <span className="field-label">Password</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>

          {error ? (
            <div className="notice notice-error" role="alert" style={{ marginBottom: 16 }}>
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            className="btn btn-primary btn-block"
            disabled={submitting}
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <details className="demo-accounts">
          <summary>Demo accounts</summary>
          <div className="demo-grid">
            {DEMO_ACCOUNTS.map((a) => (
              <button
                key={a.email}
                type="button"
                className="demo-chip"
                onClick={() => useDemo(a.email)}
              >
                <span className={`role-pill role-${a.role}`}>
                  {ROLE_LABEL[a.role]}
                </span>
                <span className="mono">{a.email}</span>
              </button>
            ))}
          </div>
          <p className="faint" style={{ marginTop: 10 }}>
            Password for all demo accounts: <span className="mono">{DEMO_PASSWORD}</span>{' '}
            (the backend <span className="mono">SEED_PASSWORD</span>).
          </p>
        </details>
      </div>
    </div>
  );
}
