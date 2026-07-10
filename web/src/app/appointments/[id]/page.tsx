'use client';

// Appointment detail — the hub of the product and the screen CometChat plugs
// into in Phase B (1:1 chat + video between exactly this appointment's patient
// and doctor). Actions are role-scoped and mirror the backend transition rules;
// the backend remains the source of truth (every call is re-checked there).

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Guard } from '@/components/Guard';

// Browser-only: the CometChat UI Kit touches `window` at import time, so it must
// never render on the server or during `next build`'s static prerender.
const AppointmentConsult = dynamic(
  () => import('@/components/cometchat/AppointmentConsult'),
  { ssr: false, loading: () => <Spinner /> },
);
import {
  PageHeader,
  ErrorNotice,
  Spinner,
  AppointmentStatusBadge,
} from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import type {
  AppointmentStatus,
  AppointmentView,
  DoctorView,
  NoteView,
  SlotView,
} from '@/lib/types';
import { formatDateTime, formatDate } from '@/lib/format';
import { embeddedName } from '@/lib/participants';

function DetailInner() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const { user, role } = useAuth();

  const [appt, setAppt] = useState<AppointmentView | null>(null);
  const [notes, setNotes] = useState<NoteView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.appointment(id);
      setAppt(res.appointment);
      try {
        const n = await api.appointmentNotes(id);
        setNotes(n.notes);
      } catch {
        // Notes are best-effort in the detail view; ignore load failures here.
        setNotes([]);
      }
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Failed to load appointment.',
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const transition = useCallback(
    async (status: AppointmentStatus) => {
      setBusy(true);
      setActionError(null);
      try {
        const res = await api.patchAppointment(id, { status });
        setAppt(res.appointment);
      } catch (err) {
        setActionError(
          err instanceof ApiError ? err.message : 'Action failed.',
        );
      } finally {
        setBusy(false);
      }
    },
    [id],
  );

  if (loading) return <Spinner />;
  if (error) return <ErrorNotice message={error} />;
  if (!appt || !user || !role) return <ErrorNotice message="Appointment not found." />;

  const isTreatingDoctor = role === 'doctor' && appt.doctor.userId === user.id;
  const isOwningPatient = role === 'patient' && appt.patient.userId === user.id;
  const isCoordinator = role === 'staff' || role === 'admin';
  const active = appt.status === 'scheduled' || appt.status === 'in_progress';

  const canCancel =
    active &&
    (isOwningPatient || isTreatingDoctor || isCoordinator || role === 'doctor');
  const canStart = isTreatingDoctor && appt.status === 'scheduled';
  const canComplete = isTreatingDoctor && appt.status === 'in_progress';
  const canWriteNote =
    isTreatingDoctor &&
    (appt.status === 'in_progress' || appt.status === 'completed');
  const isChatParticipant = isOwningPatient || isTreatingDoctor;

  return (
    <>
      <PageHeader
        title="Appointment"
        subtitle={formatDateTime(appt.startsAt)}
        actions={
          <button className="btn btn-ghost" onClick={() => router.back()}>
            ← Back
          </button>
        }
      />

      <div className="grid grid-2">
        {/* -------- overview + participants -------- */}
        <div className="stack">
          <div className="card stack" style={{ gap: 16 }}>
            <div className="row spread">
              <h2 style={{ fontSize: 18 }}>Consult details</h2>
              <AppointmentStatusBadge status={appt.status} />
            </div>
            <dl className="kv">
              <dt>Patient</dt>
              <dd>{embeddedName(appt.patient)}</dd>
              <dt>Doctor</dt>
              <dd>{embeddedName(appt.doctor)}</dd>
              <dt>When</dt>
              <dd>{formatDateTime(appt.startsAt)}</dd>
              <dt>Duration</dt>
              <dd>{appt.durationMin ? `${appt.durationMin} min` : '—'}</dd>
              <dt>Reason</dt>
              <dd>{appt.reason}</dd>
              <dt>Booked</dt>
              <dd>{formatDate(appt.createdAt)}</dd>
            </dl>
          </div>

          {/* -------- Phase B seam: chat + video -------- */}
          <div className="card stack" style={{ gap: 12 }}>
            <h2 style={{ fontSize: 18 }}>Video consult &amp; chat</h2>
            {isChatParticipant ? (
              <AppointmentConsult appointmentId={appt.id} />
            ) : role === 'staff' ? (
              <div className="seam-note">
                Staff coordinate scheduling and receive system messages only — no
                access to the clinical chat/call.
              </div>
            ) : (
              <div className="seam-note">
                Admin has read-only audit of conversation metadata — not a chat
                participant.
              </div>
            )}
          </div>

          {actionError ? <ErrorNotice message={actionError} /> : null}

          {/* -------- role actions -------- */}
          {(canStart || canComplete || canCancel) && (
            <div className="card stack" style={{ gap: 12 }}>
              <h2 style={{ fontSize: 18 }}>Actions</h2>
              <div className="row">
                {canStart ? (
                  <button
                    className="btn btn-primary"
                    disabled={busy}
                    onClick={() => transition('in_progress')}
                  >
                    Start consult
                  </button>
                ) : null}
                {canComplete ? (
                  <button
                    className="btn btn-primary"
                    disabled={busy}
                    onClick={() => transition('completed')}
                  >
                    Complete consult
                  </button>
                ) : null}
                {canCancel ? (
                  <button
                    className="btn btn-danger"
                    disabled={busy}
                    onClick={() => transition('cancelled')}
                  >
                    Cancel appointment
                  </button>
                ) : null}
              </div>
            </div>
          )}

          {isCoordinator && active ? (
            <ReassignPanel
              appt={appt}
              onReassigned={(updated) => setAppt(updated)}
            />
          ) : null}
        </div>

        {/* -------- notes -------- */}
        <div className="stack">
          <NotesPanel
            appointmentId={appt.id}
            notes={notes}
            canWrite={canWriteNote}
            readOnlyReason={
              isCoordinator
                ? `${role === 'admin' ? 'Admins' : 'Staff'} can read consult notes for oversight but never author or edit them.`
                : undefined
            }
            onAdded={(note) => setNotes((prev) => [...prev, note])}
          />
        </div>
      </div>
    </>
  );
}

