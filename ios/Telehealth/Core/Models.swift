import Foundation

// MARK: - Roles
//
// Mirrors the backend `Role` union (patient | doctor | staff | admin). Every
// authenticated identity carries a stable server-side id + role; Phase B maps
// these onto CometChat users.

enum Role: String, Codable, CaseIterable, Identifiable {
    case patient
    case doctor
    case staff
    case admin

    var id: String { rawValue }

    var label: String {
        switch self {
        case .patient: return "Patient"
        case .doctor: return "Doctor"
        case .staff: return "Staff"
        case .admin: return "Admin"
        }
    }

    var systemImage: String {
        switch self {
        case .patient: return "person.fill"
        case .doctor: return "stethoscope"
        case .staff: return "calendar.badge.clock"
        case .admin: return "building.2.fill"
        }
    }
}

// MARK: - Users

struct PublicUser: Codable, Identifiable, Hashable {
    let id: String
    let role: Role
    let name: String
    let email: String
}

/// `GET /users/me` — identity + an optional role-specific profile.
struct Me: Codable {
    let id: String
    let role: Role
    let name: String
    let email: String
    let profile: Profile?

    /// The `profile` field is a doctor view, a patient view, or null. Decode it
    /// leniently so either shape (or none) is accepted.
    struct Profile: Codable {
        let specialty: String?
        let clinicId: String?
        let clinicName: String?
        let mrn: String?
        let dob: String?
    }
}

// MARK: - Clinics & directory

struct Clinic: Codable, Identifiable, Hashable {
    let id: String
    let name: String
    let address: String
}

struct Doctor: Codable, Identifiable, Hashable {
    let userId: String
    let name: String
    let email: String?
    let specialty: String
    let clinicId: String
    let clinicName: String?

    var id: String { userId }
}

// MARK: - Slots

enum SlotStatus: String, Codable {
    case open
    case booked
}

struct Slot: Codable, Identifiable, Hashable {
    let id: String
    let doctorId: String
    let startsAt: String
    let durationMin: Int
    let status: SlotStatus
}

// MARK: - Appointments

enum AppointmentStatus: String, Codable {
    case scheduled
    case inProgress = "in_progress"
    case completed
    case cancelled

    var label: String {
        switch self {
        case .scheduled: return "Scheduled"
        case .inProgress: return "In Progress"
        case .completed: return "Completed"
        case .cancelled: return "Cancelled"
        }
    }
}

/// The `patient` / `doctor` embedded on an appointment view can be a full view
/// or a bare `{ userId }` (when the record was pruned). All fields but `userId`
/// are therefore optional.
struct ApptParty: Codable, Hashable {
    let userId: String
    let name: String?
    let email: String?
    let mrn: String?
    let dob: String?
    let specialty: String?
    let clinicId: String?
    let clinicName: String?

    var displayName: String { name ?? "User \(userId.prefix(6))" }
}

struct Appointment: Codable, Identifiable, Hashable {
    let id: String
    let status: AppointmentStatus
    let reason: String
    let createdAt: String
    let updatedAt: String
    let slotId: String
    let startsAt: String?
    let durationMin: Int?
    let patient: ApptParty
    let doctor: ApptParty
    /// Phase B seam: the CometChat 1:1 conversation is scoped to exactly these two.
    let participants: [String]
}

// MARK: - Consultation notes

struct ConsultationNote: Codable, Identifiable, Hashable {
    let id: String
    let appointmentId: String
    let doctorId: String
    let authorName: String
    let body: String
    let createdAt: String
}

// MARK: - Audit

struct AuditEntry: Codable, Identifiable, Hashable {
    let id: String
    let at: String
    let actorId: String?
    let actorRole: Role?
    let action: String
    let target: String
    let detail: String?
}
