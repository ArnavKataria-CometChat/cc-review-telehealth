import SwiftUI

struct AdminHomeView: View {
    var body: some View {
        TabView {
            ClinicsView()
                .tabItem { Label("Clinics", systemImage: "building.2") }
            UsersView()
                .tabItem { Label("Users", systemImage: "person.3") }
            AuditView()
                .tabItem { Label("Audit", systemImage: "list.bullet.rectangle") }
            ProfileView()
                .tabItem { Label("Account", systemImage: "person.crop.circle") }
        }
    }
}
