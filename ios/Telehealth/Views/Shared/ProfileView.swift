import SwiftUI

/// Account tab shared by every role: identity, role profile, and sign-out.
struct ProfileView: View {
    @EnvironmentObject private var session: SessionStore

    var body: some View {
        NavigationStack {
            List {
                if let user = session.user {
                    Section("Account") {
                        DetailRow(label: "Name", value: user.name)
                        DetailRow(label: "Email", value: user.email)
                        HStack {
                            Text("Role").foregroundStyle(.secondary)
                            Spacer()
                            RoleTag(role: user.role)
                        }
                        DetailRow(label: "User ID", value: user.id)
                    }
                }

                if let profile = session.me?.profile {
                    Section("Profile") {
                        if let specialty = profile.specialty {
                            DetailRow(label: "Specialty", value: specialty)
                        }
                        if let clinic = profile.clinicName {
                            DetailRow(label: "Clinic", value: clinic)
                        }
                        if let mrn = profile.mrn {
                            DetailRow(label: "MRN", value: mrn)
                        }
                        if let dob = profile.dob {
                            DetailRow(label: "Date of Birth", value: dob)
                        }
                    }
                }

                Section {
                    Button("Sign Out", role: .destructive) {
                        session.signOut()
                    }
                }

                Section {
                    Text("Secure 1:1 chat and video calling arrive in Phase B (CometChat), scoped to each appointment's patient and doctor.")
                        .font(.footnote).foregroundStyle(.secondary)
                }
            }
            .navigationTitle("Account")
        }
    }
}
