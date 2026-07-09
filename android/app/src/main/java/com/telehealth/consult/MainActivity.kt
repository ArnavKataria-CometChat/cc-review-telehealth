package com.telehealth.consult

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import com.telehealth.consult.ui.AppRoot
import com.telehealth.consult.ui.common.LocalContainer
import com.telehealth.consult.ui.consult.ChatCallOverlay
import com.telehealth.consult.ui.theme.TelehealthTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        val container = (application as TelehealthApp).container
        setContent {
            CompositionLocalProvider(LocalContainer provides container) {
                TelehealthTheme {
                    Box(Modifier.fillMaxSize()) {
                        AppRoot()
                        // Incoming consult calls overlay every screen (Phase B).
                        ChatCallOverlay()
                    }
                }
            }
        }
    }
}
