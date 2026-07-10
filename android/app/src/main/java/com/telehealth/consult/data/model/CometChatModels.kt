package com.telehealth.consult.data.model

import kotlinx.serialization.Serializable

/**
 * DTOs for the backend's CometChat endpoints (Phase B). Mirrors
 * ../backend/src/routes/cometchat.ts one-to-one. Unknown keys are ignored by the
 * shared [com.telehealth.consult.data.Json] instance.
 *
 * Contract expected from the backend (all under /api/cometchat, authenticated):
 *   GET  /config                        -> CometChatConfig
 *   POST /token                         -> CometChatToken   (UID derived from the
 *                                          session, never the body)
 *   GET  /appointments/:id/chat         -> AppointmentChatContext
 */

/** GET /api/cometchat/config — non-secret client bootstrap. */
@Serializable
data class CometChatConfig(
    val configured: Boolean,
    val appId: String? = null,
    val region: String? = null,
)

/**
 * POST /api/cometchat/token — the caller provisions/syncs their own CometChat
 * identity (carrying their role) and receives a fresh auth token to
 * `loginWithAuthToken`. The `uid` equals the app's stable user id.
 */
@Serializable
data class CometChatToken(
    val uid: String,
    val authToken: String,
    val appId: String,
    val region: String,
)

/** A participant identity in the appointment-scoped conversation. */
@Serializable
data class ChatParticipant(
    val uid: String,
    val role: Role? = null,
    val name: String? = null,
    val appointmentId: String? = null,
)

/**
 * GET /api/cometchat/appointments/:id/chat — who the caller may 1:1 chat/call
 * with for this appointment, enforcing the RBAC → CometChat mapping server-side:
 *   patient/doctor -> [peer] populated, canChat = canCall = true
 *   admin          -> audit = true, [participants] populated, no participation
 *   staff          -> 403 (surfaces as ApiException before this decodes)
 */
@Serializable
data class AppointmentChatContext(
    val appointmentId: String,
    val self: ChatParticipant? = null,
    val peer: ChatParticipant? = null,
    val canChat: Boolean = false,
    val canCall: Boolean = false,
    val audit: Boolean = false,
    val participants: List<ChatParticipant> = emptyList(),
)
