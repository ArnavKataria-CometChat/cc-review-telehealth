import Foundation

// MARK: - Request bodies

struct LoginRequest: Encodable {
    let email: String
    let password: String
}

struct BookRequest: Encodable {
    let doctorId: String
    let slotId: String
    let reason: String
}

/// PATCH /appointments/:id — every field optional; nils are omitted by the
/// synthesized encoder so we only send what changed.
struct PatchAppointmentRequest: Encodable {
    var status: String?
    var doctorId: String?
    var slotId: String?
    var reason: String?
}

struct NoteRequest: Encodable {
    let body: String
}

struct CreateSlotRequest: Encodable {
    let startsAt: String
    let durationMin: Int
}

struct PatchSlotRequest: Encodable {
    let status: String
}

struct ClinicRequest: Encodable {
    let name: String
    let address: String
}

/// POST /admin/users — role-discriminated on the backend. Nil fields are omitted,
/// so a `staff`/`admin` body carries only name/email/password while a `doctor`
/// body adds specialty/clinicId and a `patient` body adds mrn/dob.
struct CreateUserRequest: Encodable {
    let role: String
    let name: String
    let email: String
    let password: String
    var specialty: String?
    var clinicId: String?
    var mrn: String?
    var dob: String?
}

// MARK: - Response envelopes

struct LoginResponse: Decodable {
    let token: String
    let user: PublicUser
}

struct DoctorsResponse: Decodable { let doctors: [Doctor] }
struct SlotsResponse: Decodable { let doctorId: String; let slots: [Slot] }
struct SlotResponse: Decodable { let slot: Slot }
struct AppointmentsResponse: Decodable { let appointments: [Appointment] }
struct AppointmentResponse: Decodable { let appointment: Appointment }
struct NotesResponse: Decodable { let notes: [ConsultationNote] }
struct NoteResponse: Decodable { let note: ConsultationNote }
struct ClinicsResponse: Decodable { let clinics: [Clinic] }
struct ClinicResponse: Decodable { let clinic: Clinic }
struct UsersResponse: Decodable { let users: [PublicUser] }
struct UserCreateResponse: Decodable { let user: PublicUser; let profile: Doctor? }
struct AuditResponse: Decodable { let entries: [AuditEntry] }

// MARK: - Typed endpoints
//
// One method per backend route. Query filters map to `?specialty=` etc.

extension APIClient {

    // Auth & identity
    func login(email: String, password: String) async throws -> LoginResponse {
        try await request("POST", "/auth/login",
                          body: LoginRequest(email: email, password: password),
                          authorized: false)
    }

    func me() async throws -> Me {
        try await request("GET", "/users/me")
    }

    // Doctors & slots
    func doctors(specialty: String? = nil, clinicId: String? = nil) async throws -> [Doctor] {
        var q: [URLQueryItem] = []
        if let specialty, !specialty.isEmpty { q.append(.init(name: "specialty", value: specialty)) }
        if let clinicId, !clinicId.isEmpty { q.append(.init(name: "clinicId", value: clinicId)) }
        let res: DoctorsResponse = try await request("GET", "/doctors", query: q)
        return res.doctors
    }

    func slots(doctorId: String, status: String? = nil) async throws -> [Slot] {
        var q: [URLQueryItem] = []
        if let status, !status.isEmpty { q.append(.init(name: "status", value: status)) }
        let res: SlotsResponse = try await request("GET", "/doctors/\(doctorId)/slots", query: q)
        return res.slots
    }

    func createSlot(doctorId: String, startsAt: String, durationMin: Int) async throws -> Slot {
        let res: SlotResponse = try await request(
            "POST", "/doctors/\(doctorId)/slots",
            body: CreateSlotRequest(startsAt: startsAt, durationMin: durationMin))
        return res.slot
    }

    func setSlotStatus(slotId: String, status: SlotStatus) async throws -> Slot {
        let res: SlotResponse = try await request(
            "PATCH", "/slots/\(slotId)", body: PatchSlotRequest(status: status.rawValue))
        return res.slot
    }

    // Appointments
    func appointments(status: String? = nil) async throws -> [Appointment] {
        var q: [URLQueryItem] = []
        if let status, !status.isEmpty { q.append(.init(name: "status", value: status)) }
        let res: AppointmentsResponse = try await request("GET", "/appointments", query: q)
        return res.appointments
    }

    func appointment(id: String) async throws -> Appointment {
        let res: AppointmentResponse = try await request("GET", "/appointments/\(id)")
        return res.appointment
    }

    func book(doctorId: String, slotId: String, reason: String) async throws -> Appointment {
        let res: AppointmentResponse = try await request(
            "POST", "/appointments",
            body: BookRequest(doctorId: doctorId, slotId: slotId, reason: reason))
        return res.appointment
    }

    func patchAppointment(id: String, _ patch: PatchAppointmentRequest) async throws -> Appointment {
        let res: AppointmentResponse = try await request("PATCH", "/appointments/\(id)", body: patch)
        return res.appointment
    }

    func setAppointmentStatus(id: String, status: AppointmentStatus) async throws -> Appointment {
        try await patchAppointment(id: id, PatchAppointmentRequest(status: status.rawValue))
    }

    // Consultation notes
    func notes(appointmentId: String) async throws -> [ConsultationNote] {
        let res: NotesResponse = try await request("GET", "/appointments/\(appointmentId)/notes")
        return res.notes
    }

    func addNote(appointmentId: String, body: String) async throws -> ConsultationNote {
        let res: NoteResponse = try await request(
            "POST", "/appointments/\(appointmentId)/notes", body: NoteRequest(body: body))
        return res.note
    }

    // Clinics (admin)
    func clinics() async throws -> [Clinic] {
        let res: ClinicsResponse = try await request("GET", "/clinics")
        return res.clinics
    }

    func createClinic(name: String, address: String) async throws -> Clinic {
        let res: ClinicResponse = try await request(
            "POST", "/clinics", body: ClinicRequest(name: name, address: address))
        return res.clinic
    }

    func updateClinic(id: String, name: String, address: String) async throws -> Clinic {
        let res: ClinicResponse = try await request(
            "PATCH", "/clinics/\(id)", body: ClinicRequest(name: name, address: address))
        return res.clinic
    }

    func deleteClinic(id: String) async throws {
        try await requestVoid("DELETE", "/clinics/\(id)")
    }

    // Admin: users & audit
    func adminUsers(role: String? = nil) async throws -> [PublicUser] {
        var q: [URLQueryItem] = []
        if let role, !role.isEmpty { q.append(.init(name: "role", value: role)) }
        let res: UsersResponse = try await request("GET", "/admin/users", query: q)
        return res.users
    }

    func createUser(_ req: CreateUserRequest) async throws -> UserCreateResponse {
        try await request("POST", "/admin/users", body: req)
    }

    func audit(limit: Int = 200) async throws -> [AuditEntry] {
        let res: AuditResponse = try await request(
            "GET", "/admin/audit", query: [.init(name: "limit", value: String(limit))])
        return res.entries
    }
}
