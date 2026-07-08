import { Router } from 'express';
import { z } from 'zod';
import { hashPassword } from '../auth/password';
import { findUserByEmail, genId, store } from '../db/store';
import { Doctor, Patient, toPublicUser, User } from '../domain/types';
import { doctorView } from '../domain/views';
import { authorize } from '../middleware/authorize';
import { badRequest } from '../middleware/httpError';
import { audit, listAudit } from '../services/audit';
import { asyncHandler } from '../utils/asyncHandler';

// Admin-only: user management (doctors/staff/patients) + audit log view.
export const adminRouter = Router();
adminRouter.use(authorize('admin'));

// GET /api/admin/audit — full audit trail.
adminRouter.get(
  '/audit',
  asyncHandler((req, res) => {
    const limit = Math.min(Number(req.query.limit) || 200, 1000);
    res.json({ entries: listAudit(limit) });
  }),
);

// GET /api/admin/users — directory of all users (no password hashes).
adminRouter.get(
  '/users',
  asyncHandler((req, res) => {
    const role = String(req.query.role ?? '').trim();
    let users = [...store.users.values()];
    if (role) users = users.filter((u) => u.role === role);
    res.json({ users: users.map(toPublicUser) });
  }),
);

const baseUser = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
});

const createUserSchema = z.discriminatedUnion('role', [
  baseUser.extend({
    role: z.literal('doctor'),
    specialty: z.string().min(1),
    clinicId: z.string().min(1),
  }),
  baseUser.extend({ role: z.literal('staff') }),
  baseUser.extend({
    role: z.literal('patient'),
    mrn: z.string().min(1),
    dob: z.string().min(1),
  }),
  baseUser.extend({ role: z.literal('admin') }),
]);

// POST /api/admin/users — create doctor/staff/patient/admin accounts. Doctor and
// patient creation also provisions the role profile atomically.
adminRouter.post(
  '/users',
  asyncHandler((req, res) => {
    const data = createUserSchema.parse(req.body);
    if (findUserByEmail(data.email)) throw badRequest('Email already in use');
    if (data.role === 'doctor' && !store.clinics.has(data.clinicId)) {
      throw badRequest('Unknown clinicId');
    }

    const user: User = {
      id: genId('user'),
      role: data.role,
      name: data.name,
      email: data.email,
      passwordHash: hashPassword(data.password),
    };
    store.users.set(user.id, user);

    if (data.role === 'doctor') {
      const doctor: Doctor = {
        userId: user.id,
        specialty: data.specialty,
        clinicId: data.clinicId,
      };
      store.doctors.set(user.id, doctor);
    } else if (data.role === 'patient') {
      const patient: Patient = { userId: user.id, mrn: data.mrn, dob: data.dob };
      store.patients.set(user.id, patient);
    }

    audit(req.user!, 'user.create', `user:${user.id}`, `role:${user.role}`);
    const profile =
      data.role === 'doctor' ? doctorView(store.doctors.get(user.id)!) : null;
    res.status(201).json({ user: toPublicUser(user), profile });
  }),
);
