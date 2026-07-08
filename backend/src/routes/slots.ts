import { Router } from 'express';
import { z } from 'zod';
import { store } from '../db/store';
import { slotView } from '../domain/views';
import { authorize } from '../middleware/authorize';
import { badRequest, conflict, notFound } from '../middleware/httpError';
import { audit } from '../services/audit';
import { asyncHandler } from '../utils/asyncHandler';

export const slotsRouter = Router();

const patchSlotSchema = z.object({
  status: z.enum(['open', 'booked']),
});

// PATCH /api/slots/:id — staff/admin open or close a slot. A booked slot with a
// live appointment cannot be reopened directly (cancel the appointment first).
slotsRouter.patch(
  '/:id',
  authorize('staff', 'admin'),
  asyncHandler((req, res) => {
    const slot = store.slots.get(req.params.id);
    if (!slot) throw notFound('Slot not found');

    const { status } = patchSlotSchema.parse(req.body);

    if (status === 'open' && slot.status === 'booked') {
      const activeAppt = [...store.appointments.values()].find(
        (a) =>
          a.slotId === slot.id &&
          (a.status === 'scheduled' || a.status === 'in_progress'),
      );
      if (activeAppt) {
        throw conflict('Slot is booked by an active appointment; cancel it first');
      }
    }

    if (status === slot.status) throw badRequest(`Slot already ${status}`);

    slot.status = status;
    store.slots.set(slot.id, slot);
    audit(req.user!, 'slot.update', `slot:${slot.id}`, `status:${status}`);
    res.json({ slot: slotView(slot) });
  }),
);
