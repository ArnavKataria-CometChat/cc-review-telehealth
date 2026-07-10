package com.telehealth.consult.data

import android.content.Context
import android.util.Log
import com.cometchat.calls.core.CallAppSettings
import com.cometchat.calls.core.CometChatCalls
import com.cometchat.chat.core.Call
import com.cometchat.chat.core.CometChat
import com.cometchat.chat.exceptions.CometChatException
import com.cometchat.chat.models.User
import com.cometchat.uikit.core.CometChatUIKit
import com.cometchat.uikit.core.UIKitSettings
import com.cometchat.uikit.core.events.CometChatCallEvent
import com.cometchat.uikit.core.events.CometChatEvents
import com.telehealth.consult.BuildConfig
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlin.coroutines.resume

/**
 * Owns the CometChat SDK lifecycle for the app (Phase B).
 *
 * Security model (per the product spec): the client holds only the non-secret
 * App ID + Region (from BuildConfig, sourced from gitignored local.properties).
 * It never holds the REST API Key or Auth Key — authentication is a
 * backend-issued, per-user auth token (`POST /api/cometchat/token`) fed into
 * [CometChatUIKit.loginWithAuthToken]. The backend also carries each user's app
 * role onto their CometChat user, so RBAC-aware scoping stays server-authoritative.
 *
 * Init happens once at app start; login is chained off the app session so the
 * signed-in patient/doctor can send/receive messages and calls anywhere in the app.
 */
