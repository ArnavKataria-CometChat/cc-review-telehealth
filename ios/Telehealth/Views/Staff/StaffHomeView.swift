import SwiftUI

struct StaffHomeView: View {
    var body: some View {
        TabView {
            AppointmentsListView(
                title: "All Appointments",
                counterparty: .both,
                emptyMessage: "No appointments to coordinate yet.")
                .tabItem { Label("Appointments", systemImage: "calendar") }
            SlotManagerView()
                .tabItem { Label("Slots", systemImage: "clock.badge.checkmark") }
            ProfileView()
                .tabItem { Label("Account", systemImage: "person.crop.circle") }
        }
    }
}
