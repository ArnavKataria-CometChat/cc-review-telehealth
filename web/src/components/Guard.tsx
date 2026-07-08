'use client';

// Client-side route guard. Wrap any protected page's content in <Guard>.
// - not signed in  -> redirect to /login (preserving intent is out of scope here)
// - wrong role     -> render an inline "no access" panel (defence in depth: the
//                     backend also enforces RBAC on every route)

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import type { Role } from '@/lib/types';
import { ROLE_LABEL } from '@/lib/format';

export function Guard({
  roles,
  children,
}: {
  roles?: Role[];
  children: React.ReactNode;
}) {
  const { status, role } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === 'anonymous') {
      router.replace('/login');
    }
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div className="center-screen">
        <div className="spinner" aria-label="Loading" />
      </div>
    );
  }

  if (status === 'anonymous') {
    return (
      <div className="center-screen">
        <div className="spinner" aria-label="Redirecting" />
      </div>
    );
  }

  if (roles && role && !roles.includes(role)) {
    return (
      <div className="card notice notice-error" role="alert">
        <h2>No access</h2>
        <p>
          This area is restricted to{' '}
          <strong>{roles.map((r) => ROLE_LABEL[r]).join(', ')}</strong>. You are
          signed in as <strong>{ROLE_LABEL[role]}</strong>.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
