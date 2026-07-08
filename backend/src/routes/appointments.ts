import { Router } from 'express';
import { z } from 'zod';
import { genId, notesForAppointment, store } from '../db/store';
import {
  Appointment,
  AppointmentStatus,
  ConsultationNote,
  Role,
} from '../domain/types';
import { appointmentView, noteView } from '../domain/views';
import {
  badRequest,
  conflict,
  forbidden,
  notFound,
} from '../middleware/httpError';
import { audit } from '../services/audit';
import { asyncHandler } from '../utils/asyncHandler';

export const appointmentsRouter = Router();

// --- helpers ---------------------------------------------------------------

// Can this user see this appointment? Patient/doctor participants, plus
// staff/admin oversight.
function canView(role: Role, userId: string, appt: Appointment): boolean {
  if (role === 'admin' || role === 'staff') return true;
  if (role === 'patient') return appt.patientId === userId;
  if (role === 'doctor') return appt.doctorId === userId;
  return false;
}

// Allowed status transitions by role. Encodes the clinical/coordination split:
// only the treating doctor (or admin) runs a consult; patients/staff can cancel.
const TRANSITIONS: Record<
  AppointmentStatus,
  Partial<Record<AppointmentStatus, Role[]>>
> = {
  scheduled: {
    in_progress: ['doctor', 'admin'],
    cancelled: ['patient', 'doctor', 'staff', 'admin'],
  },
  in_progress: {
    completed: ['doctor', 'admin'],
    cancelled: ['doctor', 'staff', 'admin'],
  },
  completed: {},
  cancelled: {},
};

function freeSlot(slotId: string): void {
  const slot = store.slots.get(slotId);
  if (slot) {
    slot.status = 'open';
    store.slots.set(slot.id, slot);
  }
}

// --- create ----------------------------------------------------------------

const bookSchema = z.object({
  doctorId: z.string().min(1),
  slotId: z.string().min(1),
  reason: z.string().min(1).max(500),
});

// POST /api/appointments — a patient books an open slot with a doctor.
appointmentsRouter.post(
  '/',
  asyncHandler((req, res) => {
    const user = req.user!;
    if (user.role !== 'patient') {
      throw forbidden('Only patients can book appointments');
    }
    const { doctorId, slotId, reason } = bookSchema.parse(req.body);

    const doctor = store.doctors.get(doctorId);
    if (!doctor) throw badRequest('Unknown doctorId');

    const slot = store.slots.get(slotId);
    if (!slot) throw badRequest('Unknown slotId');
    if (slot.doctorId !== doctorId) {
      throw badRequest('Slot does not belong to that doctor');
    }
    if (slot.status !== 'open') throw conflict('Slot is no longer open');

    const now = new Date().toISOString();
    const appt: Appointment = {
      id: genId('appt'),
      patientId: user.id,
      doctorId,
      slotId,
      status: 'scheduled',
      reason,
      createdAt: now,
      updatedAt: now,
    };
    slot.status = 'booked';
    store.slots.set(slot.id, slot);
    store.appointments.set(appt.id, appt);
    audit(user, 'appointment.book', `appointment:${appt.id}`, `doctor:${doctorId}`);
    res.status(201).json({ appointment: appointmentView(appt) });
  }),
);

// --- list (role-scoped) ----------------------------------------------------

// GET /api/appointments?status= — scoped to the caller's role:
//   patient -> own; doctor -> own; staff/admin -> all.
appointmentsRouter.get(
  '/',
  asyncHandler((req, res) => {
    const user = req.user!;
    const statusFilter = String(req.query.status ?? '').trim();

    let appts = [...store.appointments.values()];
    if (user.role === 'patient') {
      appts = appts.filter((a) => a.patientId === user.id);
    } else if (user.role === 'doctor') {
      appts = appts.filter((a) => a.doctorId === user.id);
    }
    // staff & admin: full visibility for coordination/audit.

    if (statusFilter) {
      appts = appts.filter((a) => a.status === statusFilter);
    }
    appts.sort((a, b) => (b.createdAt).localeCompare(a.createdAt));

    res.json({ appointments: appts.map(appointmentView) });
  }),
);

// --- detail ----------------------------------------------------------------

// GET /api/appointments/:id
appointmentsRouter.get(
  '/:id',
  asyncHandler((req, res) => {
    const user = req.user!;
    const appt = store.appointments.get(req.params.id);
    if (!appt) throw notFound('Appointment not found');
    if (!canView(user.role, user.id, appt)) throw forbidden();
    res.json({ appointment: appointmentView(appt) });
  }),
);

// --- update: status transitions + staff/admin reassignment -----------------

const patchSchema = z
  .object({
    status: z.enum(['scheduled', 'in_progress', 'completed', 'cancelled']).optional(),
    doctorId: z.string().min(1).optional(),
    slotId: z.string().min(1).optional(),
    reason: z.string().min(1).max(500).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: 'Provide at least one field to update',
  });

