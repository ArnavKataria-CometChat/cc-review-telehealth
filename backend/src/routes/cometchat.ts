import { Router } from 'express';
import { config } from '../config';
import { store } from '../db/store';
import { Appointment, toPublicUser } from '../domain/types';
import { forbidden, notFound, unauthorized } from '../middleware/httpError';
import { audit } from '../services/audit';
import {
  cometChatUid,
  isConfigured,
  provisionAndMintToken,
} from '../services/cometchat';
import { asyncHandler } from '../utils/asyncHandler';

// CometChat integration endpoints (Phase B). Mounted under /api/cometchat, so
// every route here already ran through `authenticate` — req.user is present.
export const cometchatRouter = Router();

// GET /api/cometchat/config — non-secret client bootstrap: App ID + Region only.
// The REST API Key and Auth Key are NEVER returned. `configured` lets a client
// degrade gracefully when the backend has no CometChat credentials.
cometchatRouter.get(
  '/config',
  asyncHandler((_req, res) => {
    res.json({
      configured: isConfigured(),
      appId: config.cometchat.appId,
      region: config.cometchat.region,
    });
  }),
);

// POST /api/cometchat/token — the authenticated user provisions/syncs their own
// CometChat identity (carrying their role) and receives a fresh auth token.
//
// SECURITY: the UID is derived from the verified session (req.user.id), NEVER
// from the request body — a caller can only ever mint a token for themselves.
cometchatRouter.post(
  '/token',
  asyncHandler(async (req, res) => {
    const user = req.user;
    if (!user) throw unauthorized();

    const { uid, authToken } = await provisionAndMintToken(
      toPublicUser(user.record),
    );

    audit(
      { id: user.id, role: user.role },
      'cometchat.token.mint',
      `user:${user.id}`,
    );

    res.json({
      uid,
      authToken,
      appId: config.cometchat.appId,
      region: config.cometchat.region,
    });
  }),
);

// --- appointment-scoped 1:1 chat/call context -------------------------------

// Resolve the counterpart's public identity for the chat/call surface.
function peerFor(appt: Appointment, peerId: string) {
  const record = store.users.get(peerId);
  return {
    uid: peerId,
    role: record?.role ?? null,
    name: record?.name ?? 'Unknown',
    appointmentId: appt.id,
  };
}

// GET /api/cometchat/appointments/:id/chat — returns who the caller may 1:1
// chat/call with for this appointment, enforcing the RBAC → CometChat mapping:
//
//   patient  -> may converse/call ONLY with their booked doctor
//   doctor   -> may converse/call ONLY with the appointment's patient
//   staff    -> NO clinical chat (403); coordination happens elsewhere
//   admin    -> read-only audit of conversation metadata (not a participant)
//
// The conversation is implicitly scoped per appointment: the two participant
// UIDs are the app user ids, so the client points a 1:1 conversation at exactly
// the returned peer.
cometchatRouter.get(
  '/appointments/:id/chat',
  asyncHandler((req, res) => {
    const user = req.user;
    if (!user) throw unauthorized();

    const appt = store.appointments.get(req.params.id);
    if (!appt) throw notFound('Appointment not found');

    if (user.role === 'patient') {
      if (appt.patientId !== user.id) {
        throw forbidden('You are not a participant in this appointment');
      }
      return res.json({
        appointmentId: appt.id,
        self: { uid: cometChatUid(user), role: user.role },
        peer: peerFor(appt, appt.doctorId),
        canChat: true,
        canCall: true,
      });
    }

    if (user.role === 'doctor') {
      if (appt.doctorId !== user.id) {
        throw forbidden('You are not a participant in this appointment');
      }
      return res.json({
        appointmentId: appt.id,
        self: { uid: cometChatUid(user), role: user.role },
        peer: peerFor(appt, appt.patientId),
        canChat: true,
        canCall: true,
      });
    }

    if (user.role === 'admin') {
      // Read-only audit: metadata about the conversation, no participation.
      audit(
        { id: user.id, role: user.role },
        'cometchat.audit.view',
        `appointment:${appt.id}`,
      );
      return res.json({
        appointmentId: appt.id,
        audit: true,
        canChat: false,
        canCall: false,
        participants: [
          peerFor(appt, appt.patientId),
          peerFor(appt, appt.doctorId),
        ],
      });
    }

    // staff (and any other role): no access to the clinical 1:1 conversation.
    throw forbidden('Staff have no access to clinical chat for an appointment');
  }),
);
