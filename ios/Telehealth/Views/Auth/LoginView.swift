import SwiftUI

struct LoginView: View {
    @EnvironmentObject private var session: SessionStore

    @State private var email = ""
    @State private var password = ""
    @State private var error: String?
    @State private var submitting = false

    // Seeded demo accounts (see backend README) for one-tap sign-in.
    private let demoAccounts: [(role: Role, email: String)] = [
        (.patient, "patient@telehealth.test"),
        (.doctor, "house@telehealth.test"),
        (.staff, "staff@telehealth.test"),
        (.admin, "admin@telehealth.test"),
    ]
    private let demoPassword = "Passw0rd!"

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 24) {
                    header

                    VStack(spacing: 14) {
                        TextField("Email", text: $email)
                            .textContentType(.emailAddress)
                            .keyboardType(.emailAddress)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                        Divider()
                        SecureField("Password", text: $password)
                            .textContentType(.password)
                    }
                    .padding()
                    .background(.background.secondary, in: RoundedRectangle(cornerRadius: 12))

                    if let error {
                        Text(error)
                            .font(.subheadline).foregroundStyle(.red)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }

                    Button(action: submit) {
                        ZStack {
                            Text("Sign In").bold().opacity(submitting ? 0 : 1)
                            if submitting { ProgressView().tint(.white) }
                        }
                        .frame(maxWidth: .infinity, minHeight: 28)
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(submitting || email.isEmpty || password.isEmpty)

                    demoSection
                }
                .padding()
            }
            .navigationTitle("Sign In")
            .navigationBarTitleDisplayMode(.inline)
        }
    }

    private var header: some View {
        VStack(spacing: 8) {
            Image(systemName: "cross.case.fill")
                .font(.system(size: 52)).foregroundStyle(.tint)
            Text("Telehealth Consults").font(.title).bold()
            Text("Book and attend video consults with your care team.")
                .font(.subheadline).foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .padding(.top, 32)
    }

    private var demoSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Demo accounts")
                .font(.footnote).bold().foregroundStyle(.secondary)
            Text("Password: \(demoPassword)")
                .font(.caption).foregroundStyle(.secondary)
            ForEach(demoAccounts, id: \.email) { account in
                Button {
                    email = account.email
                    password = demoPassword
                    error = nil
                } label: {
                    HStack {
                        Label(account.role.label, systemImage: account.role.systemImage)
                        Spacer()
                        Text(account.email).font(.caption).foregroundStyle(.secondary)
                    }
                }
                .buttonStyle(.bordered)
                .tint(.secondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func submit() {
        error = nil
        submitting = true
        Task {
            do {
                try await session.login(email: email.trimmingCharacters(in: .whitespaces),
                                        password: password)
            } catch let apiError as APIError {
                error = apiError.errorDescription
            } catch {
                self.error = error.localizedDescription
            }
            submitting = false
        }
    }
}
