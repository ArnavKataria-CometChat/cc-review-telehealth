import SwiftUI

struct MyAppointmentsView: View {
    var body: some View {
        AppointmentsListView(
            title: "My Appointments",
            counterparty: .doctor,
            emptyMessage: "Book a consult from Find Care to get started.")
    }
}
