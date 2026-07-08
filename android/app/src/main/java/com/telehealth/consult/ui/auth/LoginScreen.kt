package com.telehealth.consult.ui.auth

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.HealthAndSafety
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.telehealth.consult.ui.common.LocalContainer
import com.telehealth.consult.ui.common.rememberActionState
import com.telehealth.consult.ui.common.run
import kotlinx.coroutines.launch

/** Email + password login. On success the session is persisted and [AppRoot] routes by role. */
@Composable
fun LoginScreen() {
    val container = LocalContainer.current
    val scope = rememberCoroutineScope()
    val action = rememberActionState()

    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }

    fun submit() {
        if (email.isBlank() || password.isBlank() || action.running) return
        scope.launch { action.run { container.repository.login(email, password) } }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Icon(
            Icons.Filled.HealthAndSafety,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.primary,
            modifier = Modifier.padding(bottom = 8.dp),
        )
        Text("Telehealth Consult", style = MaterialTheme.typography.headlineSmall)
        Text(
            "Sign in to book and run video consults",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(top = 4.dp, bottom = 24.dp),
        )

        OutlinedTextField(
            value = email,
            onValueChange = { email = it },
            label = { Text("Email") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
            keyboardOptions = KeyboardOptions(
                keyboardType = KeyboardType.Email,
                imeAction = ImeAction.Next,
            ),
        )
        OutlinedTextField(
            value = password,
            onValueChange = { password = it },
            label = { Text("Password") },
            singleLine = true,
            visualTransformation = PasswordVisualTransformation(),
            modifier = Modifier.fillMaxWidth().padding(top = 12.dp),
            keyboardOptions = KeyboardOptions(
                keyboardType = KeyboardType.Password,
                imeAction = ImeAction.Done,
            ),
        )

        action.error?.let {
            Text(
                it,
                color = MaterialTheme.colorScheme.error,
                style = MaterialTheme.typography.bodySmall,
                modifier = Modifier.fillMaxWidth().padding(top = 12.dp),
            )
        }

        Button(
            onClick = { submit() },
            enabled = !action.running,
            modifier = Modifier.fillMaxWidth().padding(top = 20.dp),
        ) {
            if (action.running) {
                CircularProgressIndicator(
                    strokeWidth = 2.dp,
                    modifier = Modifier.padding(end = 8.dp).then(Modifier.size(18.dp)),
                )
            }
            Text("Sign in")
        }

        DemoAccountsHint(
            onPick = { e -> email = e; password = "Passw0rd!" },
            modifier = Modifier.padding(top = 28.dp),
        )
    }
}

@Composable
private fun DemoAccountsHint(onPick: (String) -> Unit, modifier: Modifier = Modifier) {
    val accounts = listOf(
        "Patient" to "patient@telehealth.test",
        "Doctor" to "house@telehealth.test",
        "Staff" to "staff@telehealth.test",
        "Admin" to "admin@telehealth.test",
    )
    Surface(
        color = MaterialTheme.colorScheme.surfaceVariant,
        shape = MaterialTheme.shapes.medium,
        modifier = modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(16.dp)) {
            Text(
                "Demo accounts (tap to fill · password Passw0rd!)",
                style = MaterialTheme.typography.labelMedium,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth().padding(bottom = 8.dp),
            )
            accounts.forEach { (role, addr) ->
                androidx.compose.material3.TextButton(
                    onClick = { onPick(addr) },
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text("$role — $addr", style = MaterialTheme.typography.bodySmall)
                }
            }
        }
    }
}
