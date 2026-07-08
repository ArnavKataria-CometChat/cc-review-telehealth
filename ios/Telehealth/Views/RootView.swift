import SwiftUI

/// Top-level router. Chooses login vs. a role-specific home once the session
/// phase resolves. Every screen below here is only reachable with a valid,
/// role-bearing session — the client mirror of the backend's RBAC.
struct RootView: View {
    @EnvironmentObject private var session: SessionStore

    var body: some View {
        switch session.phase {
        case .loading:
            LoadingView(label: "Starting…")
        case .signedOut:
            LoginView()
        case .signedIn:
            if let role = session.role {
                home(for: role)
            } else {
                LoadingView()
            }
        }
    }

    @ViewBuilder
    private func home(for role: Role) -> some View {
        switch role {
        case .patient: PatientHomeView()
        case .doctor: DoctorHomeView()
        case .staff: StaffHomeView()
        case .admin: AdminHomeView()
        }
    }
}
