import SwiftUI

/// Patient "browse doctors" flow with a specialty search filter.
struct DoctorBrowseView: View {
    @State private var doctors: [Doctor] = []
    @State private var specialty = ""
    @State private var loadState: LoadState = .loading

    private enum LoadState: Equatable { case loading, loaded, failed(String) }
    private var api: APIClient { .shared }

    var body: some View {
        NavigationStack {
            Group {
                switch loadState {
                case .loading:
                    LoadingView()
                case let .failed(message):
                    ErrorStateView(message: message) { Task { await load() } }
                case .loaded:
                    if doctors.isEmpty {
                        EmptyStateView(systemImage: "stethoscope",
                                       title: "No doctors found",
                                       message: "Try a different specialty.")
                    } else {
                        list
                    }
                }
            }
            .navigationTitle("Find Care")
            .searchable(text: $specialty, prompt: "Specialty (e.g. Diagnostics)")
            .onSubmit(of: .search) { Task { await load() } }
            .onChange(of: specialty) { _, newValue in
                if newValue.isEmpty { Task { await load() } }
            }
            .task { await load() }
        }
    }

    private var list: some View {
        List(doctors) { doctor in
            NavigationLink(value: doctor) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(doctor.name).font(.headline)
                    Text(doctor.specialty).font(.subheadline).foregroundStyle(.secondary)
                    if let clinic = doctor.clinicName {
                        Label(clinic, systemImage: "building.2")
                            .font(.caption).foregroundStyle(.secondary)
                    }
                }
                .padding(.vertical, 2)
            }
        }
        .navigationDestination(for: Doctor.self) { DoctorDetailView(doctor: $0) }
        .refreshable { await load() }
    }

    private func load() async {
        do {
            doctors = try await api.doctors(specialty: specialty)
            loadState = .loaded
        } catch let error as APIError {
            loadState = .failed(error.errorDescription ?? "Failed to load.")
        } catch {
            loadState = .failed(error.localizedDescription)
        }
    }
}
