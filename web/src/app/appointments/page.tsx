'use client';

// Appointments list — the backend scopes results by role (patient→own,
// doctor→own, staff/admin→all), so this one screen serves every role. Columns
// adapt slightly to who is looking.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Guard } from '@/components/Guard';
import {
  PageHeader,
  ErrorNotice,
  Spinner,
  EmptyState,
  AppointmentStatusBadge,
} from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import type { AppointmentStatus, AppointmentView } from '@/lib/types';
import { formatDateTime } from '@/lib/format';
import { embeddedName } from '@/lib/participants';

const STATUSES: AppointmentStatus[] = [
  'scheduled',
  'in_progress',
  'completed',
  'cancelled',
];

function AppointmentsInner() {
  const { role } = useAuth();
  const [appointments, setAppointments] = useState<AppointmentView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<AppointmentStatus | ''>('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.appointments(statusFilter || undefined);
      setAppointments(res.appointments);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Failed to load appointments.',
      );
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const showPatient = role !== 'patient';
  const showDoctor = role !== 'doctor';

  const heading =
    role === 'patient'
      ? 'My Appointments'
      : role === 'doctor'
        ? 'My Consults'
        : 'Appointments';

  return (
    <>
      <PageHeader
        title={heading}
        subtitle={
          role === 'staff' || role === 'admin'
            ? 'All appointments across clinics.'
            : 'Your scheduled and past consults.'
        }
        actions={
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as AppointmentStatus | '')}
            style={{ width: 190 }}
          >
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace('_', ' ')}
              </option>
            ))}
          </select>
        }
      />

      {error ? <ErrorNotice message={error} /> : null}

      {loading ? (
        <Spinner />
      ) : appointments.length === 0 ? (
        <EmptyState>
          No appointments{statusFilter ? ` with status “${statusFilter}”` : ''}.
        </EmptyState>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>When</th>
                {showPatient ? <th>Patient</th> : null}
                {showDoctor ? <th>Doctor</th> : null}
                <th>Reason</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {appointments.map((a) => (
                <tr key={a.id}>
                  <td>{formatDateTime(a.startsAt)}</td>
                  {showPatient ? <td>{embeddedName(a.patient)}</td> : null}
                  {showDoctor ? <td>{embeddedName(a.doctor)}</td> : null}
                  <td className="muted" style={{ maxWidth: 280 }}>
                    {a.reason}
                  </td>
                  <td>
                    <AppointmentStatusBadge status={a.status} />
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <Link className="btn btn-secondary btn-sm" href={`/appointments/${a.id}`}>
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export default function AppointmentsPage() {
  return (
    <Guard roles={['patient', 'doctor', 'staff', 'admin']}>
      <AppointmentsInner />
    </Guard>
  );
}
