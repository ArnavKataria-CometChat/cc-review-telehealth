import Foundation

/// The backend's error envelope: `{ "error": { "code", "message", "details"? } }`.
struct APIErrorEnvelope: Decodable {
    struct Body: Decodable {
        let code: String
        let message: String
        let details: [Detail]?
    }
    struct Detail: Decodable {
        let path: String
        let message: String
    }
    let error: Body
}

/// A normalized error surfaced to the UI.
enum APIError: LocalizedError {
    case invalidResponse
    case http(status: Int, code: String, message: String)
    case decoding(String)
    case transport(String)

    var errorDescription: String? {
        switch self {
        case .invalidResponse:
            return "The server returned an unexpected response."
        case let .http(_, _, message):
            return message
        case let .decoding(detail):
            return "Could not read the server response. \(detail)"
        case let .transport(detail):
            return detail
        }
    }

    /// A 401 means the session is no longer valid and the user should re-auth.
    var isUnauthorized: Bool {
        if case let .http(status, _, _) = self { return status == 401 }
        return false
    }
}
