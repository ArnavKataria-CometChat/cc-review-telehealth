package com.telehealth.consult.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Serializable DTOs that mirror the backend response "views" one-to-one
 * (see ../backend/src/domain/views.ts). Unknown JSON keys are ignored by the
 * shared [com.telehealth.consult.data.Json] instance, so additive backend
 * changes won't break decoding.
 */

enum class Role {
    @SerialName("patient") PATIENT,
    @SerialName("doctor") DOCTOR,
    @SerialName("staff") STAFF,
    @SerialName("admin") ADMIN,
}

@Serializable
data class PublicUser(
    val id: String,
    val role: Role,
    val name: String,
    val email: String,
)

// --- auth -----------------------------------------------------------------

@Serializable
data class LoginRequest(val email: String, val password: String)

@Serializable
data class LoginResponse(val token: String, val user: PublicUser)

// --- users/me -------------------------------------------------------------

@Serializable
data class MeResponse(
    val id: String,
    val role: Role,
    val name: String,
    val email: String,
    val profile: MeProfile? = null,
)

/** Union of doctor/patient profile fields; only the relevant ones are populated. */
@Serializable
data class MeProfile(
    val userId: String? = null,
    val specialty: String? = null,
    val clinicId: String? = null,
    val clinicName: String? = null,
    val mrn: String? = null,
    val dob: String? = null,
)

// --- doctors & slots ------------------------------------------------------

@Serializable
data class DoctorView(
    val userId: String,
    val name: String,
    val email: String? = null,
    val specialty: String,
    val clinicId: String,
    val clinicName: String? = null,
)

@Serializable
data class DoctorsResponse(val doctors: List<DoctorView>)

enum class SlotStatus {
    @SerialName("open") OPEN,
    @SerialName("booked") BOOKED,
}

@Serializable
data class SlotView(
    val id: String,
    val doctorId: String,
    val startsAt: String,
    val durationMin: Int,
    val status: SlotStatus,
)

@Serializable
data class SlotsResponse(val doctorId: String, val slots: List<SlotView>)

@Serializable
data class SlotResponse(val slot: SlotView)

@Serializable
data class CreateSlotRequest(val startsAt: String, val durationMin: Int)

@Serializable
data class PatchSlotRequest(val status: SlotStatus)

// --- appointments ---------------------------------------------------------

enum class AppointmentStatus {
    @SerialName("scheduled") SCHEDULED,
    @SerialName("in_progress") IN_PROGRESS,
    @SerialName("completed") COMPLETED,
    @SerialName("cancelled") CANCELLED,
}

@Serializable
data class ApptPatient(
    val userId: String,
    val name: String? = null,
    val email: String? = null,
    val mrn: String? = null,
    val dob: String? = null,
)

@Serializable
data class ApptDoctor(
    val userId: String,
    val name: String? = null,
    val email: String? = null,
    val specialty: String? = null,
    val clinicId: String? = null,
    val clinicName: String? = null,
)

@Serializable
data class AppointmentView(
    val id: String,
    val status: AppointmentStatus,
    val reason: String,
    val createdAt: String,
    val updatedAt: String,
    val slotId: String,
    val startsAt: String? = null,
    val durationMin: Int? = null,
    val patient: ApptPatient,
    val doctor: ApptDoctor,
    // Phase B seam: exactly the two CometChat 1:1 participants for this consult.
    val participants: List<String> = emptyList(),
)

@Serializable
data class AppointmentsResponse(val appointments: List<AppointmentView>)

@Serializable
data class AppointmentResponse(val appointment: AppointmentView)

@Serializable
data class BookAppointmentRequest(
    val doctorId: String,
    val slotId: String,
    val reason: String,
)

@Serializable
data class PatchAppointmentRequest(
    val status: AppointmentStatus? = null,
    val doctorId: String? = null,
    val slotId: String? = null,
    val reason: String? = null,
)

// --- consultation notes ---------------------------------------------------

@Serializable
data class NoteView(
    val id: String,
    val appointmentId: String,
    val doctorId: String,
    val authorName: String,
    val body: String,
    val createdAt: String,
)

@Serializable
data class NotesResponse(val notes: List<NoteView>)

@Serializable
data class NoteResponse(val note: NoteView)

@Serializable
data class CreateNoteRequest(val body: String)

// --- clinics (admin) ------------------------------------------------------

@Serializable
data class Clinic(val id: String, val name: String, val address: String)

@Serializable
data class ClinicsResponse(val clinics: List<Clinic>)

@Serializable
data class ClinicResponse(val clinic: Clinic)

@Serializable
data class ClinicRequest(val name: String, val address: String)

// --- admin users & audit --------------------------------------------------

@Serializable
data class UsersResponse(val users: List<PublicUser>)

@Serializable
data class CreateUserRequest(
    val role: Role,
    val name: String,
    val email: String,
    val password: String,
    val specialty: String? = null,
    val clinicId: String? = null,
    val mrn: String? = null,
    val dob: String? = null,
)

@Serializable
data class AuditEntry(
    val id: String,
    val at: String,
    val actorId: String? = null,
    val actorRole: Role? = null,
    val action: String,
    val target: String,
    val detail: String? = null,
)

@Serializable
data class AuditResponse(val entries: List<AuditEntry>)

// --- error envelope -------------------------------------------------------

@Serializable
data class ApiErrorBody(val error: ApiErrorDetail)

@Serializable
data class ApiErrorDetail(
    val code: String,
    val message: String,
    val details: List<ApiErrorField>? = null,
)

@Serializable
data class ApiErrorField(val path: String, val message: String)
