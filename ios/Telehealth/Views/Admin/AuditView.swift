import SwiftUI

/// Admin audit trail (`GET /admin/audit`). Read-only oversight of every mutating
/// action — logins, bookings, status changes, notes authored, CRUD.
struct AuditView: View {
    @State private var entries: [AuditEntry] = []
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
                    if entries.isEmpty {
                        EmptyStateView(systemImage: "list.bullet.rectangle",
                                       title: "No audit entries")
                    } else {
                        list
                    }
                }
            }
            .navigationTitle("Audit Log")
            .task { await load() }
        }
    }

    private var list: some View {
        List(entries) { entry in
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(entry.action).font(.headline)
                    Spacer()
                    if let role = entry.actorRole {
                        RoleTag(role: role)
                    }
                }
                Text(entry.target).font(.subheadline).foregroundStyle(.secondary)
                if let detail = entry.detail, !detail.isEmpty {
                    Text(detail).font(.caption).foregroundStyle(.secondary)
                }
                Text(DateFormat.short(entry.at))
                    .font(.caption2).foregroundStyle(.tertiary)
            }
            .padding(.vertical, 2)
        }
        .refreshable { await load() }
    }

    private func load() async {
        do {
            entries = try await api.audit(limit: 200)
            loadState = .loaded
        } catch let error as APIError {
            loadState = .failed(error.errorDescription ?? "Failed to load.")
        } catch {
            loadState = .failed(error.localizedDescription)
        }
    }
}
