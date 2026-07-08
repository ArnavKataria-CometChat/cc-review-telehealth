import SwiftUI

/// Role-scoped appointments list. The backend already scopes `GET /appointments`
/// to the caller (patient→own, doctor→own, staff/admin→all); this view just
/// presents that list with an optional status filter and navigation to detail.
struct AppointmentsListView: View {
    let title: String
    let counterparty: AppointmentRow.Counterparty
    var emptyMessage: String = "You have no appointments yet."

    @State private var appointments: [Appointment] = []
    @State private var statusFilter: StatusFilter = .all
    @State private var loadState: LoadState = .loading

    private enum LoadState: Equatable { case loading, loaded, failed(String) }

    private enum StatusFilter: String, CaseIterable, Identifiable {
        case all, scheduled, in_progress, completed, cancelled
        var id: String { rawValue }
        var label: String {
            switch self {
            case .all: return "All"
            case .scheduled: return "Scheduled"
            case .in_progress: return "In Progress"
            case .completed: return "Completed"
            case .cancelled: return "Cancelled"
            }
        }
        var query: String? { self == .all ? nil : rawValue }
    }

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
                    if appointments.isEmpty {
                        EmptyStateView(systemImage: "calendar.badge.exclamationmark",
                                       title: "Nothing here", message: emptyMessage)
                    } else {
                        list
                    }
                }
            }
            .navigationTitle(title)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        Picker("Status", selection: $statusFilter) {
                            ForEach(StatusFilter.allCases) { Text($0.label).tag($0) }
                        }
                    } label: {
                        Label("Filter", systemImage: "line.3.horizontal.decrease.circle")
                    }
                }
            }
            .onChange(of: statusFilter) { _, _ in Task { await load() } }
            .task { await load() }
        }
    }

    private var list: some View {
        List(appointments) { appt in
            NavigationLink {
                AppointmentDetailView(appointmentId: appt.id) { updated in
                    if let idx = appointments.firstIndex(where: { $0.id == updated.id }) {
                        appointments[idx] = updated
                    }
                }
            } label: {
                AppointmentRow(appointment: appt, counterparty: counterparty)
            }
        }
        .refreshable { await load() }
    }

    private func load() async {
        do {
            appointments = try await api.appointments(status: statusFilter.query)
            loadState = .loaded
        } catch let error as APIError {
            loadState = .failed(error.errorDescription ?? "Failed to load.")
        } catch {
            loadState = .failed(error.localizedDescription)
        }
    }
}
