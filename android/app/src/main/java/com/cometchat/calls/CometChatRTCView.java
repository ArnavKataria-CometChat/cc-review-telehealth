package com.cometchat.calls;

/**
 * No-op stub (CometChat Android v6 calls — workaround W3).
 *
 * chat-sdk-android's CallManager bytecode references the legacy V3-era class
 * com.cometchat.calls.CometChatRTCView, which calls-sdk-android:5.x moved to
 * com.cometchat.calls.core.*. Without this stub on the classpath, class
 * verification fails and Application.onCreate throws NoClassDefFoundError.
 * It is never invoked at runtime — the real call surface uses
 * com.cometchat.calls.core.CometChatCalls.
 */
public class CometChatRTCView {
}
