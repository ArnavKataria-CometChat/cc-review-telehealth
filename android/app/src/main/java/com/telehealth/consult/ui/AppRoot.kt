package com.telehealth.consult.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.telehealth.consult.ui.auth.LoginScreen
import com.telehealth.consult.ui.common.LocalContainer

/**
 * Top-level gate: unauthenticated → login; authenticated → the role-scoped
 * shell. Session state comes from the persistent [SessionStore], so a valid
 * token survives process death and lands the user straight in their home.
 *
 * As a side effect it keeps the CometChat session in lockstep with the app
 * session (Phase B): logging into CometChat when signed in, out when signed out,
 * so a patient/doctor can chat and receive calls anywhere in the app.
 */
@Composable
fun AppRoot() {
    val container = LocalContainer.current
    val session by container.session.session.collectAsStateWithLifecycle()

    val current = session
    LaunchedEffect(current?.user?.id) {
        val user = current?.user
        if (user != null) {
            container.chat.ensureLoggedIn(user.id)
        } else {
            container.chat.logout()
        }
    }

    if (current == null) {
        LoginScreen()
    } else {
        MainScaffold(user = current.user)
    }
}
