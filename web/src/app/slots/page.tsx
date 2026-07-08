'use client';

// Staff "Slot Manager" — pick a doctor, review their schedule, create new open
// slots, and open/close existing ones (PATCH /slots/:id). Reassigning a booked
// appointment happens on the appointment detail screen (staff/admin only).

import { useCallback, useEffect, useState } from 'react';
import { Guard } from '@/components/Guard';
import {
  PageHeader,
  ErrorNotice,
  Spinner,
  EmptyState,
  SlotStatusBadge,
  Field,
} from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import type { DoctorView, SlotView } from '@/lib/types';
import { formatDateTime } from '@/lib/format';

function SlotsInner() {
  const [doctors, setDoctors] = useState<DoctorView[]>([]);
  const [doctorId, setDoctorId] = useState('');
  const [slots, setSlots] = useState<SlotView[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .doctors()
      .then((res) => {
        setDoctors(res.doctors);
        if (res.doctors.length > 0) setDoctorId(res.doctors[0]!.userId);
      })
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : 'Failed to load doctors.'),
      );
  }, []);

  const loadSlots = useCallback(async (id: string) => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.doctorSlots(id);
      setSlots(res.slots);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load slots.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (doctorId) void loadSlots(doctorId);
  }, [doctorId, loadSlots]);

  async function toggleSlot(slot: SlotView) {
    setError(null);
    try {
      const next = slot.status === 'open' ? 'booked' : 'open';
      await api.setSlotStatus(slot.id, next);
      await loadSlots(doctorId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update slot.');
    }
  }

  const selectedDoctor = doctors.find((d) => d.userId === doctorId);

  return (
    <>
      <PageHeader
        title="Slot Manager"
        subtitle="Create and manage doctor schedule slots."
      />

      <div className="card" style={{ marginBottom: 20 }}>
        <Field label="Doctor" hint="Choose whose schedule to manage.">
          <select value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
            {doctors.length === 0 ? <option value="">No doctors</option> : null}
            {doctors.map((d) => (
              <option key={d.userId} value={d.userId}>
                {d.name} · {d.specialty}
                {d.clinicName ? ` · ${d.clinicName}` : ''}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {error ? <ErrorNotice message={error} /> : null}

      {selectedDoctor ? (
        <div className="grid grid-2">
          <NewSlotForm
            doctorId={selectedDoctor.userId}
            onCreated={() => loadSlots(selectedDoctor.userId)}
          />

          <div className="card">
            <h2 className="section-title">
              Slots for {selectedDoctor.name}
            </h2>
            {loading ? (
              <Spinner />
            ) : slots.length === 0 ? (
              <EmptyState>No slots yet — create one on the left.</EmptyState>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Starts</th>
                      <th>Duration</th>
                      <th>Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {slots.map((s) => (
                      <tr key={s.id}>
                        <td>{formatDateTime(s.startsAt)}</td>
                        <td>{s.durationMin} min</td>
                        <td>
                          <SlotStatusBadge status={s.status} />
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => toggleSlot(s)}
                          >
                            {s.status === 'open' ? 'Close' : 'Reopen'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}

function NewSlotForm({
  doctorId,
  onCreated,
}: {
  doctorId: string;
  onCreated: () => void;
}) {
  const [startsAt, setStartsAt] = useState('');
  const [durationMin, setDurationMin] = useState(30);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!startsAt) return;
    setSaving(true);
    setErr(null);
    setOk(null);
    try {
      // `datetime-local` has no timezone; normalise to an ISO instant (UTC Z),
      // which is what the backend's ISO-datetime validator expects.
      const iso = new Date(startsAt).toISOString();
      await api.createSlot(doctorId, iso, durationMin);
      setOk('Slot created.');
      setStartsAt('');
      onCreated();
    } catch (error) {
      setErr(error instanceof ApiError ? error.message : 'Could not create slot.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card">
      <h2 className="section-title">New slot</h2>
      <form onSubmit={submit} className="stack" style={{ gap: 4 }}>
        <Field label="Starts at">
          <input
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            required
          />
        </Field>
        <Field label="Duration (minutes)">
          <input
            type="number"
            min={5}
            max={240}
            step={5}
            value={durationMin}
            onChange={(e) => setDurationMin(Number(e.target.value))}
            required
          />
        </Field>
        {err ? <ErrorNotice message={err} /> : null}
        {ok ? <div className="notice notice-success">{ok}</div> : null}
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Creating…' : 'Create slot'}
        </button>
      </form>
    </div>
  );
}

export default function SlotsPage() {
  return (
    <Guard roles={['staff', 'admin']}>
      <SlotsInner />
    </Guard>
  );
}
