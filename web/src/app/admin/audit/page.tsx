'use client';

// Admin audit log — the append-only trail of every mutating action (logins,
// bookings, status changes, notes authored, slot/clinic/user CRUD). Read-only.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Guard } from '@/components/Guard';
import { PageHeader, ErrorNotice, Spinner, EmptyState } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import type { AuditEntry } from '@/lib/types';
import { formatDateTime, ROLE_LABEL } from '@/lib/format';

function AuditInner() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .audit(300)
      .then((res) => setEntries(res.entries))
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : 'Failed to load audit log.'),
      )
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <PageHeader
        title="Audit Log"
        subtitle="Append-only record of platform activity."
        actions={
          <Link className="btn btn-ghost" href="/admin">
            ← Back to admin
          </Link>
        }
      />

      {error ? <ErrorNotice message={error} /> : null}

      {loading ? (
        <Spinner />
      ) : entries.length === 0 ? (
        <EmptyState>No audit entries yet.</EmptyState>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Target</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{formatDateTime(e.at)}</td>
                  <td>
                    {e.actorRole ? (
                      <span className={`role-pill role-${e.actorRole}`}>
                        {ROLE_LABEL[e.actorRole]}
                      </span>
                    ) : (
                      <span className="faint">system</span>
                    )}
                  </td>
                  <td className="mono">{e.action}</td>
                  <td className="mono faint">{e.target}</td>
                  <td className="muted">{e.detail ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export default function AuditPage() {
  return (
    <Guard roles={['admin']}>
      <AuditInner />
    </Guard>
  );
}
