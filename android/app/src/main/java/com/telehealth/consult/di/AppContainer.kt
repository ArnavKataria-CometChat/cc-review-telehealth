package com.telehealth.consult.di

import android.content.Context
import com.telehealth.consult.data.ApiClient
import com.telehealth.consult.data.ChatService
import com.telehealth.consult.data.SessionStore
import com.telehealth.consult.data.TelehealthRepository

/**
 * Manual dependency container (a lightweight alternative to Hilt for a baseline
 * app). Built once in [com.telehealth.consult.TelehealthApp] and read by the UI
 * via a CompositionLocal.
 */
class AppContainer(context: Context) {
    val session: SessionStore = SessionStore(context)

    private val api: ApiClient = ApiClient(
        session = session,
        // A 401 (expired/invalid token) drops the session → UI returns to login.
        onUnauthorized = { session.clear() },
    )

    val repository: TelehealthRepository = TelehealthRepository(api, session)

    /** CometChat SDK lifecycle (Phase B). Initialized once by [TelehealthApp]. */
    val chat: ChatService = ChatService(context, repository)
}
