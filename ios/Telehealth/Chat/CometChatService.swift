#if canImport(CometChatUIKitSwift)
import Foundation
import CometChatUIKitSwift
import CometChatSDK

/// Owns the CometChat session for the telehealth consult surface (Phase B).
///
/// The client never holds a CometChat secret. It fetches a short-lived,
/// backend-minted auth token from `POST /cometchat/token` — which also carries
/// the non-secret App ID + Region — initializes the UI Kit once, and logs in
/// with `login(authToken:)`. Role → CometChat mapping and the RBAC gate on who
/// may converse/call live server-side; this layer only brings up the
/// authenticated session for the currently signed-in app user.
///
/// Guarded by `#if canImport(CometChatUIKitSwift)` so the target still compiles
/// (with chat inert) if built without the CocoaPods dependencies.
@MainActor
final class CometChatService: ObservableObject {

    static let shared = CometChatService()

    enum State: Equatable {
        case signedOut
        case connecting
        case ready(uid: String)
        case failed(String)
    }

    @Published private(set) var state: State = .signedOut

    private var didInit = false
    private let api = APIClient.shared

    private init() {}

    /// Bring up the CometChat session for `appUser`. Idempotent — safe to call
    /// every time the consult room appears.
    @discardableResult
    func connect(appUser: PublicUser) async throws -> String {
        if case let .ready(uid) = state, uid == appUser.id { return uid }
        state = .connecting
        do {
            let token = try await api.cometchatToken()
            try await initializeIfNeeded(appID: token.appId, region: token.region)
            let user = try await login(authToken: token.authToken, expectedUID: token.uid)
            let uid = user.uid ?? token.uid
            state = .ready(uid: uid)
            return uid
        } catch {
            let message = (error as? APIError)?.errorDescription
                ?? (error as? LocalizedError)?.errorDescription
                ?? error.localizedDescription
            state = .failed(message)
            throw error
        }
    }

    /// Tear down the CometChat session. Called on app sign-out so the next user
    /// on the device gets a clean session.
    func disconnect() {
        state = .signedOut
        guard let user = CometChatUIKit.getLoggedInUser() else { return }
        CometChatUIKit.logout(user: user) { _ in }
    }

    /// Resolve a CometChat `User` by UID (the app user id) so the 1:1
    /// conversation / call buttons can be pointed at the appointment peer.
    func fetchUser(uid: String) async throws -> User {
        try await withCheckedThrowingContinuation { continuation in
            CometChat.getUser(UID: uid) { user in
                if let user {
                    continuation.resume(returning: user)
                } else {
                    continuation.resume(throwing: CometChatServiceError.userNotFound(uid))
                }
            } onError: { error in
                continuation.resume(
                    throwing: CometChatServiceError.sdk(error?.errorDescription ?? "Unknown CometChat error"))
            }
        }
    }

    // MARK: - Private

    private func initializeIfNeeded(appID: String, region: String) async throws {
        guard !didInit else { return }
        // No auth key is shipped: login always uses the backend-minted token.
        // `enable(inAppIncomingCall:)` turns on the kit's foreground 1:1
        // incoming-call UI (calling is in scope for the consult).
        let settings = UIKitSettings()
            .set(appID: appID)
            .set(region: region)
            .enable(inAppIncomingCall: true)
            .subscribePresenceForAllUsers()
            .build()

        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            CometChatUIKit(uiKitSettings: settings) { result in
                switch result {
                case .success:
                    continuation.resume(returning: ())
                case .failure(let error):
                    continuation.resume(throwing: error)
                }
            }
        }
        didInit = true
    }

    private func login(authToken: String, expectedUID: String) async throws -> User {
        if let existing = CometChatUIKit.getLoggedInUser() {
            if existing.uid == expectedUID { return existing }
            // A stale session for a different app user — clear it first.
            try await logout(user: existing)
        }
        return try await withCheckedThrowingContinuation { continuation in
            CometChatUIKit.login(authToken: authToken) { status in
                switch status {
                case .success(let user):
                    continuation.resume(returning: user)
                case .onError(let error):
                    continuation.resume(throwing: CometChatServiceError.sdk(error.errorDescription))
                @unknown default:
                    continuation.resume(throwing: CometChatServiceError.sdk("Unknown login result"))
                }
            }
        }
    }

    private func logout(user: User) async throws {
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            CometChatUIKit.logout(user: user) { status in
                switch status {
                case .success:
                    continuation.resume(returning: ())
                case .onError(let error):
                    continuation.resume(throwing: CometChatServiceError.sdk(error.errorDescription))
                @unknown default:
                    continuation.resume(returning: ())
                }
            }
        }
    }
}

enum CometChatServiceError: LocalizedError {
    case userNotFound(String)
    case sdk(String)

    var errorDescription: String? {
        switch self {
        case .userNotFound(let uid): return "CometChat user \(uid) was not found."
        case .sdk(let message): return message
        }
    }
}
#endif
