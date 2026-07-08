import { Router } from 'express';
import { z } from 'zod';
import { genId, slotsForDoctor, store } from '../db/store';
import { Slot } from '../domain/types';
import { doctorView, slotView } from '../domain/views';
import { authorize } from '../middleware/authorize';
import { badRequest, notFound } from '../middleware/httpError';
import { audit } from '../services/audit';
import { asyncHandler } from '../utils/asyncHandler';

export const doctorsRouter = Router();

// GET /api/doctors?specialty=&clinicId= — browse doctors (any authenticated
// user). Powers the patient "browse doctors" flow.
doctorsRouter.get(
  '/',
  asyncHandler((req, res) => {
    const specialty = String(req.query.specialty ?? '').trim().toLowerCase();
    const clinicId = String(req.query.clinicId ?? '').trim();

    let doctors = [...store.doctors.values()];
    if (specialty) {
      doctors = doctors.filter((d) => d.specialty.toLowerCase().includes(specialty));
    }
    if (clinicId) {
      doctors = doctors.filter((d) => d.clinicId === clinicId);
    }

    res.json({ doctors: doctors.map(doctorView) });
  }),
);

// GET /api/doctors/:id/slots?status=open — a doctor's bookable slots.
doctorsRouter.get(
  '/:id/slots',
  asyncHandler((req, res) => {
    const doctor = store.doctors.get(req.params.id);
    if (!doctor) throw notFound('Doctor not found');

    const status = String(req.query.status ?? '').trim();
    let slots = slotsForDoctor(doctor.userId);
    if (status === 'open' || status === 'booked') {
      slots = slots.filter((s) => s.status === status);
    }
    res.json({ doctorId: doctor.userId, slots: slots.map(slotView) });
  }),
);

const createSlotSchema = z.object({
  startsAt: z.string().datetime({ message: 'startsAt must be an ISO datetime' }),
  durationMin: z.number().int().positive().max(240),
});

// POST /api/doctors/:id/slots — staff/admin create schedule slots for a doctor.
doctorsRouter.post(
  '/:id/slots',
  authorize('staff', 'admin'),
  asyncHandler((req, res) => {
    const doctor = store.doctors.get(req.params.id);
    if (!doctor) throw notFound('Doctor not found');

    const { startsAt, durationMin } = createSlotSchema.parse(req.body);
    const slot: Slot = {
      id: genId('slot'),
      doctorId: doctor.userId,
      startsAt,
      durationMin,
      status: 'open',
    };
    store.slots.set(slot.id, slot);
    audit(req.user!, 'slot.create', `slot:${slot.id}`, `doctor:${doctor.userId}`);
    res.status(201).json({ slot: slotView(slot) });
  }),
);

const createDoctorSchema = z.object({
  userId: z.string().min(1),
  specialty: z.string().min(1),
  clinicId: z.string().min(1),
});

// POST /api/doctors — admin links an existing doctor-user to a clinic/specialty.
doctorsRouter.post(
  '/',
  authorize('admin'),
  asyncHandler((req, res) => {
    const { userId, specialty, clinicId } = createDoctorSchema.parse(req.body);
    const user = store.users.get(userId);
    if (!user || user.role !== 'doctor') {
      throw badRequest('userId must reference an existing user with role "doctor"');
    }
    if (!store.clinics.has(clinicId)) throw badRequest('Unknown clinicId');
    if (store.doctors.has(userId)) throw badRequest('Doctor profile already exists');

    const doctor = { userId, specialty, clinicId };
    store.doctors.set(userId, doctor);
    audit(req.user!, 'doctor.create', `doctor:${userId}`, `clinic:${clinicId}`);
    res.status(201).json({ doctor: doctorView(doctor) });
  }),
);
