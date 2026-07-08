package com.telehealth.consult.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.telehealth.consult.ui.auth.LoginScreen
import com.telehealth.consult.ui.common.LocalContainer

/**
 * Top-level gate: unauthenticated → login; authenticated → the role-scoped
 * shell. Session state comes from the persistent [SessionStore], so a valid
 * token survives process death and lands the user straight in their home.
 */
@Composable
fun AppRoot() {
    val container = LocalContainer.current
    val session by container.session.session.collectAsStateWithLifecycle()

    val current = session
    if (current == null) {
        LoginScreen()
    } else {
        MainScaffold(user = current.user)
    }
}
