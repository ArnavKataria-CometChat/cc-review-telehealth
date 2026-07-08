import { store } from '../db/store';
import {
  Appointment,
  ConsultationNote,
  Doctor,
  Patient,
  Slot,
} from './types';

// Response shaping. Routes return these "view" objects (related entities
// embedded, no password hashes) rather than raw store records.

export function doctorView(d: Doctor) {
  const user = store.users.get(d.userId);
  const clinic = store.clinics.get(d.clinicId);
  return {
    userId: d.userId,
    name: user?.name ?? 'Unknown',
    email: user?.email ?? null,
    specialty: d.specialty,
    clinicId: d.clinicId,
    clinicName: clinic?.name ?? null,
  };
}

export function patientView(p: Patient) {
  const user = store.users.get(p.userId);
  return {
    userId: p.userId,
    name: user?.name ?? 'Unknown',
    email: user?.email ?? null,
    mrn: p.mrn,
    dob: p.dob,
  };
}

export function slotView(s: Slot) {
  return {
    id: s.id,
    doctorId: s.doctorId,
    startsAt: s.startsAt,
    durationMin: s.durationMin,
    status: s.status,
  };
}

export function noteView(n: ConsultationNote) {
  const author = store.users.get(n.doctorId);
  return {
    id: n.id,
    appointmentId: n.appointmentId,
    doctorId: n.doctorId,
    authorName: author?.name ?? 'Unknown',
    body: n.body,
    createdAt: n.createdAt,
  };
}

export function appointmentView(a: Appointment) {
  const patient = store.patients.get(a.patientId);
  const doctor = store.doctors.get(a.doctorId);
  const slot = store.slots.get(a.slotId);
  return {
    id: a.id,
    status: a.status,
    reason: a.reason,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
    slotId: a.slotId,
    startsAt: slot?.startsAt ?? null,
    durationMin: slot?.durationMin ?? null,
    patient: patient ? patientView(patient) : { userId: a.patientId },
    doctor: doctor ? doctorView(doctor) : { userId: a.doctorId },
    // Phase B seam: the CometChat 1:1 conversation for this appointment will be
    // scoped to exactly these two participants (patient <-> doctor).
    participants: [a.patientId, a.doctorId],
  };
}
