import { Router } from 'express';
import { store } from '../db/store';
import { toPublicUser } from '../domain/types';
import { doctorView, patientView } from '../domain/views';
import { unauthorized } from '../middleware/httpError';
import { asyncHandler } from '../utils/asyncHandler';

export const usersRouter = Router();

// GET /api/users/me — the authenticated user's stable id + role, plus the
// role-specific profile (doctor/patient) when present.
usersRouter.get(
  '/me',
  asyncHandler((req, res) => {
    if (!req.user) throw unauthorized();
    const base = toPublicUser(req.user.record);

    let profile: unknown = null;
    if (req.user.role === 'doctor') {
      const d = store.doctors.get(req.user.id);
      profile = d ? doctorView(d) : null;
    } else if (req.user.role === 'patient') {
      const p = store.patients.get(req.user.id);
      profile = p ? patientView(p) : null;
    }

    res.json({ ...base, profile });
  }),
);
