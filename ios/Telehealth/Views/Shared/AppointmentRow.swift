import SwiftUI

/// Compact appointment cell used in every role's list. `counterparty` picks
/// which side to headline (a patient sees the doctor, a doctor sees the patient).
struct AppointmentRow: View {
    let appointment: Appointment
    let counterparty: Counterparty

    enum Counterparty { case doctor, patient, both }

    private var title: String {
        switch counterparty {
        case .doctor: return appointment.doctor.displayName
        case .patient: return appointment.patient.displayName
        case .both:
            return "\(appointment.patient.displayName) → \(appointment.doctor.displayName)"
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(title).font(.headline)
                Spacer()
                AppointmentStatusBadge(status: appointment.status)
            }
            Text(appointment.reason)
                .font(.subheadline).foregroundStyle(.secondary)
                .lineLimit(1)
            Label(DateFormat.medium(appointment.startsAt), systemImage: "clock")
                .font(.caption).foregroundStyle(.secondary)
        }
        .padding(.vertical, 4)
    }
}
