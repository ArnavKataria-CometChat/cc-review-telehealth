import SwiftUI

struct PatientHomeView: View {
    var body: some View {
        TabView {
            DoctorBrowseView()
                .tabItem { Label("Find Care", systemImage: "stethoscope") }
            MyAppointmentsView()
                .tabItem { Label("Appointments", systemImage: "calendar") }
            ProfileView()
                .tabItem { Label("Account", systemImage: "person.crop.circle") }
        }
    }
}
