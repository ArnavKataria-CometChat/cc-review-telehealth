import SwiftUI

/// Admin user directory + creation (`GET/POST /admin/users`). Role filter mirrors
/// the backend `?role=` query; creating a doctor/patient provisions the profile.
struct UsersView: View {
    @State private var users: [PublicUser] = []
    @State private var roleFilter: RoleFilter = .all
    @State private var loadState: LoadState = .loading
    @State private var showCreate = false

    private enum LoadState: Equatable { case loading, loaded, failed(String) }
    private enum RoleFilter: String, CaseIterable, Identifiable {
        case all, patient, doctor, staff, admin
        var id: String { rawValue }
        var label: String { self == .all ? "All" : rawValue.capitalized }
        var query: String? { self == .all ? nil : rawValue }
    }

    private var api: APIClient { .shared }

    var body: some View {
        NavigationStack {
            Group {
                switch loadState {
                case .loading:
                    LoadingView()
                case let .failed(message):
                    ErrorStateView(message: message) { Task { await load() } }
                case .loaded:
                    list
                }
            }
            .navigationTitle("Users")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Menu {
                        Picker("Role", selection: $roleFilter) {
                            ForEach(RoleFilter.allCases) { Text($0.label).tag($0) }
                        }
                    } label: {
                        Label("Filter", systemImage: "line.3.horizontal.decrease.circle")
                    }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button { showCreate = true } label: { Image(systemName: "plus") }
                }
            }
            .onChange(of: roleFilter) { _, _ in Task { await load() } }
            .task { await load() }
            .sheet(isPresented: $showCreate) {
                CreateUserSheet { Task { await load() } }
            }
        }
    }

    private var list: some View {
        List {
            if users.isEmpty {
                Text("No users for this filter.").foregroundStyle(.secondary)
            }
            ForEach(users) { user in
                HStack {
                    VStack(alignment: .leading, spacing: 3) {
                        Text(user.name).font(.headline)
                        Text(user.email).font(.caption).foregroundStyle(.secondary)
                    }
                    Spacer()
                    RoleTag(role: user.role)
                }
                .padding(.vertical, 2)
            }
        }
        .refreshable { await load() }
    }

    private func load() async {
        do {
            users = try await api.adminUsers(role: roleFilter.query)
            loadState = .loaded
        } catch let error as APIError {
            loadState = .failed(error.errorDescription ?? "Failed to load.")
        } catch {
            loadState = .failed(error.localizedDescription)
        }
    }
}

/// Create a doctor/staff/patient/admin account. Doctor/patient show extra fields
/// matching the backend's role-discriminated payload.
private struct CreateUserSheet: View {
    var onCreated: () -> Void

    @Environment(\.dismiss) private var dismiss

    @State private var role: Role = .patient
    @State private var name = ""
    @State private var email = ""
    @State private var password = ""
    // Doctor
    @State private var specialty = ""
    @State private var clinics: [Clinic] = []
    @State private var clinicId = ""
    // Patient
    @State private var mrn = ""
    @State private var dob = "1990-01-01"

    @State private var submitting = false
    @State private var error: String?

    private var api: APIClient { .shared }

    private var canSubmit: Bool {
        guard !name.isEmpty, !email.isEmpty, password.count >= 6 else { return false }
        switch role {
        case .doctor: return !specialty.isEmpty && !clinicId.isEmpty
        case .patient: return !mrn.isEmpty && !dob.isEmpty
        default: return true
        }
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Account") {
                    Picker("Role", selection: $role) {
                        ForEach(Role.allCases) { Text($0.label).tag($0) }
                    }
                    TextField("Full name", text: $name)
                    TextField("Email", text: $email)
                        .textInputAutocapitalization(.never)
                        .keyboardType(.emailAddress)
                        .autocorrectionDisabled()
                    SecureField("Password (min 6)", text: $password)
                }

                if role == .doctor {
                    Section("Doctor profile") {
                        TextField("Specialty", text: $specialty)
                        Picker("Clinic", selection: $clinicId) {
                            Text("Select…").tag("")
                            ForEach(clinics) { Text($0.name).tag($0.id) }
                        }
                    }
                }

                if role == .patient {
                    Section("Patient profile") {
                        TextField("MRN", text: $mrn)
                        TextField("Date of birth (YYYY-MM-DD)", text: $dob)
                            .autocorrectionDisabled()
                    }
                }

                if let error {
                    Section { Text(error).foregroundStyle(.red).font(.subheadline) }
                }
            }
            .navigationTitle("New User")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Create") { Task { await create() } }
                        .disabled(submitting || !canSubmit)
                }
            }
            .task { clinics = (try? await api.clinics()) ?? [] }
        }
    }

    private func create() async {
        submitting = true
        error = nil
        var req = CreateUserRequest(
            role: role.rawValue, name: name,
            email: email.trimmingCharacters(in: .whitespaces), password: password)
        switch role {
        case .doctor:
            req.specialty = specialty
            req.clinicId = clinicId
        case .patient:
            req.mrn = mrn
            req.dob = dob
        default:
            break
        }
        do {
            _ = try await api.createUser(req)
            onCreated()
            dismiss()
        } catch let e as APIError {
            error = e.errorDescription
        } catch {
            self.error = error.localizedDescription
        }
        submitting = false
    }
}
