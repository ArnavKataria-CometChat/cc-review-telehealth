'use client';

// Patient flow — browse doctors (filter by specialty / clinic), inspect a
// doctor's open slots, and book a consult (reason + slot). Booking hits
// POST /appointments; the backend flips the slot to "booked" atomically.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Guard } from '@/components/Guard';
import { PageHeader, ErrorNotice, Spinner, EmptyState, Field } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import type { DoctorView, SlotView } from '@/lib/types';
import { formatDateTime } from '@/lib/format';

function DoctorsInner() {
  const router = useRouter();
  const [doctors, setDoctors] = useState<DoctorView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [specialty, setSpecialty] = useState('');
  const [clinicId, setClinicId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.doctors({
        specialty: specialty.trim() || undefined,
        clinicId: clinicId || undefined,
      });
      setDoctors(res.doctors);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load doctors.');
    } finally {
      setLoading(false);
    }
  }, [specialty, clinicId]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Clinic filter options are derived from the loaded doctors (the /clinics
  // endpoint is admin-only, so patients discover clinics via their doctors).
  const clinicOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of doctors) {
      if (d.clinicId) map.set(d.clinicId, d.clinicName ?? d.clinicId);
    }
    return [...map.entries()];
  }, [doctors]);

  return (
    <>
      <PageHeader
        title="Find a Doctor"
        subtitle="Browse available doctors and book a video consult."
      />

      <div className="card" style={{ marginBottom: 20 }}>
        <form
          className="form-row"
          onSubmit={(e) => {
            e.preventDefault();
            void load();
          }}
        >
          <Field label="Specialty">
            <input
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
              placeholder="e.g. Diagnostics"
            />
          </Field>
          <Field label="Clinic">
            <select value={clinicId} onChange={(e) => setClinicId(e.target.value)}>
              <option value="">All clinics</option>
              {clinicOptions.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </Field>
          <div className="row">
            <button type="submit" className="btn btn-primary">
              Search
            </button>
            {(specialty || clinicId) && (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setSpecialty('');
                  setClinicId('');
                  // Reload with cleared filters on next tick.
                  setTimeout(() => void load(), 0);
                }}
              >
                Clear
              </button>
            )}
          </div>
        </form>
      </div>

      {error ? <ErrorNotice message={error} /> : null}

      {loading ? (
        <Spinner />
      ) : doctors.length === 0 ? (
        <EmptyState>No doctors match your search.</EmptyState>
      ) : (
        <div className="grid grid-cards">
          {doctors.map((d) => (
            <DoctorCard key={d.userId} doctor={d} onBooked={() => router.push('/appointments')} />
          ))}
        </div>
      )}
    </>
  );
}

function DoctorCard({
  doctor,
  onBooked,
}: {
  doctor: DoctorView;
  onBooked: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [slots, setSlots] = useState<SlotView[] | null>(null);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string>('');
  const [reason, setReason] = useState('');
  const [booking, setBooking] = useState(false);
  const [bookError, setBookError] = useState<string | null>(null);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && slots === null) {
      setSlotsError(null);
      try {
        const res = await api.doctorSlots(doctor.userId, 'open');
        setSlots(res.slots);
      } catch (err) {
        setSlotsError(
          err instanceof ApiError ? err.message : 'Could not load slots.',
        );
      }
    }
  }

  async function book(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSlot || !reason.trim()) return;
    setBooking(true);
    setBookError(null);
    try {
      await api.bookAppointment({
        doctorId: doctor.userId,
        slotId: selectedSlot,
        reason: reason.trim(),
      });
      onBooked();
    } catch (err) {
      setBookError(err instanceof ApiError ? err.message : 'Booking failed.');
      setBooking(false);
    }
  }

  return (
    <div className="card stack" style={{ gap: 12 }}>
      <div>
        <h3 style={{ fontSize: 17 }}>{doctor.name}</h3>
        <div className="row" style={{ gap: 8, marginTop: 6 }}>
          <span className="tag">{doctor.specialty}</span>
          {doctor.clinicName ? <span className="tag">{doctor.clinicName}</span> : null}
        </div>
      </div>

      <button className="btn btn-secondary btn-sm" onClick={toggle}>
        {open ? 'Hide slots' : 'View open slots'}
      </button>

      {open ? (
        <div className="stack" style={{ gap: 12 }}>
          {slotsError ? <ErrorNotice message={slotsError} /> : null}
          {slots === null ? (
            <Spinner />
          ) : slots.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>
              No open slots right now.
            </p>
          ) : (
            <form className="stack" style={{ gap: 12 }} onSubmit={book}>
              <Field label="Choose a slot">
                <select
                  value={selectedSlot}
                  onChange={(e) => setSelectedSlot(e.target.value)}
                  required
                >
                  <option value="">Select a time…</option>
                  {slots.map((s) => (
                    <option key={s.id} value={s.id}>
                      {formatDateTime(s.startsAt)} · {s.durationMin} min
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Reason for visit">
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Briefly describe your symptoms or reason"
                  maxLength={500}
                  required
                />
              </Field>
              {bookError ? <ErrorNotice message={bookError} /> : null}
              <button
                type="submit"
                className="btn btn-primary"
                disabled={booking || !selectedSlot || !reason.trim()}
              >
                {booking ? 'Booking…' : 'Book consult'}
              </button>
            </form>
          )}
        </div>
      ) : null}
    </div>
  );
}

export default function DoctorsPage() {
  return (
    <Guard roles={['patient']}>
      <DoctorsInner />
    </Guard>
  );
}
