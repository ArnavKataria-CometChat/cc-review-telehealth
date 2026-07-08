import SwiftUI

// MARK: - Status badges

/// Colored pill for appointment status.
struct AppointmentStatusBadge: View {
    let status: AppointmentStatus

    private var color: Color {
        switch status {
        case .scheduled: return .blue
        case .inProgress: return .green
        case .completed: return .gray
        case .cancelled: return .red
        }
    }

    var body: some View {
        Text(status.label)
            .font(.caption).bold()
            .padding(.horizontal, 8).padding(.vertical, 3)
            .background(color.opacity(0.15), in: Capsule())
            .foregroundStyle(color)
    }
}

/// Colored pill for slot status.
struct SlotStatusBadge: View {
    let status: SlotStatus
    var body: some View {
        let color: Color = status == .open ? .green : .orange
        Text(status.rawValue.capitalized)
            .font(.caption).bold()
            .padding(.horizontal, 8).padding(.vertical, 3)
            .background(color.opacity(0.15), in: Capsule())
            .foregroundStyle(color)
    }
}

/// Small labeled role tag.
struct RoleTag: View {
    let role: Role
    var body: some View {
        Label(role.label, systemImage: role.systemImage)
            .font(.caption).bold()
            .padding(.horizontal, 8).padding(.vertical, 3)
            .background(.tint.opacity(0.15), in: Capsule())
            .foregroundStyle(.tint)
    }
}

// MARK: - Loading / empty / error states

struct LoadingView: View {
    var label = "Loading…"
    var body: some View {
        VStack(spacing: 12) {
            ProgressView()
            Text(label).foregroundStyle(.secondary).font(.subheadline)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

struct EmptyStateView: View {
    let systemImage: String
    let title: String
    var message: String? = nil

    var body: some View {
        ContentUnavailableView {
            Label(title, systemImage: systemImage)
        } description: {
            if let message { Text(message) }
        }
    }
}

struct ErrorStateView: View {
    let message: String
    var retry: (() -> Void)? = nil

    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.largeTitle).foregroundStyle(.orange)
            Text("Something went wrong").font(.headline)
            Text(message)
                .font(.subheadline).foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            if let retry {
                Button("Try Again", action: retry).buttonStyle(.bordered)
            }
        }
        .padding()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

// MARK: - Async button

/// A button that shows a spinner while its async action runs and disables itself.
struct AsyncButton<Label: View>: View {
    var role: ButtonRole? = nil
    let action: () async -> Void
    @ViewBuilder let label: () -> Label

    @State private var running = false

    var body: some View {
        Button(role: role) {
            running = true
            Task {
                await action()
                running = false
            }
        } label: {
            ZStack {
                label().opacity(running ? 0 : 1)
                if running { ProgressView() }
            }
        }
        .disabled(running)
    }
}

// MARK: - Detail row

/// A label/value row used across detail screens.
struct DetailRow: View {
    let label: String
    let value: String
    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            Text(label).foregroundStyle(.secondary)
            Spacer()
            Text(value).multilineTextAlignment(.trailing)
        }
    }
}
