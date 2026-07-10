#if canImport(CometChatUIKitSwift)
import Foundation
import UIKit
import CometChatUIKitSwift
import CometChatSDK
#if canImport(CometChatCallsSDK)
import CometChatCallsSDK
#endif

/// Dismisses the CometChat ongoing-call UI when a 1:1 call ends REMOTELY.
///
/// Skill gap X1c: with the default calling integration the UI Kit presents its
/// ongoing-call screen but does NOT tear it down when the *other* party hangs up
/// a 1:1 call. The calls session is modelled as a conference, so when the only
/// remote participant leaves, the local user is left in a "conference of one"
/// with the timer still running — a ghost call, dismissable only by manually
/// tapping the red end button. The kit emits no auto-dismiss for a 1:1
/// remote-leave, and the baseline app registered no call listener, so nothing
/// closed the surface.
///
/// This observer listens for the call-ended signals on BOTH channels (the SDK's
/// `CometChatCallDelegate.onCallEndedMessageReceived` and the UI Kit's
/// `CometChatCallEventListener.ccCallEnded`) and, only while the ongoing-call
/// screen is actually the top-most controller, clears the active call and
/// dismisses it. The top-most guard means a LOCAL hang-up (which the kit already
/// tears down) never double-dismisses.
@MainActor
final class CallTeardownObserver: NSObject {

    static let shared = CallTeardownObserver()
    private let listenerID = "telehealth.call-teardown"
    private var started = false

    func start() {
        guard !started else { return }
        started = true
        CometChat.addCallListener(listenerID, self)       // SDK: 1:1 call-ended message
        CometChatCallEvents.addListener(listenerID, self)  // UI Kit: ccCallEnded / ccCallRejected
    }

    /// Tear down the ongoing-call UI iff it is actually up — so a local end
    /// (already handled by the kit) is a no-op here. The kit hosts the
    /// ongoing-call screen on its OWN overlay UIWindow, not the key window's root
    /// chain, so we scan every window in every connected scene for a
    /// `CometChatOngoingCall` and dismiss it (or hide its window if it is that
    /// window's root).
    private func teardownIfGhost(reason: String, call: Call? = nil) {
        guard let (found, _) = Self.locateOngoingCall() else {
            NSLog("X1C_EVENT: \(reason) -> no ongoing-call surface found (nothing to tear down)")
            return
        }
        NSLog("X1C_EVENT: \(reason) -> tearing down \(type(of: found))")
        // 1) End the calls-SDK media session. The kit's own red-button path does
        //    this internally; skipping it leaves a stale WebRTC session that makes
        //    every subsequent call fail to join (the "only the first call after a
        //    cold launch connects" symptom) until the app is fully killed.
        #if canImport(CometChatCallsSDK)
        CometChatCalls.endSession()
        #endif
        CometChat.clearActiveCall()
        // 2) PRIMARY teardown: fan the end out on the KIT's event bus and let the
        //    kit close its own screen. Every kit component (ongoing screen, header
        //    call buttons, calling extension) resets its "call in progress" state
        //    in its ccCallEnded handler — the kit's red-button path emits this, but
        //    a REMOTE end emits nothing. Manually destroying the kit's overlay
        //    window instead (isHidden / windowScene = nil) corrupts state the kit
        //    REUSES for the next call's UI, which is precisely what broke call #2.
        if reason != "ccCallEnded", let call {
            CometChatCallEvents.ccCallEnded(call: call)
        }
        // 3) FALLBACK only: if the kit did not close the surface itself, dismiss
        //    it gently after a beat. Never touch the window's scene.
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
            guard let (still, window) = Self.locateOngoingCall() else {
                NSLog("X1C_EVENT: \(reason) -> kit closed the surface itself")
                return
            }
            NSLog("X1C_EVENT: \(reason) -> fallback dismiss of \(type(of: still))")
            if still.presentingViewController != nil {
                still.dismiss(animated: true)
            } else {
                window.isHidden = true // keep windowScene intact — the kit reuses it
            }
        }
    }

    /// Find the kit's ongoing-call controller in any window of any connected scene.
    private static func locateOngoingCall() -> (UIViewController, UIWindow)? {
        let windows = UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap { $0.windows }
        for w in windows {
            if let f = findOngoingCall(w.rootViewController) { return (f, w) }
        }
        return nil
    }

    /// Depth-first search for the kit's ongoing-call controller anywhere under a
    /// root (presented modals, nav/tab containers, or plain child controllers).
    private static func findOngoingCall(_ vc: UIViewController?) -> UIViewController? {
        guard let vc else { return nil }
        if String(describing: type(of: vc)).contains("OngoingCall") { return vc }
        if let presented = vc.presentedViewController, let f = findOngoingCall(presented) { return f }
        if let nav = vc as? UINavigationController, let f = findOngoingCall(nav.visibleViewController) { return f }
        if let tab = vc as? UITabBarController, let f = findOngoingCall(tab.selectedViewController) { return f }
        for child in vc.children { if let f = findOngoingCall(child) { return f } }
        return nil
    }
}

// MARK: - SDK call delegate (remote-initiated end of a 1:1 call)

extension CallTeardownObserver: CometChatCallDelegate {
    func onIncomingCallReceived(incomingCall: Call?, error: CometChatException?) {
        NSLog("X1C_EVENT: onIncomingCallReceived")
    }
    func onIncomingCallCancelled(canceledCall: Call?, error: CometChatException?) {
        teardownIfGhost(reason: "onIncomingCallCancelled", call: canceledCall)
    }
    func onCallEndedMessageReceived(endedCall: Call?, error: CometChatException?) {
        teardownIfGhost(reason: "onCallEndedMessageReceived", call: endedCall)
    }
}

// MARK: - UI Kit call events

extension CallTeardownObserver: CometChatCallEventListener {
    func ccCallEnded(call: Call) {
        teardownIfGhost(reason: "ccCallEnded")
    }
    func ccCallRejected(call: Call) {
        teardownIfGhost(reason: "ccCallRejected")
    }
}
#endif
