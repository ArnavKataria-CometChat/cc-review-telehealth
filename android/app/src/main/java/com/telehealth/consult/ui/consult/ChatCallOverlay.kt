package com.telehealth.consult.ui.consult

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.cometchat.uikit.compose.presentation.incomingcall.ui.CometChatIncomingCall
import com.cometchat.uikit.compose.theme.CometChatTheme
import com.cometchat.uikit.compose.theme.darkColorScheme
import com.cometchat.uikit.compose.theme.lightColorScheme
import com.telehealth.consult.data.ChatService
import com.telehealth.consult.ui.common.LocalContainer

/**
 * App-root incoming-call overlay (Phase B). Mounted OUTSIDE the navigation graph
 * so a ringing consult call surfaces on any screen. Renders nothing when there is
 * no active incoming call, and is only composed once CometChat login is Ready.
 */
@Composable
fun ChatCallOverlay() {
    val container = LocalContainer.current
    val state by container.chat.state.collectAsStateWithLifecycle()
    val incoming by container.chat.incomingCall.collectAsStateWithLifecycle()

    val call = incoming
    if (state is ChatService.State.Ready && call != null) {
        CometChatTheme(
            colorScheme = if (isSystemInDarkTheme()) darkColorScheme() else lightColorScheme(),
        ) {
            CometChatIncomingCall(
                modifier = Modifier.fillMaxSize(),
                call = call,
            )
        }
    }
}
