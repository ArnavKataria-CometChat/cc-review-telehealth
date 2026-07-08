'use client';

// App root: route the signed-in user to their role's home, or to /login.

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ROLE_HOME, useAuth } from '@/lib/auth-context';
import { Spinner } from '@/components/ui';

export default function HomePage() {
  const { status, role } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === 'anonymous') {
      router.replace('/login');
    } else if (status === 'authenticated' && role) {
      router.replace(ROLE_HOME[role]);
    }
  }, [status, role, router]);

  return (
    <div className="center-screen">
      <Spinner label="Loading" />
    </div>
  );
}
