import Foundation

/// App configuration resolved from the environment, not hard-coded.
///
/// The backend base URL is read from the `APIBaseURL` Info.plist key (which
/// defaults to `http://localhost:4000/api`, the local `../backend`). It can be
/// overridden at launch with the `API_BASE_URL` environment variable, which is
/// handy for pointing the simulator at a staging host without a rebuild.
enum AppConfig {
    static let apiBaseURL: URL = {
        if let env = ProcessInfo.processInfo.environment["API_BASE_URL"],
           let url = URL(string: env) {
            return url
        }
        if let raw = Bundle.main.object(forInfoDictionaryKey: "APIBaseURL") as? String,
           let url = URL(string: raw) {
            return url
        }
        // Last-resort fallback so the app is never left without a base URL.
        return URL(string: "http://localhost:4000/api")!
    }()
}
