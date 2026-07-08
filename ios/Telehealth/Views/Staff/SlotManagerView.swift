import SwiftUI

/// Staff/admin schedule manager: pick a doctor, view their slots, create new
/// slots, and open/close existing ones.
struct SlotManagerView: View {
    @State private var doctors: [Doctor] = []
    @State private var selectedDoctorId: String = ""
    @State private var slots: [Slot] = []
    @State private var loadState: LoadState = .loading
    @State private var slotsLoading = false
    @State private var showCreate = false
    @State private var actionError: String?

    private enum LoadState: Equatable { case loading, loaded, failed(String) }
    private var api: APIClient { .shared }

    private var selectedDoctor: Doctor? {
        doctors.first { $0.userId == selectedDoctorId }
    }

    var body: some View {
        NavigationStack {
            Group {
                switch loadState {
                case .loading:
                    LoadingView()
                case let .failed(message):
                    ErrorStateView(message: message) { Task { await loadDoctors() } }
                case .loaded:
                    content
                }
            }
            .navigationTitle("Slot Manager")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showCreate = true
                    } label: {
                        Image(systemName: "plus")
                    }
                    .disabled(selectedDoctorId.isEmpty)
                }
            }
            .task { await loadDoctors() }
            .sheet(isPresented: $showCreate) {
                if let doctor = selectedDoctor {
                    CreateSlotSheet(doctor: doctor) { Task { await loadSlots() } }
                }
            }
        }
    }

    private var content: some View {
        List {
            Section("Doctor") {
                Picker("Doctor", selection: $selectedDoctorId) {
                    ForEach(doctors) { Text($0.name).tag($0.userId) }
                }
                .onChange(of: selectedDoctorId) { _, _ in Task { await loadSlots() } }
            }

            if let actionError {
                Section { Text(actionError).foregroundStyle(.red).font(.subheadline) }
            }

            Section("Slots") {
                if slotsLoading {
                    ProgressView()
                } else if slots.isEmpty {
                    Text("No slots. Tap + to create one.").foregroundStyle(.secondary)
                } else {
                    ForEach(slots) { slot in
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(DateFormat.medium(slot.startsAt))
                                Text("\(slot.durationMin) min")
                                    .font(.caption).foregroundStyle(.secondary)
                            }
                            Spacer()
                            SlotStatusBadge(status: slot.status)
                            Menu {
                                if slot.status == .open {
                                    Button("Close Slot", role: .destructive) {
                                        Task { await setStatus(slot, .booked) }
                                    }
                                } else {
                                    Button("Reopen Slot") {
                                        Task { await setStatus(slot, .open) }
                                    }
                                }
                            } label: {
                                Image(systemName: "ellipsis.circle")
                            }
                        }
                    }
                }
            }
        }
        .refreshable { await loadSlots() }
    }

    private func loadDoctors() async {
        do {
            doctors = try await api.doctors()
            if selectedDoctorId.isEmpty { selectedDoctorId = doctors.first?.userId ?? "" }
            loadState = .loaded
            await loadSlots()
        } catch let error as APIError {
            loadState = .failed(error.errorDescription ?? "Failed to load.")
        } catch {
            loadState = .failed(error.localizedDescription)
        }
    }

    private func loadSlots() async {
        guard !selectedDoctorId.isEmpty else { slots = []; return }
        slotsLoading = true
        actionError = nil
        do {
            slots = try await api.slots(doctorId: selectedDoctorId)
        } catch let error as APIError {
            actionError = error.errorDescription
        } catch {
            actionError = error.localizedDescription
        }
        slotsLoading = false
    }

    private func setStatus(_ slot: Slot, _ status: SlotStatus) async {
        actionError = nil
        do {
            _ = try await api.setSlotStatus(slotId: slot.id, status: status)
            await loadSlots()
        } catch let error as APIError {
            actionError = error.errorDescription
        } catch {
            actionError = error.localizedDescription
        }
    }
}

/// Create a new open slot for a doctor.
private struct CreateSlotSheet: View {
    let doctor: Doctor
    var onCreated: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var startsAt = Date().addingTimeInterval(3600)
    @State private var durationMin = 30
    @State private var submitting = false
    @State private var error: String?

    private var api: APIClient { .shared }

    var body: some View {
        NavigationStack {
            Form {
                Section("Doctor") {
                    DetailRow(label: "Name", value: doctor.name)
                    DetailRow(label: "Specialty", value: doctor.specialty)
                }
                Section("New Slot") {
                    DatePicker("Starts", selection: $startsAt,
                               in: Date()..., displayedComponents: [.date, .hourAndMinute])
                    Stepper("Duration: \(durationMin) min",
                            value: $durationMin, in: 10...240, step: 5)
                }
                if let error {
                    Section { Text(error).foregroundStyle(.red).font(.subheadline) }
                }
            }
            .navigationTitle("New Slot")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Create") { Task { await create() } }.disabled(submitting)
                }
            }
        }
    }

    private func create() async {
        submitting = true
        error = nil
        // Backend expects an ISO-8601 datetime for startsAt.
        let iso = ISO8601DateFormatter().string(from: startsAt)
        do {
            _ = try await api.createSlot(doctorId: doctor.userId,
                                         startsAt: iso, durationMin: durationMin)
            onCreated()
            dismiss()
        } catch let e as APIError {
            error = e.errorDescription
        } catch {
            self.error = error.localizedDescription
        }
        submitting = false
    }
}
