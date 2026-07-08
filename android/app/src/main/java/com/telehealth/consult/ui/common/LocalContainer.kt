package com.telehealth.consult.ui.common

import androidx.compose.runtime.staticCompositionLocalOf
import com.telehealth.consult.di.AppContainer

/** Provides the app-wide [AppContainer] (repository, session) to the tree. */
val LocalContainer = staticCompositionLocalOf<AppContainer> {
    error("AppContainer not provided")
}
