import {
  Appointment,
  AuditEntry,
  Clinic,
  ConsultationNote,
  Doctor,
  Patient,
  Slot,
  User,
} from '../domain/types';

// -----------------------------------------------------------------------------
// In-memory data store.
//
// This baseline keeps all state in memory behind a small repository so the app
// builds and runs with zero external infrastructure. The collections and access
// helpers are deliberately DB-shaped: swapping in Postgres/Prisma later only
// touches this file, not the routes/services.
// -----------------------------------------------------------------------------

let counter = 0;
export function genId(prefix: string): string {
  counter += 1;
  return `${prefix}_${counter.toString(36)}_${Date.now().toString(36)}`;
}

export interface Store {
  users: Map<string, User>;
  clinics: Map<string, Clinic>;
  doctors: Map<string, Doctor>; // keyed by userId
  patients: Map<string, Patient>; // keyed by userId
  slots: Map<string, Slot>;
  appointments: Map<string, Appointment>;
  notes: Map<string, ConsultationNote>;
  audit: AuditEntry[];
}

export const store: Store = {
  users: new Map(),
  clinics: new Map(),
  doctors: new Map(),
  patients: new Map(),
  slots: new Map(),
  appointments: new Map(),
  notes: new Map(),
  audit: [],
};

export function findUserByEmail(email: string): User | undefined {
  const target = email.trim().toLowerCase();
  for (const u of store.users.values()) {
    if (u.email.toLowerCase() === target) return u;
  }
  return undefined;
}

export function slotsForDoctor(doctorId: string): Slot[] {
  return [...store.slots.values()]
    .filter((s) => s.doctorId === doctorId)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

export function notesForAppointment(appointmentId: string): ConsultationNote[] {
  return [...store.notes.values()]
    .filter((n) => n.appointmentId === appointmentId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function resetStore(): void {
  store.users.clear();
  store.clinics.clear();
  store.doctors.clear();
  store.patients.clear();
  store.slots.clear();
  store.appointments.clear();
  store.notes.clear();
  store.audit.length = 0;
}
