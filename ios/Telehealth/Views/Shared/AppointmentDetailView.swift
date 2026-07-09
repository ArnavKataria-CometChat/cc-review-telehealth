import SwiftUI

/// The appointment detail screen — the hub of the product and the Phase B
/// integration point. Adapts its actions to the viewer's role and the
/// appointment's status, exactly mirroring the backend transition table.
struct AppointmentDetailView: View {
    let appointmentId: String
    /// Called after any mutation so the presenting list can refresh.
    var onUpdate: ((Appointment) -> Void)? = nil

    @EnvironmentObject private var session: SessionStore

    @State private var appointment: Appointment?
    @State private var notes: [ConsultationNote] = []
    @State private var loadState: LoadState = .loading
    @State private var actionError: String?
    @State private var showReassign = false
    @State private var noteDraft = ""
    @State private var submittingNote = false

    private enum LoadState { case loading, loaded, failed(String) }

    private var api: APIClient { .shared }
    private var role: Role? { session.role }
    private var myId: String? { session.user?.id }

    var body: some View {
        Group {
            switch loadState {
            case .loading:
                LoadingView()
            case let .failed(message):
                ErrorStateView(message: message) { Task { await load() } }
            case .loaded:
                if let appointment {
                    content(appointment)
                } else {
                    EmptyStateView(systemImage: "calendar", title: "Not found")
                }
            }
        }
        .navigationTitle("Appointment")
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
        .sheet(isPresented: $showReassign) {
            if let appointment {
                ReassignSheet(appointment: appointment) { updated in
                    apply(updated)
                }
                .environmentObject(session)
            }
        }
    }

    // MARK: - Content

    private func content(_ appt: Appointment) -> some View {
        Form {
            if let actionError {
                Section {
                    Text(actionError).font(.subheadline).foregroundStyle(.red)
                }
            }

            Section {
                HStack {
                    Text("Status")
                    Spacer()
                    AppointmentStatusBadge(status: appt.status)
                }
                DetailRow(label: "When", value: DateFormat.medium(appt.startsAt))
                if let mins = appt.durationMin {
                    DetailRow(label: "Duration", value: "\(mins) min")
                }
            }

            Section("Participants") {
                DetailRow(label: "Patient", value: appt.patient.displayName)
                DetailRow(label: "Doctor", value: appt.doctor.displayName)
                if let specialty = appt.doctor.specialty {
                    DetailRow(label: "Specialty", value: specialty)
                }
                if let clinic = appt.doctor.clinicName {
                    DetailRow(label: "Clinic", value: clinic)
                }
            }

            Section("Reason for visit") {
                Text(appt.reason)
            }

            consultRoomSection(appt)

            notesSection(appt)

            actionsSection(appt)
        }
        .refreshable { await load() }
    }

    // MARK: - Phase B seam: consult room

    /// The 1:1 video + chat surface. Phase B renders a CometChat call +
    /// conversation scoped to the appointment's patient ↔ doctor pair. Only
    /// those two participants see it; staff have no clinical chat and admins
    /// audit conversation metadata server-side (not as a participant), so the
    /// section is hidden for them.
    @ViewBuilder
    private func consultRoomSection(_ appt: Appointment) -> some View {
        let isParticipant = role == .patient || role == .doctor
        if isParticipant {
            Section("Consult Room") {
                if appt.status == .inProgress {
                    Label("Consult in progress", systemImage: "waveform.badge.mic")
                        .foregroundStyle(.green)
                }
                ConsultRoomView(appointment: appt)
                    .environmentObject(session)
            }
        }
    }

    // MARK: - Notes

