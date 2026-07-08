package com.telehealth.consult

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.CompositionLocalProvider
import com.telehealth.consult.ui.AppRoot
import com.telehealth.consult.ui.common.LocalContainer
import com.telehealth.consult.ui.theme.TelehealthTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        val container = (application as TelehealthApp).container
        setContent {
            CompositionLocalProvider(LocalContainer provides container) {
                TelehealthTheme {
                    AppRoot()
                }
            }
        }
    }
}
