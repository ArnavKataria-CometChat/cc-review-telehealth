import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';
import { AppShell } from '@/components/AppShell';
import { CometChatGate } from '@/lib/cometchat/CometChatGate';

export const metadata: Metadata = {
  title: 'TeleHealth — Consult Platform',
  description:
    'Book and run secure video consults. Telehealth portal for patients, doctors, clinic staff, and admins.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          {/* CometChat logs in alongside the session and mounts the app-wide
              incoming-call listener; it never blocks the portal from rendering. */}
          <CometChatGate>
            <AppShell>{children}</AppShell>
          </CometChatGate>
        </AuthProvider>
      </body>
    </html>
  );
}
