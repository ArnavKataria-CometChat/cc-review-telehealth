import Foundation

/// Shared date parsing/formatting for the ISO-8601 timestamps the backend emits.
enum DateFormat {
    private static let isoWithFraction: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()

    private static let iso: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f
    }()

    static func parse(_ raw: String?) -> Date? {
        guard let raw else { return nil }
        return isoWithFraction.date(from: raw) ?? iso.date(from: raw)
    }

    /// e.g. "Tue, Jul 8 · 2:30 PM"
    static func medium(_ raw: String?) -> String {
        guard let date = parse(raw) else { return raw ?? "—" }
        let f = DateFormatter()
        f.dateFormat = "EEE, MMM d · h:mm a"
        return f.string(from: date)
    }

    /// e.g. "Jul 8, 2:30 PM"
    static func short(_ raw: String?) -> String {
        guard let date = parse(raw) else { return raw ?? "—" }
        let f = DateFormatter()
        f.dateFormat = "MMM d, h:mm a"
        return f.string(from: date)
    }

    /// A relative-ish day label, e.g. "Today", "Tomorrow", or "Jul 10".
    static func dayLabel(_ raw: String?) -> String {
        guard let date = parse(raw) else { return "—" }
        let cal = Calendar.current
        if cal.isDateInToday(date) { return "Today" }
        if cal.isDateInTomorrow(date) { return "Tomorrow" }
        if cal.isDateInYesterday(date) { return "Yesterday" }
        let f = DateFormatter()
        f.dateFormat = "EEE, MMM d"
        return f.string(from: date)
    }
}
