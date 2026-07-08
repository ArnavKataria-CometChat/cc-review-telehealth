import { Router } from 'express';
import { z } from 'zod';
import { genId, store } from '../db/store';
import { Clinic } from '../domain/types';
import { authorize } from '../middleware/authorize';
import { conflict, notFound } from '../middleware/httpError';
import { audit } from '../services/audit';
import { asyncHandler } from '../utils/asyncHandler';

// Admin-only clinic oversight & CRUD (per spec: GET /clinics is admin).
export const clinicsRouter = Router();
clinicsRouter.use(authorize('admin'));

clinicsRouter.get(
  '/',
  asyncHandler((_req, res) => {
    res.json({ clinics: [...store.clinics.values()] });
  }),
);

const clinicSchema = z.object({
  name: z.string().min(1),
  address: z.string().min(1),
});

// POST /api/clinics
clinicsRouter.post(
  '/',
  asyncHandler((req, res) => {
    const data = clinicSchema.parse(req.body);
    const clinic: Clinic = { id: genId('clinic'), ...data };
    store.clinics.set(clinic.id, clinic);
    audit(req.user!, 'clinic.create', `clinic:${clinic.id}`);
    res.status(201).json({ clinic });
  }),
);

// PATCH /api/clinics/:id
clinicsRouter.patch(
  '/:id',
  asyncHandler((req, res) => {
    const clinic = store.clinics.get(req.params.id);
    if (!clinic) throw notFound('Clinic not found');
    const data = clinicSchema.partial().parse(req.body);
    Object.assign(clinic, data);
    store.clinics.set(clinic.id, clinic);
    audit(req.user!, 'clinic.update', `clinic:${clinic.id}`);
    res.json({ clinic });
  }),
);

// DELETE /api/clinics/:id — refuses if doctors are still assigned.
clinicsRouter.delete(
  '/:id',
  asyncHandler((req, res) => {
    const clinic = store.clinics.get(req.params.id);
    if (!clinic) throw notFound('Clinic not found');
    const inUse = [...store.doctors.values()].some((d) => d.clinicId === clinic.id);
    if (inUse) throw conflict('Clinic still has assigned doctors');
    store.clinics.delete(clinic.id);
    audit(req.user!, 'clinic.delete', `clinic:${clinic.id}`);
    res.status(204).end();
  }),
);
