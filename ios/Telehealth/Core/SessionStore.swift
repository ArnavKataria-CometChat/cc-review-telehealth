import Foundation
import SwiftUI

/// Holds the authenticated session and drives top-level routing.
///
/// The JWT + public user are persisted to `UserDefaults` so a warm launch skips
/// the login screen; on launch we re-validate against `GET /users/me` and drop
/// the session if the backend rejects the token.
@MainActor
final class SessionStore: ObservableObject {

    enum Phase: Equatable {
        case loading      // restoring a persisted session
        case signedOut
        case signedIn
    }

    @Published private(set) var phase: Phase = .loading
    @Published private(set) var user: PublicUser?
    @Published private(set) var me: Me?

    private let api = APIClient.shared
    private let defaults = UserDefaults.standard
    private let tokenKey = "telehealth.token"
    private let userKey = "telehealth.user"

    var role: Role? { user?.role }

    init() {
        // Route 401s from anywhere in the app back to sign-out.
        api.onUnauthorized = { [weak self] in
            Task { @MainActor in self?.signOut() }
        }
    }

    /// Restore a persisted token and confirm it's still valid.
    func bootstrap() async {
        guard
            let token = defaults.string(forKey: tokenKey),
            let data = defaults.data(forKey: userKey),
            let saved = try? JSONDecoder().decode(PublicUser.self, from: data)
        else {
            phase = .signedOut
            return
        }
        api.token = token
        user = saved
        do {
            me = try await api.me()
            phase = .signedIn
        } catch {
            // Token expired / invalid — start fresh at login.
            signOut()
        }
    }

    /// Exchange credentials for a session.
    func login(email: String, password: String) async throws {
        let res = try await api.login(email: email, password: password)
        api.token = res.token
        user = res.user
        defaults.set(res.token, forKey: tokenKey)
        if let encoded = try? JSONEncoder().encode(res.user) {
            defaults.set(encoded, forKey: userKey)
        }
        // Load the role profile; non-fatal if it fails.
        me = try? await api.me()
        phase = .signedIn
    }

    func signOut() {
        api.token = nil
        user = nil
        me = nil
        defaults.removeObject(forKey: tokenKey)
        defaults.removeObject(forKey: userKey)
        phase = .signedOut
    }
}
