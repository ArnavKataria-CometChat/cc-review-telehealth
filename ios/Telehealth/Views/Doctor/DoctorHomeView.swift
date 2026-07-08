import SwiftUI

struct DoctorHomeView: View {
    var body: some View {
        TabView {
            AppointmentsListView(
                title: "My Schedule",
                counterparty: .patient,
                emptyMessage: "No appointments on your schedule yet.")
                .tabItem { Label("Schedule", systemImage: "calendar") }
            ProfileView()
                .tabItem { Label("Account", systemImage: "person.crop.circle") }
        }
    }
}