    @ViewBuilder
    private func notesSection(_ appt: Appointment) -> some View {
        // Participants + staff/admin can read notes; only the treating doctor writes.
        Section("Consultation Notes") {
            if notes.isEmpty {
                Text("No notes yet.").foregroundStyle(.secondary)
            } else {
                ForEach(notes) { note in
                    VStack(alignment: .leading, spacing: 4) {
                        Text(note.body)
                        HStack {
                            Text(note.authorName)
                            Spacer()
                            Text(DateFormat.short(note.createdAt))
                        }
                        .font(.caption).foregroundStyle(.secondary)
                    }
                    .padding(.vertical, 2)
                }
            }

            if canWriteNote(appt) {
                VStack(alignment: .leading, spacing: 8) {
                    TextField("Write a consult note…", text: $noteDraft, axis: .vertical)
                        .lineLimit(3...6)
                    Button {
                        Task { await submitNote(appt) }
                    } label: {
                        if submittingNote {
                            ProgressView()
                        } else {
                            Label("Add Note", systemImage: "square.and.pencil")
                        }
                    }
                    .disabled(submittingNote || noteDraft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            } else if role == .staff || role == .admin {
                Text("Read-only: staff and admin can audit notes but not author them.")
                    .font(.footnote).foregroundStyle(.secondary)
            }
        }
    }

    // MARK: - Actions

    @ViewBuilder
    private func actionsSection(_ appt: Appointment) -> some View {
        let actions = availableActions(appt)
        if !actions.isEmpty {
            Section("Actions") {
                ForEach(actions, id: \.title) { action in
                    AsyncButton(role: action.destructive ? .destructive : nil) {
                        await action.run()
                    } label: {
                        Label(action.title, systemImage: action.icon)
                    }
                }
            }
        }
    }

    private struct ApptAction {
        let title: String
        let icon: String
        var destructive = false
        let run: () async -> Void
    }

    /// Client-side mirror of the backend transition table + coordinator powers.
    private func availableActions(_ appt: Appointment) -> [ApptAction] {
        guard let role, let myId else { return [] }
        var actions: [ApptAction] = []
        let isTreatingDoctor = role == .doctor && appt.doctor.userId == myId
        let isOwningPatient = role == .patient && appt.patient.userId == myId
        let isCoordinator = role == .staff || role == .admin

        switch appt.status {
        case .scheduled:
            if isTreatingDoctor || role == .admin {
                actions.append(.init(title: "Start Consult", icon: "play.circle.fill") {
                    await transition(appt, to: .inProgress)
                })
            }
            if isCoordinator {
                actions.append(.init(title: "Reassign / Reschedule", icon: "arrow.triangle.swap") {
                    showReassign = true
                })
            }
            if isOwningPatient || isTreatingDoctor || isCoordinator {
                actions.append(.init(title: "Cancel Appointment", icon: "xmark.circle", destructive: true) {
                    await transition(appt, to: .cancelled)
                })
            }
        case .inProgress:
            if isTreatingDoctor || role == .admin {
                actions.append(.init(title: "Complete Consult", icon: "checkmark.circle.fill") {
                    await transition(appt, to: .completed)
                })
            }
            if isTreatingDoctor || isCoordinator {
                actions.append(.init(title: "Cancel Appointment", icon: "xmark.circle", destructive: true) {
                    await transition(appt, to: .cancelled)
                })
            }
        case .completed, .cancelled:
            break
        }
        return actions
    }

    private func canWriteNote(_ appt: Appointment) -> Bool {
        role == .doctor && appt.doctor.userId == myId
    }

    // MARK: - Data / mutations

    private func load() async {
        do {
            async let apptTask = api.appointment(id: appointmentId)
            let loaded = try await apptTask
            appointment = loaded
            loadState = .loaded
            // Notes require view access; fetch after the appointment resolves.
            notes = (try? await api.notes(appointmentId: appointmentId)) ?? []
        } catch let error as APIError {
            loadState = .failed(error.errorDescription ?? "Failed to load.")
        } catch {
            loadState = .failed(error.localizedDescription)
        }
    }

    private func apply(_ updated: Appointment) {
        appointment = updated
        onUpdate?(updated)
    }

    private func transition(_ appt: Appointment, to status: AppointmentStatus) async {
        actionError = nil
        do {
            let updated = try await api.setAppointmentStatus(id: appt.id, status: status)
            apply(updated)
        } catch let error as APIError {
            actionError = error.errorDescription
        } catch {
            actionError = error.localizedDescription
        }
    }

    private func submitNote(_ appt: Appointment) async {
        let text = noteDraft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        submittingNote = true
        actionError = nil
        do {
            let note = try await api.addNote(appointmentId: appt.id, body: text)
            notes.insert(note, at: 0)
            noteDraft = ""
        } catch let error as APIError {
            actionError = error.errorDescription
        } catch {
            actionError = error.localizedDescription
        }
        submittingNote = false
    }
}
