import SwiftUI

/// Staff/admin reschedule + reassign flow: pick a doctor and one of their open
/// slots, then PATCH `{ doctorId, slotId }`. Keeping the current doctor and only
/// changing the slot is a reschedule; changing the doctor is a reassignment.
struct ReassignSheet: View {
    let appointment: Appointment
    var onDone: (Appointment) -> Void

    @EnvironmentObject private var session: SessionStore
    @Environment(\.dismiss) private var dismiss

    @State private var doctors: [Doctor] = []
    @State private var selectedDoctorId: String = ""
    @State private var openSlots: [Slot] = []
    @State private var selectedSlotId: String = ""
    @State private var loading = true
    @State private var loadingSlots = false
    @State private var submitting = false
    @State private var error: String?

    private var api: APIClient { .shared }

    var body: some View {
        NavigationStack {
            Form {
                if loading {
                    LoadingView()
                } else {
                    Section("Doctor") {
                        Picker("Doctor", selection: $selectedDoctorId) {
                            ForEach(doctors) { doc in
                                Text(doc.name).tag(doc.userId)
                            }
                        }
                        .onChange(of: selectedDoctorId) { _, _ in
                            Task { await loadSlots() }
                        }
                    }

                    Section("Open Slot") {
                        if loadingSlots {
                            ProgressView()
                        } else if openSlots.isEmpty {
                            Text("No open slots for this doctor.")
                                .foregroundStyle(.secondary)
                        } else {
                            Picker("Slot", selection: $selectedSlotId) {
                                ForEach(openSlots) { slot in
                                    Text(DateFormat.medium(slot.startsAt)).tag(slot.id)
                                }
                            }
                            .pickerStyle(.inline)
                            .labelsHidden()
                        }
                    }

                    if let error {
                        Section { Text(error).foregroundStyle(.red).font(.subheadline) }
                    }
                }
            }
            .navigationTitle("Reassign")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { Task { await submit() } }
                        .disabled(submitting || selectedSlotId.isEmpty)
                }
            }
            .task { await loadDoctors() }
        }
    }

    private func loadDoctors() async {
        do {
            doctors = try await api.doctors()
            selectedDoctorId = appointment.doctor.userId.isEmpty
                ? (doctors.first?.userId ?? "")
                : appointment.doctor.userId
            await loadSlots()
        } catch let e as APIError {
            error = e.errorDescription
        } catch {
            self.error = error.localizedDescription
        }
        loading = false
    }

    private func loadSlots() async {
        guard !selectedDoctorId.isEmpty else { return }
        loadingSlots = true
        do {
            openSlots = try await api.slots(doctorId: selectedDoctorId, status: "open")
            // Preselect the current slot when rescheduling the same doctor.
            if selectedDoctorId == appointment.doctor.userId,
               openSlots.contains(where: { $0.id == appointment.slotId }) {
                selectedSlotId = appointment.slotId
            } else {
                selectedSlotId = openSlots.first?.id ?? ""
            }
        } catch let e as APIError {
            error = e.errorDescription
        } catch {
            self.error = error.localizedDescription
        }
        loadingSlots = false
    }

    private func submit() async {
        submitting = true
        error = nil
        do {
            let patch = PatchAppointmentRequest(
                doctorId: selectedDoctorId,
                slotId: selectedSlotId)
            let updated = try await api.patchAppointment(id: appointment.id, patch)
            onDone(updated)
            dismiss()
        } catch let e as APIError {
            error = e.errorDescription
        } catch {
            self.error = error.localizedDescription
        }
        submitting = false
    }
}
