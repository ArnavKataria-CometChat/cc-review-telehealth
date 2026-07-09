#if canImport(CometChatUIKitSwift)
import SwiftUI
import UIKit
import CometChatUIKitSwift
import CometChatSDK

// MARK: - 1:1 consult conversation screen

/// A 1:1 consult conversation: message header (which surfaces the voice/video
/// call buttons when the Calls SDK is present) + message list + composer,
/// composed per the CometChat iOS UI Kit pattern. Scoped to a single peer — the
/// appointment's counterpart — so the conversation is implicitly per-appointment
/// patient ↔ doctor.
final class MessagesVC: UIViewController {

    var user: User?

    private lazy var headerView: CometChatMessageHeader = {
        let view = CometChatMessageHeader()
        view.translatesAutoresizingMaskIntoConstraints = false
        if let user { view.set(user: user) }
        view.set(controller: self)
        return view
    }()

    private lazy var messageListView: CometChatMessageList = {
        let list = CometChatMessageList()
        list.translatesAutoresizingMaskIntoConstraints = false
        if let user { list.set(user: user) }
        list.set(controller: self)
        return list
    }()

    private lazy var composerView: CometChatMessageComposer = {
        let composer = CometChatMessageComposer()
        composer.translatesAutoresizingMaskIntoConstraints = false
        if let user { composer.set(user: user) }
        composer.set(controller: self)
        return composer
    }()

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
        [headerView, messageListView, composerView].forEach(view.addSubview)

        NSLayoutConstraint.activate([
            headerView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            headerView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            headerView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            headerView.heightAnchor.constraint(equalToConstant: 56),

            messageListView.topAnchor.constraint(equalTo: headerView.bottomAnchor),
            messageListView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            messageListView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            messageListView.bottomAnchor.constraint(equalTo: composerView.topAnchor),

            composerView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            composerView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            composerView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
        ])
    }
}

/// SwiftUI host for the consult conversation, presented from the appointment
/// detail screen.
struct ConsultChatView: UIViewControllerRepresentable {
    let user: User

    func makeUIViewController(context: Context) -> MessagesVC {
        let vc = MessagesVC()
        vc.user = user
        return vc
    }

    func updateUIViewController(_ vc: MessagesVC, context: Context) {}
}

// MARK: - Voice / video call bar

/// Hosts a `CometChatCallButtons` row (voice + video) for the peer. Wrapped in
/// a UIViewController so the kit has a controller from which to present the
/// outgoing/ongoing call UI.
final class CallBarViewController: UIViewController {
    var user: User?

    override func viewDidLoad() {
        super.viewDidLoad()
        guard let user else { return }
        let buttons = CometChatCallButtons(width: 96, height: 40)
        buttons.user = user
        buttons.controller = self
        _ = buttons.connect()
        buttons.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(buttons)
        NSLayoutConstraint.activate([
            buttons.topAnchor.constraint(equalTo: view.topAnchor),
            buttons.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            buttons.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            buttons.leadingAnchor.constraint(greaterThanOrEqualTo: view.leadingAnchor),
        ])
    }
}

/// SwiftUI host for the peer's voice/video call buttons, shown inline in the
/// consult room.
struct ConsultCallBar: UIViewControllerRepresentable {
    let user: User

    func makeUIViewController(context: Context) -> CallBarViewController {
        let vc = CallBarViewController()
        vc.user = user
        return vc
    }

    func updateUIViewController(_ vc: CallBarViewController, context: Context) {}
}

// MARK: - Consult room orchestration

/// The live consult room: resolves RBAC-scoped access from the backend, brings
/// up the CometChat session, then surfaces chat + call for the appointment's
/// patient ↔ doctor pair only.
struct ConsultRoomLiveView: View {
    let appointment: Appointment

    @EnvironmentObject private var session: SessionStore
    @StateObject private var chat = CometChatService.shared

    @State private var access: AppointmentChatAccess?
    @State private var peer: User?
    @State private var phase: Phase = .loading
    @State private var showChat = false

    private enum Phase: Equatable { case loading, ready, denied(String), failed(String), unconfigured }

    var body: some View {
        Group {
            switch phase {
            case .loading:
                HStack(spacing: 8) {
                    ProgressView()
                    Text("Connecting secure consult…")
                        .font(.footnote).foregroundStyle(.secondary)
                }
            case .unconfigured:
                Label("Chat & calling aren’t configured on the server yet.",
                      systemImage: "bubble.left.slash")
                    .font(.footnote).foregroundStyle(.secondary)
            case let .denied(message), let .failed(message):
                Text(message).font(.footnote).foregroundStyle(.secondary)
            case .ready:
                readyContent
            }
        }
        .task(id: appointment.id) { await load() }
        .sheet(isPresented: $showChat) {
            if let peer {
                ConsultChatView(user: peer).ignoresSafeArea()
            }
        }
    }

    @ViewBuilder
    private var readyContent: some View {
        if let access, let peer {
            if let name = access.peer?.name {
                Text("Private 1:1 consult with \(name)")
                    .font(.subheadline)
            }
            if access.canCall {
                HStack {
                    Label("Voice / Video call", systemImage: "video.fill")
                    Spacer()
                    ConsultCallBar(user: peer).frame(width: 112, height: 44)
                }
            }
            if access.canChat {
                Button {
                    showChat = true
                } label: {
                    Label("Open Secure Chat", systemImage: "bubble.left.and.bubble.right.fill")
                }
            }
        }
    }

    private func load() async {
        guard let user = session.user else { return }
        phase = .loading
        do {
            let access = try await APIClient.shared.appointmentChatAccess(appointmentId: appointment.id)
            self.access = access
            guard (access.canChat || access.canCall), let peerInfo = access.peer else {
                phase = .denied("This consult conversation isn’t available for your role.")
                return
            }
            try await chat.connect(appUser: user)
            self.peer = try await chat.fetchUser(uid: peerInfo.uid)
            phase = .ready
        } catch let error as APIError {
            if case let .http(status, _, _) = error {
                switch status {
                case 503: phase = .unconfigured
                case 403: phase = .denied("Staff don’t have access to the clinical consult conversation.")
                default:  phase = .failed(error.errorDescription ?? "Couldn’t open the consult room.")
                }
            } else {
                phase = .failed(error.errorDescription ?? "Couldn’t open the consult room.")
            }
        } catch {
            let message = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
            phase = .failed(message)
        }
    }
}
#endif
