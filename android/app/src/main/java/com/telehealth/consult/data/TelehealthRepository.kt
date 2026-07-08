package com.telehealth.consult.data

import com.telehealth.consult.data.model.AppointmentResponse
import com.telehealth.consult.data.model.AppointmentView
import com.telehealth.consult.data.model.AppointmentsResponse
import com.telehealth.consult.data.model.AuditEntry
import com.telehealth.consult.data.model.AuditResponse
import com.telehealth.consult.data.model.BookAppointmentRequest
import com.telehealth.consult.data.model.Clinic
import com.telehealth.consult.data.model.ClinicRequest
import com.telehealth.consult.data.model.ClinicResponse
import com.telehealth.consult.data.model.ClinicsResponse
import com.telehealth.consult.data.model.CreateNoteRequest
import com.telehealth.consult.data.model.CreateSlotRequest
import com.telehealth.consult.data.model.CreateUserRequest
import com.telehealth.consult.data.model.DoctorView
import com.telehealth.consult.data.model.DoctorsResponse
import com.telehealth.consult.data.model.LoginRequest
import com.telehealth.consult.data.model.LoginResponse
import com.telehealth.consult.data.model.MeResponse
import com.telehealth.consult.data.model.NoteResponse
import com.telehealth.consult.data.model.NoteView
import com.telehealth.consult.data.model.NotesResponse
import com.telehealth.consult.data.model.PatchAppointmentRequest
import com.telehealth.consult.data.model.PatchSlotRequest
import com.telehealth.consult.data.model.PublicUser
import com.telehealth.consult.data.model.Role
import com.telehealth.consult.data.model.SlotResponse
import com.telehealth.consult.data.model.SlotStatus
import com.telehealth.consult.data.model.SlotView
import com.telehealth.consult.data.model.SlotsResponse
import com.telehealth.consult.data.model.UsersResponse

/**
 * The single gateway to the backend API. Every screen talks to this; it maps
 * REST endpoints (see ../backend README) to typed suspend functions. RBAC is
 * enforced server-side — these calls surface 401/403 as [ApiException].
 */
class TelehealthRepository(
    private val api: ApiClient,
    private val session: SessionStore,
) {
    // --- auth / identity ---------------------------------------------------

    /** POST /auth/login → persists the session and returns the user. */
    suspend fun login(email: String, password: String): PublicUser {
        val res = api.post(
            "auth/login",
            LoginRequest(email.trim(), password),
            LoginRequest.serializer(),
            LoginResponse.serializer(),
        )
        session.save(res.token, res.user)
        return res.user
    }

    fun logout() = session.clear()

    /** GET /users/me — current identity + role profile. */
    suspend fun me(): MeResponse =
        api.get("users/me", MeResponse.serializer())

    // --- doctors & slots ---------------------------------------------------

    suspend fun doctors(specialty: String? = null, clinicId: String? = null): List<DoctorView> =
        api.get(
            "doctors",
            DoctorsResponse.serializer(),
            mapOf("specialty" to specialty, "clinicId" to clinicId),
        ).doctors

    suspend fun doctorSlots(doctorId: String, status: SlotStatus? = null): List<SlotView> =
        api.get(
            "doctors/$doctorId/slots",
            SlotsResponse.serializer(),
            mapOf("status" to status?.name?.lowercase()),
        ).slots

    /** POST /doctors/:id/slots — staff/admin. */
    suspend fun createSlot(doctorId: String, startsAt: String, durationMin: Int): SlotView =
        api.post(
            "doctors/$doctorId/slots",
            CreateSlotRequest(startsAt, durationMin),
            CreateSlotRequest.serializer(),
            SlotResponse.serializer(),
        ).slot

    /** PATCH /slots/:id — staff/admin open/close. */
    suspend fun setSlotStatus(slotId: String, status: SlotStatus): SlotView =
        api.patch(
            "slots/$slotId",
            PatchSlotRequest(status),
            PatchSlotRequest.serializer(),
            SlotResponse.serializer(),
        ).slot

    // --- appointments ------------------------------------------------------

    /** POST /appointments — patient books an open slot. */
    suspend fun book(doctorId: String, slotId: String, reason: String): AppointmentView =
        api.post(
            "appointments",
            BookAppointmentRequest(doctorId, slotId, reason),
            BookAppointmentRequest.serializer(),
            AppointmentResponse.serializer(),
        ).appointment

    /** GET /appointments — role-scoped list (patient→own, doctor→own, staff/admin→all). */
    suspend fun appointments(status: String? = null): List<AppointmentView> =
        api.get(
            "appointments",
            AppointmentsResponse.serializer(),
            mapOf("status" to status),
        ).appointments

    suspend fun appointment(id: String): AppointmentView =
        api.get("appointments/$id", AppointmentResponse.serializer()).appointment

    suspend fun patchAppointment(id: String, patch: PatchAppointmentRequest): AppointmentView =
        api.patch(
            "appointments/$id",
            patch,
            PatchAppointmentRequest.serializer(),
            AppointmentResponse.serializer(),
        ).appointment

    // --- consultation notes ------------------------------------------------

    suspend fun notes(appointmentId: String): List<NoteView> =
        api.get("appointments/$appointmentId/notes", NotesResponse.serializer()).notes

    /** POST /appointments/:id/notes — treating doctor only. */
    suspend fun addNote(appointmentId: String, body: String): NoteView =
        api.post(
            "appointments/$appointmentId/notes",
            CreateNoteRequest(body),
            CreateNoteRequest.serializer(),
            NoteResponse.serializer(),
        ).note

    // --- clinics (admin) ---------------------------------------------------

    suspend fun clinics(): List<Clinic> =
        api.get("clinics", ClinicsResponse.serializer()).clinics

    suspend fun createClinic(name: String, address: String): Clinic =
        api.post(
            "clinics",
            ClinicRequest(name, address),
            ClinicRequest.serializer(),
            ClinicResponse.serializer(),
        ).clinic

    suspend fun updateClinic(id: String, name: String, address: String): Clinic =
        api.patch(
            "clinics/$id",
            ClinicRequest(name, address),
            ClinicRequest.serializer(),
            ClinicResponse.serializer(),
        ).clinic

    suspend fun deleteClinic(id: String) = api.delete("clinics/$id")

    // --- admin users & audit ----------------------------------------------

    suspend fun users(role: Role? = null): List<PublicUser> =
        api.get(
            "admin/users",
            UsersResponse.serializer(),
            mapOf("role" to role?.name?.lowercase()),
        ).users

    suspend fun createUser(req: CreateUserRequest): PublicUser =
        // Response is `{ user, profile }`; we only surface the created user.
        api.post(
            "admin/users",
            req,
            CreateUserRequest.serializer(),
            CreateUserResponse.serializer(),
        ).user

    suspend fun audit(limit: Int = 200): List<AuditEntry> =
        api.get(
            "admin/audit",
            AuditResponse.serializer(),
            mapOf("limit" to limit.toString()),
        ).entries
}

/** Local wrapper for POST /admin/users response `{ user, profile }`. */
@kotlinx.serialization.Serializable
private data class CreateUserResponse(val user: PublicUser)
