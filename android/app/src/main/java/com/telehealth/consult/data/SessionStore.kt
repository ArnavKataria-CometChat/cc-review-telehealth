package com.telehealth.consult.data

import android.content.Context
import com.telehealth.consult.data.model.PublicUser
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Persists the backend-issued session (JWT + the stable {id, role} user) across
 * app restarts, and exposes it as observable state for the auth-gated UI.
 *
 * Note: a demo baseline uses plain [android.content.SharedPreferences]. A
 * production build would move the token to EncryptedSharedPreferences / the
 * Keystore — the storage seam is isolated here so that swap is local.
 */
class SessionStore(context: Context) {

    private val prefs =
        context.applicationContext.getSharedPreferences("telehealth_session", Context.MODE_PRIVATE)

    private val _session = MutableStateFlow(load())
    val session: StateFlow<Session?> = _session.asStateFlow()

    val currentToken: String? get() = _session.value?.token

    fun save(token: String, user: PublicUser) {
        prefs.edit()
            .putString(KEY_TOKEN, token)
            .putString(KEY_USER, Json.encodeToString(PublicUser.serializer(), user))
            .apply()
        _session.value = Session(token, user)
    }

    fun clear() {
        prefs.edit().clear().apply()
        _session.value = null
    }

    private fun load(): Session? {
        val token = prefs.getString(KEY_TOKEN, null) ?: return null
        val userJson = prefs.getString(KEY_USER, null) ?: return null
        return runCatching {
            Session(token, Json.decodeFromString(PublicUser.serializer(), userJson))
        }.getOrNull()
    }

    data class Session(val token: String, val user: PublicUser)

    private companion object {
        const val KEY_TOKEN = "token"
        const val KEY_USER = "user"
    }
}
