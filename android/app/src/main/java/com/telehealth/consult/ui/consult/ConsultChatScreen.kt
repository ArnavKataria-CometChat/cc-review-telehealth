package com.telehealth.consult.ui.consult

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.cometchat.chat.core.CometChat
import com.cometchat.chat.exceptions.CometChatException
import com.cometchat.chat.models.User
import com.cometchat.uikit.compose.presentation.messagecomposer.ui.CometChatMessageComposer
import com.cometchat.uikit.compose.presentation.messageheader.ui.CometChatMessageHeader
import com.cometchat.uikit.compose.presentation.messagelist.ui.CometChatMessageList
import com.cometchat.uikit.compose.theme.CometChatTheme
import com.cometchat.uikit.compose.theme.darkColorScheme
import com.cometchat.uikit.compose.theme.lightColorScheme
import com.telehealth.consult.data.ChatService
import com.telehealth.consult.data.model.AppointmentChatContext
import com.telehealth.consult.data.model.ChatParticipant
import com.telehealth.consult.data.model.PublicUser
import com.telehealth.consult.ui.common.AsyncContent
import com.telehealth.consult.ui.common.LocalContainer
import com.telehealth.consult.ui.common.rememberAsync

/**
 * The 1:1 secure chat + video/voice call surface for an appointment (Phase B).
 *
 * The backend is the RBAC authority: `GET /api/cometchat/appointments/:id/chat`
 * returns the single permitted peer for the caller (patient↔their doctor), or a
 * 403 for staff, or an audit-only view for admins. This screen renders the
 * CometChat conversation ONLY when the backend says `canChat` and names a peer.
 * Call buttons live in the CometChat message header (calling is enabled at init),
 * so a participant can start a video/voice consult from here.
 */
@Composable
fun ConsultChatScreen(appointmentId: String, user: PublicUser, onBack: () -> Unit) {
    val container = LocalContainer.current
    val repo = container.repository
    val chatState by container.chat.state.collectAsStateWithLifecycle()

    val (ctxState, reload) = rememberAsync(appointmentId) { repo.appointmentChat(appointmentId) }

    Column(Modifier.fillMaxSize()) {
        TopBackBar(title = "Secure consult", onBack = onBack)
        AsyncContent(ctxState, onRetry = { reload.reload() }) { ctx ->
            val peer = ctx.peer
            if (!ctx.canChat || peer == null) {
                NonParticipantNotice(ctx)
            } else {
                ConsultConversation(peer, chatState)
            }
        }
    }
}

@Composable
private fun TopBackBar(title: String, onBack: () -> Unit) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier.padding(start = 4.dp, top = 4.dp),
    ) {
        IconButton(onClick = onBack) {
            Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
        }
        Text(title, style = MaterialTheme.typography.titleLarge)
    }
}

/** Gate on CometChat auth: only render the conversation once login is Ready. */
@Composable
private fun ConsultConversation(
    peer: ChatParticipant,
    chatState: ChatService.State,
) {
    when (chatState) {
        is ChatService.State.Ready -> ConversationPanel(peer)
        is ChatService.State.Unavailable -> CenteredMessage(
            "Secure chat is unavailable: ${chatState.reason}",
            isError = true,
        )
        else -> CenteredMessage("Connecting secure chat…", loading = true)
    }
}

/** Resolves the peer [User] then hosts header + list + composer. */
@Composable
private fun ConversationPanel(peer: ChatParticipant) {
    var peerUser by remember(peer.uid) { mutableStateOf<User?>(null) }

    LaunchedEffect(peer.uid) {
        CometChat.getUser(peer.uid, object : CometChat.CallbackListener<User>() {
            override fun onSuccess(result: User) {
                peerUser = result
            }

            override fun onError(e: CometChatException) {
                // Fall back to a minimal User built from the backend-provided
                // identity — enough for the list/composer to target the UID.
                peerUser = User().apply {
                    uid = peer.uid
                    name = peer.name ?: peer.uid
                }
            }
        })
    }

    val target = peerUser
    if (target == null) {
        CenteredMessage("Loading conversation…", loading = true)
        return
    }

    // CometChat components need CometChatTheme's CompositionLocals. Honor the OS
    // light/dark setting. imePadding keeps the composer above the soft keyboard.
    CometChatTheme(
        colorScheme = if (isSystemInDarkTheme()) darkColorScheme() else lightColorScheme(),
    ) {
        Column(
            Modifier
                .fillMaxSize()
                .navigationBarsPadding()
                .imePadding(),
        ) {
            CometChatMessageHeader(
                modifier = Modifier.fillMaxWidth(),
                user = target,
                hideBackButton = true,
            )
            CometChatMessageList(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f),
                user = target,
            )
            CometChatMessageComposer(
                modifier = Modifier.fillMaxWidth(),
                user = target,
            )
        }
    }
}

/** Shown when the caller is not a chat participant (admin audit / staff / other). */
@Composable
private fun NonParticipantNotice(ctx: AppointmentChatContext) {
    val text = when {
        ctx.audit ->
            "Read-only oversight. Admins audit conversation metadata but do not " +
                "join the clinical conversation."
        else ->
            "You are not a participant in this appointment's clinical conversation."
    }
    CenteredMessage(text)
}

@Composable
private fun CenteredMessage(text: String, loading: Boolean = false, isError: Boolean = false) {
    Box(Modifier.fillMaxSize().padding(24.dp), contentAlignment = Alignment.Center) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            if (loading) CircularProgressIndicator()
            Text(
                text,
                style = MaterialTheme.typography.bodyMedium,
                color = if (isError) MaterialTheme.colorScheme.error
                else MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}
