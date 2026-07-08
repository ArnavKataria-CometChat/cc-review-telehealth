// Core domain entities for the telehealth consult platform.
// Every user has a stable server-side id + role; later phases map these to
// CometChat users (see README "Phase B").

export type Role = 'patient' | 'doctor' | 'staff' | 'admin';

export const ROLES: readonly Role[] = ['patient', 'doctor', 'staff', 'admin'];

export interface User {
  id: string;
  role: Role;
  name: string;
  email: string;
  passwordHash: string;
}

export interface Clinic {
  id: string;
  name: string;
  address: string;
}

export interface Doctor {
  userId: string;
  specialty: string;
  clinicId: string;
}

export interface Patient {
  userId: string;
  mrn: string; // medical record number
  dob: string; // ISO date (YYYY-MM-DD)
}

export type SlotStatus = 'open' | 'booked';

export interface Slot {
  id: string;
  doctorId: string; // Doctor.userId
  startsAt: string; // ISO datetime
  durationMin: number;
  status: SlotStatus;
}

export type AppointmentStatus =
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export interface Appointment {
  id: string;
  patientId: string; // Patient.userId
  doctorId: string; // Doctor.userId
  slotId: string;
  status: AppointmentStatus;
  reason: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConsultationNote {
  id: string;
  appointmentId: string;
  doctorId: string; // author (Doctor.userId)
  body: string;
  createdAt: string;
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

// Public shape returned to clients (never leak passwordHash).
export interface PublicUser {
  id: string;
  role: Role;
  name: string;
  email: string;
}

export function toPublicUser(u: User): PublicUser {
  return { id: u.id, role: u.role, name: u.name, email: u.email };
}
