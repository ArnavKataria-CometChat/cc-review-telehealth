import SwiftUI

/// Admin clinic oversight + CRUD (`GET/POST/PATCH/DELETE /clinics`).
struct ClinicsView: View {
    @State private var clinics: [Clinic] = []
    @State private var loadState: LoadState = .loading
    @State private var editing: ClinicEditor.Mode?
    @State private var actionError: String?

    private enum LoadState: Equatable { case loading, loaded, failed(String) }
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
            .navigationTitle("Clinics")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button { editing = .create } label: { Image(systemName: "plus") }
                }
            }
            .task { await load() }
            .sheet(item: $editing) { mode in
                ClinicEditor(mode: mode) { Task { await load() } }
            }
        }
    }

    private var list: some View {
        List {
            if let actionError {
                Section { Text(actionError).foregroundStyle(.red).font(.subheadline) }
            }
            if clinics.isEmpty {
                Section {
                    Text("No clinics. Tap + to add one.").foregroundStyle(.secondary)
                }
            }
            ForEach(clinics) { clinic in
                VStack(alignment: .leading, spacing: 4) {
                    Text(clinic.name).font(.headline)
                    Text(clinic.address).font(.subheadline).foregroundStyle(.secondary)
                }
                .contentShape(Rectangle())
                .onTapGesture { editing = .edit(clinic) }
                .swipeActions {
                    Button("Delete", role: .destructive) {
                        Task { await delete(clinic) }
                    }
                    Button("Edit") { editing = .edit(clinic) }.tint(.blue)
                }
            }
        }
        .refreshable { await load() }
    }

    private func load() async {
        do {
            clinics = try await api.clinics()
            loadState = .loaded
        } catch let error as APIError {
            loadState = .failed(error.errorDescription ?? "Failed to load.")
        } catch {
            loadState = .failed(error.localizedDescription)
        }
    }

    private func delete(_ clinic: Clinic) async {
        actionError = nil
        do {
            try await api.deleteClinic(id: clinic.id)
            await load()
        } catch let error as APIError {
            // e.g. 409 when doctors are still assigned.
            actionError = error.errorDescription
        } catch {
            actionError = error.localizedDescription
        }
    }
}

/// Create/edit form for a clinic.
struct ClinicEditor: View {
    enum Mode: Identifiable {
        case create
        case edit(Clinic)
        var id: String {
            switch self {
            case .create: return "create"
            case let .edit(clinic): return clinic.id
            }
        }
    }

    let mode: Mode
    var onDone: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var address = ""
    @State private var submitting = false
    @State private var error: String?

    private var api: APIClient { .shared }
    private var isEdit: Bool { if case .edit = mode { return true } else { return false } }

    var body: some View {
        NavigationStack {
            Form {
                Section("Clinic") {
                    TextField("Name", text: $name)
                    TextField("Address", text: $address)
                }
                if let error {
                    Section { Text(error).foregroundStyle(.red).font(.subheadline) }
                }
            }
            .navigationTitle(isEdit ? "Edit Clinic" : "New Clinic")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { Task { await save() } }
                        .disabled(submitting || name.isEmpty || address.isEmpty)
                }
            }
            .onAppear {
                if case let .edit(clinic) = mode {
                    name = clinic.name
                    address = clinic.address
                }
            }
        }
    }

    private func save() async {
        submitting = true
        error = nil
        do {
            switch mode {
            case .create:
                _ = try await api.createClinic(name: name, address: address)
            case let .edit(clinic):
                _ = try await api.updateClinic(id: clinic.id, name: name, address: address)
            }
            onDone()
            dismiss()
        } catch let e as APIError {
            error = e.errorDescription
        } catch {
            self.error = error.localizedDescription
        }
        submitting = false
    }
}