class ChatService(
    context: Context,
    private val repository: TelehealthRepository,
) {
    private val appContext = context.applicationContext

    sealed interface State {
        /** Not yet logged into CometChat. */
        data object Idle : State
        /** Login in flight. */
        data object LoggingIn : State
        /** Logged in and ready to chat/call as [uid]. */
        data class Ready(val uid: String) : State
        /** SDK not usable (missing credentials, init/login failure). */
        data class Unavailable(val reason: String) : State
    }

    private val _state = MutableStateFlow<State>(State.Idle)
    val state: StateFlow<State> = _state.asStateFlow()

    // The current ringing incoming call, if any — drives the root call overlay.
    private val _incomingCall = MutableStateFlow<Call?>(null)
    val incomingCall: StateFlow<Call?> = _incomingCall.asStateFlow()

    /** Dismiss the incoming-call overlay (e.g. after the kit handles accept/decline). */
    fun clearIncomingCall() {
        _incomingCall.value = null
    }

    /** True once App ID + Region are present; the client is allowed to init. */
    val isConfigured: Boolean =
        BuildConfig.COMETCHAT_APP_ID.isNotBlank() && BuildConfig.COMETCHAT_REGION.isNotBlank()

    // Resolves to true when the SDK finished initializing (false if it can't).
    private val initGate = CompletableDeferred<Boolean>()
    private val loginMutex = Mutex()

    // App-lifetime scope for observing the UI Kit's call-lifecycle event bus.
    private val callScope = CoroutineScope(Dispatchers.Main.immediate + SupervisorJob())

    // The kit's ongoing-call activity, while one is alive (see trackOngoingCallActivity).
    private var ongoingCallActivity: java.lang.ref.WeakReference<android.app.Activity>? = null

    /** Initialize the SDK once (call from Application.onCreate). Safe to call once. */
    fun initialize() {
        if (!isConfigured) {
            _state.value = State.Unavailable("CometChat App ID / Region not configured")
            initGate.complete(false)
            return
        }
        val settings = UIKitSettings.UIKitSettingsBuilder()
            .setAppId(BuildConfig.COMETCHAT_APP_ID)
            .setRegion(BuildConfig.COMETCHAT_REGION)
            .subscribePresenceForAllUsers()
            .setEnableCalling(true) // registers the calling extension (Phase B video/voice)
            .build()

        CometChatUIKit.init(
            appContext,
            settings,
            object : CometChat.CallbackListener<String>() {
                override fun onSuccess(result: String) {
                    // The Chat SDK init only wires call *signalling* (incoming/outgoing
                    // events). The actual WebRTC media session used by the ongoing-call
                    // screen lives in the separate calls SDK, which needs its OWN init —
                    // without it, joining a session throws "Please call the
                    // CometChatCalls.init() method ..." and the call never connects.
                    initCallsSdk()
                    registerCallListener()
                    observeCallLifecycle()
                    trackOngoingCallActivity()
                    initGate.complete(true)
                }

                override fun onError(e: CometChatException) {
                    _state.value = State.Unavailable(e.message ?: "CometChat init failed")
                    initGate.complete(false)
                }
            },
        )
    }

    // Initialize the calls (WebRTC) SDK so accepting a call can join its media
    // session. Idempotent — the SDK guards against re-init via isInitialized().
    private fun initCallsSdk() {
        if (CometChatCalls.isInitialized()) return
        val callSettings = CallAppSettings.CallAppSettingBuilder()
            .setAppId(BuildConfig.COMETCHAT_APP_ID)
            .setRegion(BuildConfig.COMETCHAT_REGION)
            .build()
        CometChatCalls.init(
            appContext,
            callSettings,
            object : CometChatCalls.CallbackListener<String>() {
                override fun onSuccess(result: String) = Unit
                override fun onError(e: com.cometchat.calls.exceptions.CometChatException) {
                    // Non-fatal for chat: calls simply won't connect. Surface for logs.
                    Log.e("ChatService", "CometChatCalls.init failed: ${e.message}")
                }
            },
        )
    }

    /**
     * The base [CometChat.CallListener] only reports the *ringing* phases
     * (received / cancelled / outgoing-accepted / outgoing-rejected). It has no
     * "the call ended" callback, so once the receiver accepts a call the root
     * overlay's [_incomingCall] stays set — and re-appears as a stale "accept"
     * popup when the ongoing-call screen closes and the app is resumed. The UI
     * Kit publishes the terminal transitions on [CometChatEvents.callEvents];
     * clear the overlay when the call ends or is rejected.
     *
     * NOTE: deliberately does NOT clear on [CometChatCallEvent.CallAccepted] —
     * the accepting side emits CallAccepted while the UI Kit is still handing the
     * call off to the ongoing-call screen, and tearing the incoming composable
     * down at that instant aborts the receiver's join (the call would connect on
     * the caller's side only). Clearing on CallEnded is enough: it fires before
     * the app is ever resumed to the point where the stale popup could show.
     */
    private fun observeCallLifecycle() {
        callScope.launch {
            CometChatEvents.callEvents.collect { event ->
                when (event) {
                    is CometChatCallEvent.CallEnded -> {
                        _incomingCall.value = null
                        // The UI Kit launches CometChatOngoingCallActivity in its OWN
                        // task (FLAG_ACTIVITY_NEW_TASK), so when the call ends and that
                        // activity finishes, Android returns to HOME — the app looks
                        // like it "exited". Bring our own task back to the foreground so
                        // the user lands back in the app (the consult), not the launcher.
                        returnToForeground()
                    }
                    is CometChatCallEvent.CallRejected -> _incomingCall.value = null
                    else -> Unit
                }
            }
        }
    }

    /**
     * Keep a weak handle on the UI Kit's ongoing-call activity
     * (CometChatOngoingCallActivity, launched in its OWN task) while it is alive,
     * so [teardownGhostCall] can finish it when the REMOTE party ends a 1:1 call.
     */
    private fun trackOngoingCallActivity() {
        val app = appContext as? android.app.Application ?: return
        app.registerActivityLifecycleCallbacks(
            object : android.app.Application.ActivityLifecycleCallbacks {
                override fun onActivityCreated(a: android.app.Activity, b: android.os.Bundle?) {
                    if (a.javaClass.name.contains("OngoingCall")) {
                        ongoingCallActivity = java.lang.ref.WeakReference(a)
                    }
                }
                override fun onActivityDestroyed(a: android.app.Activity) {
                    if (ongoingCallActivity?.get() === a) ongoingCallActivity = null
                }
                override fun onActivityStarted(a: android.app.Activity) = Unit
                override fun onActivityResumed(a: android.app.Activity) = Unit
                override fun onActivityPaused(a: android.app.Activity) = Unit
                override fun onActivityStopped(a: android.app.Activity) = Unit
                override fun onActivitySaveInstanceState(a: android.app.Activity, b: android.os.Bundle) = Unit
            },
        )
    }

    /**
     * Ghost-call teardown (mirror of the iOS I4 gap): when the REMOTE party ends a
     * 1:1 call, the UI Kit's ongoing-call screen does NOT auto-dismiss — the calls
     * session is a conference, so the last remote leaving strands the local user in
     * a "conference of one" with the timer running. The end signal DOES arrive
     * ([CometChat.CallListener.onCallEndedMessageReceived], a default no-op the
     * baseline never overrode) — act on it: finish the kit's ongoing-call activity
     * (it lives in its own task) and clear the active call. Guarded on the tracked
     * activity so a LOCAL hang-up (which the kit already tears down) is a no-op.
     */
    private fun teardownGhostCall(reason: String, call: Call? = null) {
        val activity = ongoingCallActivity?.get()
        Log.i("ChatService", "X1C_ANDROID: $reason ongoing=${activity != null}")
        if (activity == null || activity.isFinishing || activity.isDestroyed) return
        ongoingCallActivity = null
        _incomingCall.value = null
        // CRITICAL: also end the calls-SDK media session. The kit's own end-button
        // path does this internally; finishing the activity from outside skips it,
        // and a stale media session blocks every subsequent call from joining until
        // the app is fully killed.
        runCatching { CometChatCalls.endSession() }
        runCatching { CometChat.clearActiveCall() }
        // Equally critical: fan the end out on the KIT's event bus so every kit
        // component (header call buttons, ongoing-call view model) resets its
        // internal "call in progress" state — the kit's own end-button path emits
        // this, but a REMOTE end emits nothing, and stale kit state silently
        // blocks the next call.
        if (call != null) {
            runCatching { CometChatEvents.emitCallEvent(CometChatCallEvent.CallEnded(call)) }
        }
        activity.finishAndRemoveTask() // its own task — remove it entirely
        returnToForeground()
    }

    /** Re-surface the app's own task after the ongoing-call activity (a separate
     *  task) finishes, so ending a call returns to the app instead of the home screen. */
    private fun returnToForeground() {
        runCatching {
            val intent = android.content.Intent().apply {
                setClassName(appContext, "com.telehealth.consult.MainActivity")
                addFlags(
                    android.content.Intent.FLAG_ACTIVITY_NEW_TASK or
                        android.content.Intent.FLAG_ACTIVITY_REORDER_TO_FRONT,
                )
            }
            appContext.startActivity(intent)
        }
    }

    // Surface incoming calls app-wide so the root overlay can ring on any screen.
    private fun registerCallListener() {
        CometChat.addCallListener(
            CALL_LISTENER_ID,
            object : CometChat.CallListener() {
                override fun onIncomingCallReceived(call: Call) {
                    _incomingCall.value = call
                }

                override fun onOutgoingCallAccepted(call: Call) {
                    _incomingCall.value = null
                }

                override fun onOutgoingCallRejected(call: Call) {
                    _incomingCall.value = null
                }

                override fun onIncomingCallCancelled(call: Call) {
                    _incomingCall.value = null
                }

                // Default no-op in the SDK — MUST be overridden or the ongoing-call
                // screen ghosts when the REMOTE party ends a 1:1 call (see
                // teardownGhostCall).
                override fun onCallEndedMessageReceived(call: Call) {
                    teardownGhostCall("onCallEndedMessageReceived", call)
                }
            },
        )
    }

    /**
     * Ensure CometChat is logged in as [appUserId] (the app's stable user id,
     * which equals the CometChat UID). Idempotent: a no-op when already logged in
     * as that user; switches identity if a different user is logged in. Mints a
     * fresh backend auth token and calls `loginWithAuthToken`.
     */
    suspend fun ensureLoggedIn(appUserId: String) = loginMutex.withLock {
        if (!initGate.await()) return@withLock // Unavailable — state already set

        val existing = runCatching { CometChatUIKit.getLoggedInUser() }.getOrNull()
        if (existing?.uid == appUserId) {
            _state.value = State.Ready(appUserId)
            return@withLock
        }
        if (existing != null) logoutInternal() // a different user — switch

        _state.value = State.LoggingIn
        try {
            val token = repository.cometchatToken()
            val user = loginWithToken(token.authToken)
            _state.value = State.Ready(user.uid ?: appUserId)
        } catch (e: ApiException) {
            _state.value = State.Unavailable(e.userMessage)
        } catch (e: Exception) {
            _state.value = State.Unavailable(e.message ?: "CometChat login failed")
        }
    }

    /** Log out of CometChat (call when the app session is cleared). */
    suspend fun logout() = loginMutex.withLock {
        logoutInternal()
        _state.value = State.Idle
    }

    private suspend fun loginWithToken(authToken: String): User =
        suspendCancellableCoroutine { cont ->
            CometChatUIKit.loginWithAuthToken(
                authToken,
                object : CometChat.CallbackListener<User>() {
                    override fun onSuccess(user: User) {
                        if (cont.isActive) cont.resume(user)
                    }

                    override fun onError(e: CometChatException) {
                        if (cont.isActive) cont.cancel(e)
                    }
                },
            )
        }

    private companion object {
        const val CALL_LISTENER_ID = "telehealth-consult-calls"
    }

    private suspend fun logoutInternal() {
        val logged = runCatching { CometChatUIKit.getLoggedInUser() }.getOrNull() ?: return
        if (logged.uid == null) return
        suspendCancellableCoroutine { cont ->
            CometChatUIKit.logout(object : CometChat.CallbackListener<String>() {
                override fun onSuccess(result: String) {
                    if (cont.isActive) cont.resume(Unit)
                }

                override fun onError(e: CometChatException) {
                    // Swallow — best-effort teardown; the app session is already gone.
                    if (cont.isActive) cont.resume(Unit)
                }
            })
        }
    }
}
