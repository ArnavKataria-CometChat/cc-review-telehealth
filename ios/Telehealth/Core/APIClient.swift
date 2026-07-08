import Foundation

/// Thin async wrapper over the telehealth REST backend (`../backend`, Express).
///
/// Responsibilities:
///  - attaches the Bearer session token to every authenticated request,
///  - encodes/decodes JSON,
///  - normalizes the backend error envelope into `APIError`,
///  - reports 401s so the session layer can log the user out.
final class APIClient {
    static let shared = APIClient()

    private let baseURL: URL
    private let session: URLSession
    private let decoder = JSONDecoder()
    private let encoder = JSONEncoder()

    /// The current Bearer token, set by the session layer after login.
    var token: String?

    /// Invoked (on the main queue) whenever the backend answers 401, so the
    /// session can be torn down and the user routed back to login.
    var onUnauthorized: (() -> Void)?

    init(baseURL: URL = AppConfig.apiBaseURL, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.session = session
    }

    // MARK: - Core request

    /// Perform a request and decode the JSON body into `T`.
    func request<T: Decodable>(
        _ method: String,
        _ path: String,
        query: [URLQueryItem] = [],
        body: Encodable? = nil,
        authorized: Bool = true
    ) async throws -> T {
        let data = try await perform(method, path, query: query, body: body, authorized: authorized)
        do {
            return try decoder.decode(T.self, from: data)
        } catch {
            throw APIError.decoding(String(describing: error))
        }
    }

    /// Perform a request that returns no decodable body (e.g. 204 responses).
    @discardableResult
    func requestVoid(
        _ method: String,
        _ path: String,
        query: [URLQueryItem] = [],
        body: Encodable? = nil,
        authorized: Bool = true
    ) async throws -> Data {
        try await perform(method, path, query: query, body: body, authorized: authorized)
    }

    private func perform(
        _ method: String,
        _ path: String,
        query: [URLQueryItem],
        body: Encodable?,
        authorized: Bool
    ) async throws -> Data {
        guard var components = URLComponents(
            url: baseURL.appendingPathComponent(path.trimmingLeadingSlash),
            resolvingAgainstBaseURL: false
        ) else {
            throw APIError.invalidResponse
        }
        if !query.isEmpty { components.queryItems = query }
        guard let url = components.url else { throw APIError.invalidResponse }

        var req = URLRequest(url: url)
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Accept")

        if authorized, let token {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        if let body {
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try encoder.encode(AnyEncodable(body))
        }

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: req)
        } catch {
            throw APIError.transport(error.localizedDescription)
        }

        guard let http = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        guard (200..<300).contains(http.statusCode) else {
            if http.statusCode == 401 {
                let handler = onUnauthorized
                DispatchQueue.main.async { handler?() }
            }
            throw Self.decodeError(status: http.statusCode, data: data)
        }
        return data
    }

    private static func decodeError(status: Int, data: Data) -> APIError {
        if let envelope = try? JSONDecoder().decode(APIErrorEnvelope.self, from: data) {
            var message = envelope.error.message
            if let details = envelope.error.details, !details.isEmpty {
                let joined = details.map { "\($0.path): \($0.message)" }.joined(separator: "; ")
                message += " (\(joined))"
            }
            return .http(status: status, code: envelope.error.code, message: message)
        }
        return .http(status: status, code: "error", message: "Request failed (\(status)).")
    }
}

// MARK: - Encoding helpers

/// Type-erases an `Encodable` so heterogeneous request bodies share one code path.
private struct AnyEncodable: Encodable {
    private let encodeFunc: (Encoder) throws -> Void
    init(_ wrapped: Encodable) {
        encodeFunc = wrapped.encode
    }
    func encode(to encoder: Encoder) throws {
        try encodeFunc(encoder)
    }
}

private extension String {
    var trimmingLeadingSlash: String {
        hasPrefix("/") ? String(dropFirst()) : self
    }
}
