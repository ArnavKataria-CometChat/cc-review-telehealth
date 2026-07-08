import SwiftUI

/// A doctor's profile + bookable open slots. Booking an open slot creates an
/// appointment (`POST /appointments`).
struct DoctorDetailView: View {
    let doctor: Doctor

    @State private var slots: [Slot] = []
    @State private var loadState: LoadState = .loading
    @State private var bookingSlot: Slot?

    private enum LoadState: Equatable { case loading, loaded, failed(String) }
    private var api: APIClient { .shared }

    var body: some View {
        List {
            Section("Doctor") {
                DetailRow(label: "Name", value: doctor.name)
                DetailRow(label: "Specialty", value: doctor.specialty)
                if let clinic = doctor.clinicName {
                    DetailRow(label: "Clinic", value: clinic)
                }
            }

            Section("Open Slots") {
                switch loadState {
                case .loading:
                    ProgressView()
                case let .failed(message):
                    Text(message).foregroundStyle(.red).font(.subheadline)
                case .loaded:
                    if slots.isEmpty {
                        Text("No open slots right now.").foregroundStyle(.secondary)
                    } else {
                        ForEach(slots) { slot in
                            Button {
                                bookingSlot = slot
                            } label: {
                                HStack {
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(DateFormat.medium(slot.startsAt))
                                            .foregroundStyle(.primary)
                                        Text("\(slot.durationMin) min")
                                            .font(.caption).foregroundStyle(.secondary)
                                    }
                                    Spacer()
                                    Image(systemName: "chevron.right")
                                        .font(.caption).foregroundStyle(.secondary)
                                }
                            }
                        }
                    }
                }
            }
        }
        .navigationTitle(doctor.name)
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
        .sheet(item: $bookingSlot) { slot in
            BookAppointmentSheet(doctor: doctor, slot: slot) {
                // Rebook removed the slot from "open"; refresh the list.
                Task { await load() }
            }
        }
    }

    private func load() async {
        do {
            slots = try await api.slots(doctorId: doctor.userId, status: "open")
            loadState = .loaded
        } catch let error as APIError {
            loadState = .failed(error.errorDescription ?? "Failed to load.")
        } catch {
            loadState = .failed(error.localizedDescription)
        }
    }
}

/// Reason-for-visit form that finalizes a booking.
private struct BookAppointmentSheet: View {
    let doctor: Doctor
    let slot: Slot
    var onBooked: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var reason = ""
    @State private var submitting = false
    @State private var error: String?
    @State private var booked = false

    private var api: APIClient { .shared }

    var body: some View {
        NavigationStack {
            Form {
                if booked {
                    Section {
                        Label("Appointment booked", systemImage: "checkmark.seal.fill")
                            .foregroundStyle(.green)
                    }
                } else {
                    Section("Appointment") {
                        DetailRow(label: "Doctor", value: doctor.name)
                        DetailRow(label: "When", value: DateFormat.medium(slot.startsAt))
                        DetailRow(label: "Duration", value: "\(slot.durationMin) min")
                    }
                    Section("Reason for visit") {
                        TextField("Describe your symptoms or reason…",
                                  text: $reason, axis: .vertical)
                            .lineLimit(3...6)
                    }
                    if let error {
                        Section { Text(error).foregroundStyle(.red).font(.subheadline) }
                    }
                }
            }
            .navigationTitle("Book Consult")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(booked ? "Done" : "Cancel") { dismiss() }
                }
                if !booked {
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Book") { Task { await book() } }
                            .disabled(submitting || reason.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    }
                }
            }
        }
    }

    private func book() async {
        submitting = true
        error = nil
        do {
            _ = try await api.book(
                doctorId: doctor.userId,
                slotId: slot.id,
                reason: reason.trimmingCharacters(in: .whitespacesAndNewlines))
            booked = true
            onBooked()
        } catch let e as APIError {
            error = e.errorDescription
        } catch {
            self.error = error.localizedDescription
        }
        submitting = false
    }
}
