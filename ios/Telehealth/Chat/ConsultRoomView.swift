import SwiftUI

/// Phase B consult room, embedded in the appointment detail screen's "Consult
/// Room" section. Only the appointment's patient/doctor participants render it
/// (staff/admin are gated out by the caller). The real chat/call UI lives in
/// `ConsultRoomLiveView` behind `#if canImport(CometChatUIKitSwift)`; if the app
/// is built without the CometChat pods, this degrades to a build hint instead of
/// failing to compile.
struct ConsultRoomView: View {
    let appointment: Appointment
    @EnvironmentObject private var session: SessionStore

    var body: some View {
        #if canImport(CometChatUIKitSwift)
        ConsultRoomLiveView(appointment: appointment)
            .environmentObject(session)
        #else
        Text("Chat & calling need the CometChat pods. Run `pod install`, then build Telehealth.xcworkspace.")
            .font(.footnote)
            .foregroundStyle(.secondary)
        #endif
    }
}