// ------------------------------------------------------------------ notes

function NotesPanel({
  appointmentId,
  notes,
  canWrite,
  readOnlyReason,
  onAdded,
}: {
  appointmentId: string;
  notes: NoteView[];
  canWrite: boolean;
  readOnlyReason?: string;
  onAdded: (note: NoteView) => void;
}) {
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setSaving(true);
    setErr(null);
    try {
      const res = await api.addNote(appointmentId, body.trim());
      onAdded(res.note);
      setBody('');
    } catch (error) {
      setErr(error instanceof ApiError ? error.message : 'Failed to save note.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card stack" style={{ gap: 16 }}>
      <h2 style={{ fontSize: 18 }}>Consultation notes</h2>

      {notes.length === 0 ? (
        <p className="muted" style={{ margin: 0 }}>
          No notes recorded yet.
        </p>
      ) : (
        <ul className="list-reset stack" style={{ gap: 12 }}>
          {notes.map((n) => (
            <li key={n.id} className="card" style={{ padding: 14, background: 'var(--surface-2)' }}>
              <div className="row spread" style={{ marginBottom: 6 }}>
                <strong style={{ fontSize: 13 }}>{n.authorName}</strong>
                <span className="faint">{formatDateTime(n.createdAt)}</span>
              </div>
              <div style={{ whiteSpace: 'pre-wrap' }}>{n.body}</div>
            </li>
          ))}
        </ul>
      )}

      {canWrite ? (
        <form onSubmit={submit} className="stack" style={{ gap: 10 }}>
          <hr className="divider" />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write a consult note…"
            maxLength={5000}
          />
          {err ? <ErrorNotice message={err} /> : null}
          <button
            type="submit"
            className="btn btn-primary"
            disabled={saving || !body.trim()}
          >
            {saving ? 'Saving…' : 'Add note'}
          </button>
        </form>
      ) : readOnlyReason ? (
        <div className="seam-note">{readOnlyReason}</div>
      ) : null}
    </div>
  );
}

// ------------------------------------------------ staff/admin reassignment

function ReassignPanel({
  appt,
  onReassigned,
}: {
  appt: AppointmentView;
  onReassigned: (updated: AppointmentView) => void;
}) {
  const [doctors, setDoctors] = useState<DoctorView[]>([]);
  const [doctorId, setDoctorId] = useState(appt.doctor.userId);
  const [slots, setSlots] = useState<SlotView[]>([]);
  const [slotId, setSlotId] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  useEffect(() => {
    api
      .doctors()
      .then((res) => setDoctors(res.doctors))
      .catch(() => setDoctors([]));
  }, []);

  // Load the chosen doctor's open slots (reschedule to a new open slot).
  useEffect(() => {
    if (!doctorId) return;
    setSlotId('');
    api
      .doctorSlots(doctorId, 'open')
      .then((res) => setSlots(res.slots))
      .catch(() => setSlots([]));
  }, [doctorId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    setOk(null);
    try {
      const body: { doctorId?: string; slotId?: string } = {};
      if (doctorId !== appt.doctor.userId) body.doctorId = doctorId;
      if (slotId) body.slotId = slotId;
      if (!body.doctorId && !body.slotId) {
        setErr('Pick a different doctor or a new open slot.');
        setSaving(false);
        return;
      }
      const res = await api.patchAppointment(appt.id, body);
      onReassigned(res.appointment);
      setOk('Appointment reassigned.');
    } catch (error) {
      setErr(error instanceof ApiError ? error.message : 'Reassignment failed.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card stack" style={{ gap: 12 }}>
      <h2 style={{ fontSize: 18 }}>Reassign / reschedule</h2>
      <p className="faint" style={{ margin: 0 }}>
        Move this appointment to a different doctor and/or open slot.
      </p>
      <form onSubmit={submit} className="stack" style={{ gap: 12 }}>
        <label className="field" style={{ margin: 0 }}>
          <span className="field-label">Doctor</span>
          <select value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
            {doctors.map((d) => (
              <option key={d.userId} value={d.userId}>
                {d.name} · {d.specialty}
              </option>
            ))}
          </select>
        </label>
        <label className="field" style={{ margin: 0 }}>
          <span className="field-label">New open slot (optional)</span>
          <select value={slotId} onChange={(e) => setSlotId(e.target.value)}>
            <option value="">Keep current slot</option>
            {slots.map((s) => (
              <option key={s.id} value={s.id}>
                {formatDateTime(s.startsAt)} · {s.durationMin} min
              </option>
            ))}
          </select>
        </label>
        {err ? <ErrorNotice message={err} /> : null}
        {ok ? <div className="notice notice-success">{ok}</div> : null}
        <button type="submit" className="btn btn-secondary" disabled={saving}>
          {saving ? 'Saving…' : 'Apply changes'}
        </button>
      </form>
    </div>
  );
}

export default function AppointmentDetailPage() {
  return (
    <Guard roles={['patient', 'doctor', 'staff', 'admin']}>
      <DetailInner />
    </Guard>
  );
}
