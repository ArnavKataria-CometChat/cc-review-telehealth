package com.telehealth.consult

import android.app.Application
import com.telehealth.consult.di.AppContainer

class TelehealthApp : Application() {
    lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        container = AppContainer(this)
        // Initialize the CometChat SDK once at process start (Phase B). Login is
        // chained off the app session (see AppRoot), not here.
        container.chat.initialize()
    }
}
