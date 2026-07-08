'use client';

// Top-level chrome: brand header, role-filtered navigation, and the signed-in
// user badge with sign-out. The nav only renders links the current role may use
// — matching the backend's per-route RBAC.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import type { Role } from '@/lib/types';
import { ROLE_LABEL } from '@/lib/format';

interface NavItem {
  href: string;
  label: string;
  roles: Role[];
}

const NAV: NavItem[] = [
  { href: '/doctors', label: 'Find a Doctor', roles: ['patient'] },
  { href: '/appointments', label: 'My Appointments', roles: ['patient'] },
  { href: '/schedule', label: 'My Schedule', roles: ['doctor'] },
  { href: '/appointments', label: 'Consults', roles: ['doctor'] },
  { href: '/slots', label: 'Slot Manager', roles: ['staff'] },
  { href: '/appointments', label: 'Appointments', roles: ['staff'] },
  { href: '/admin', label: 'Clinics & Users', roles: ['admin'] },
  { href: '/appointments', label: 'Appointments', roles: ['admin'] },
  { href: '/admin/audit', label: 'Audit Log', roles: ['admin'] },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, role, status, logout } = useAuth();
  const pathname = usePathname();

  // The login screen renders without chrome.
  if (status !== 'authenticated' || !user || !role) {
    return <main className="bare-main">{children}</main>;
  }

  const items = NAV.filter((n) => n.roles.includes(role));

  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-inner">
          <Link href="/" className="brand">
            <span className="brand-mark" aria-hidden>
              ✚
            </span>
            <span className="brand-text">TeleHealth</span>
          </Link>

          <nav className="nav" aria-label="Primary">
            {items.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== '/' && pathname.startsWith(`${item.href}/`));
              return (
                <Link
                  key={`${item.href}:${item.label}`}
                  href={item.href}
                  className={active ? 'nav-link active' : 'nav-link'}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="user-badge">
            <div className="user-meta">
              <span className="user-name">{user.name}</span>
              <span className={`role-pill role-${role}`}>{ROLE_LABEL[role]}</span>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={logout}>
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="content">{children}</main>
    </div>
  );
}
