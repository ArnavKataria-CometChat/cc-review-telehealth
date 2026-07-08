'use client';

// Doctor "My Schedule" — the doctor's own appointments (backend scopes the list
// to the treating doctor), grouped by day, plus a derived roster of assigned
// patients. Each row opens the appointment detail where consults are run.

import { useEffect, useMemo, useState } from 'react';
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
import type { AppointmentView } from '@/lib/types';
import { dayKey, formatTime } from '@/lib/format';
import { embeddedName } from '@/lib/participants';

function ScheduleInner() {
  const [appts, setAppts] = useState<AppointmentView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .appointments()
      .then((res) => setAppts(res.appointments))
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : 'Failed to load schedule.'),
      )
      .finally(() => setLoading(false));
  }, []);

  // Group upcoming/active appointments by day (skip cancelled in the day view).
  const days = useMemo(() => {
    const groups = new Map<string, AppointmentView[]>();
    const sorted = [...appts]
      .filter((a) => a.status !== 'cancelled' && a.startsAt)
      .sort((a, b) => (a.startsAt ?? '').localeCompare(b.startsAt ?? ''));
    for (const a of sorted) {
      const key = a.startsAt ? dayKey(a.startsAt) : 'Unscheduled';
      const list = groups.get(key) ?? [];
      list.push(a);
      groups.set(key, list);
    }
    return [...groups.entries()];
  }, [appts]);

  // Distinct patients across all this doctor's appointments.
  const patients = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of appts) {
      map.set(a.patient.userId, embeddedName(a.patient));
    }
    return [...map.entries()];
  }, [appts]);

  if (loading) return <Spinner />;
  if (error) return <ErrorNotice message={error} />;

  return (
    <>
      <PageHeader
        title="My Schedule"
        subtitle="Your upcoming consults, grouped by day."
      />

      <div className="grid grid-2">
        <div className="stack">
          {days.length === 0 ? (
            <EmptyState>No upcoming appointments.</EmptyState>
          ) : (
            days.map(([day, list]) => (
              <div key={day} className="card">
                <h2 className="section-title">{day}</h2>
                <ul className="list-reset stack" style={{ gap: 8 }}>
                  {list.map((a) => (
                    <li key={a.id}>
                      <Link
                        href={`/appointments/${a.id}`}
                        className="row spread"
                        style={{
                          padding: '10px 12px',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-sm)',
                        }}
                      >
                        <span className="row" style={{ gap: 12 }}>
                          <strong className="mono">{formatTime(a.startsAt)}</strong>
                          <span>{embeddedName(a.patient)}</span>
                        </span>
                        <AppointmentStatusBadge status={a.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>

        <div className="stack">
          <div className="card">
            <h2 className="section-title">My Patients</h2>
            {patients.length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>
                No assigned patients yet.
              </p>
            ) : (
              <ul className="list-reset stack" style={{ gap: 8 }}>
                {patients.map(([uid, name]) => (
                  <li key={uid} className="row" style={{ gap: 10 }}>
                    <span
                      aria-hidden
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: '50%',
                        background: 'var(--primary-light)',
                        color: 'var(--primary-dark)',
                        display: 'grid',
                        placeItems: 'center',
                        fontWeight: 700,
                        fontSize: 13,
                      }}
                    >
                      {name.charAt(0)}
                    </span>
                    <span>{name}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default function SchedulePage() {
  return (
    <Guard roles={['doctor']}>
      <ScheduleInner />
    </Guard>
  );
}