// PATCH /api/appointments/:id — status changes (participants), reassignment and
// reschedule (staff/admin only).
appointmentsRouter.patch(
  '/:id',
  asyncHandler((req, res) => {
    const user = req.user!;
    const appt = store.appointments.get(req.params.id);
    if (!appt) throw notFound('Appointment not found');
    if (!canView(user.role, user.id, appt)) throw forbidden();

    const body = patchSchema.parse(req.body);
    const isCoordinator = user.role === 'staff' || user.role === 'admin';

    // Reassignment / reschedule — staff & admin only, on active appointments.
    if (body.doctorId !== undefined || body.slotId !== undefined) {
      if (!isCoordinator) {
        throw forbidden('Only staff or admin can reassign appointments');
      }
      if (appt.status === 'completed' || appt.status === 'cancelled') {
        throw conflict(`Cannot reassign a ${appt.status} appointment`);
      }
      const newDoctorId = body.doctorId ?? appt.doctorId;
      if (!store.doctors.has(newDoctorId)) throw badRequest('Unknown doctorId');

      const newSlotId = body.slotId ?? appt.slotId;
      const newSlot = store.slots.get(newSlotId);
      if (!newSlot) throw badRequest('Unknown slotId');
      if (newSlot.doctorId !== newDoctorId) {
        throw badRequest('Target slot does not belong to the target doctor');
      }
      if (newSlotId !== appt.slotId) {
        if (newSlot.status !== 'open') throw conflict('Target slot is not open');
        freeSlot(appt.slotId);
        newSlot.status = 'booked';
        store.slots.set(newSlot.id, newSlot);
      }
      appt.doctorId = newDoctorId;
      appt.slotId = newSlotId;
      audit(user, 'appointment.reassign', `appointment:${appt.id}`, `doctor:${newDoctorId}`);
    }

    // Reason edit — coordinators or the owning patient.
    if (body.reason !== undefined) {
      if (!isCoordinator && !(user.role === 'patient' && appt.patientId === user.id)) {
        throw forbidden('You cannot edit the reason for this appointment');
      }
      appt.reason = body.reason;
    }

    // Status transition — validated against the role transition table.
    if (body.status !== undefined && body.status !== appt.status) {
      const allowedRoles = TRANSITIONS[appt.status][body.status];
      if (!allowedRoles) {
        throw conflict(`Illegal transition ${appt.status} -> ${body.status}`);
      }
      if (!allowedRoles.includes(user.role)) {
        throw forbidden(
          `Role '${user.role}' cannot move appointment to '${body.status}'`,
        );
      }
      // Participant status changes must be the actual participant.
      if (user.role === 'patient' && appt.patientId !== user.id) throw forbidden();
      if (user.role === 'doctor' && appt.doctorId !== user.id) throw forbidden();

      appt.status = body.status;
      if (body.status === 'cancelled' || body.status === 'completed') {
        freeSlot(appt.slotId);
      }
      audit(user, 'appointment.status', `appointment:${appt.id}`, `status:${body.status}`);
    }

    appt.updatedAt = new Date().toISOString();
    store.appointments.set(appt.id, appt);
    res.json({ appointment: appointmentView(appt) });
  }),
);

// --- consultation notes ----------------------------------------------------

const noteSchema = z.object({ body: z.string().min(1).max(5000) });

// POST /api/appointments/:id/notes — the treating doctor writes a consult note.
appointmentsRouter.post(
  '/:id/notes',
  asyncHandler((req, res) => {
    const user = req.user!;
    const appt = store.appointments.get(req.params.id);
    if (!appt) throw notFound('Appointment not found');
    if (user.role !== 'doctor' || appt.doctorId !== user.id) {
      throw forbidden('Only the treating doctor can write consult notes');
    }
    const { body } = noteSchema.parse(req.body);
    const note: ConsultationNote = {
      id: genId('note'),
      appointmentId: appt.id,
      doctorId: user.id,
      body,
      createdAt: new Date().toISOString(),
    };
    store.notes.set(note.id, note);
    audit(user, 'note.create', `note:${note.id}`, `appointment:${appt.id}`);
    res.status(201).json({ note: noteView(note) });
  }),
);

// GET /api/appointments/:id/notes — participants + staff/admin (read-only).
// Admin/staff can audit notes but never author or alter them.
appointmentsRouter.get(
  '/:id/notes',
  asyncHandler((req, res) => {
    const user = req.user!;
    const appt = store.appointments.get(req.params.id);
    if (!appt) throw notFound('Appointment not found');
    if (!canView(user.role, user.id, appt)) throw forbidden();
    res.json({ notes: notesForAppointment(appt.id).map(noteView) });
  }),
);
