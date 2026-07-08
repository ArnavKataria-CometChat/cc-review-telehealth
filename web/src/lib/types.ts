// TypeScript mirrors of the backend response shapes (../backend/src/domain).
// Kept in sync by hand — the REST contract is documented in the web README.

export type Role = 'patient' | 'doctor' | 'staff' | 'admin';

export const ROLES: readonly Role[] = ['patient', 'doctor', 'staff', 'admin'];

export interface PublicUser {
  id: string;
  role: Role;
  name: string;
  email: string;
}

export interface DoctorView {
  userId: string;
  name: string;
  email: string | null;
  specialty: string;
  clinicId: string;
  clinicName: string | null;
}

export interface PatientView {
  userId: string;
  name: string;
  email: string | null;
  mrn: string;
  dob: string;
}

/** `/users/me` returns the base user plus a role-specific profile (or null). */
export interface MeResponse extends PublicUser {
  profile: DoctorView | PatientView | null;
}

export type SlotStatus = 'open' | 'booked';

export interface SlotView {
  id: string;
  doctorId: string;
  startsAt: string;
  durationMin: number;
  status: SlotStatus;
}

export type AppointmentStatus =
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

/** Embedded participant — either the full view or, if missing, just the id. */
export type EmbeddedPatient = PatientView | { userId: string };
export type EmbeddedDoctor = DoctorView | { userId: string };

export interface AppointmentView {
  id: string;
  status: AppointmentStatus;
  reason: string;
  createdAt: string;
  updatedAt: string;
  slotId: string;
  startsAt: string | null;
  durationMin: number | null;
  patient: EmbeddedPatient;
  doctor: EmbeddedDoctor;
  // Phase B seam: the CometChat 1:1 conversation for this appointment is scoped
  // to exactly these two participants (patient <-> doctor).
  participants: [string, string];
}

export interface NoteView {
  id: string;
  appointmentId: string;
  doctorId: string;
  authorName: string;
  body: string;
  createdAt: string;
}

export interface Clinic {
  id: string;
  name: string;
  address: string;
}

export interface AuditEntry {
  id: string;
  at: string;
  actorId: string | null;
  actorRole: Role | null;
  action: string;
  target: string;
  detail?: string;
}
