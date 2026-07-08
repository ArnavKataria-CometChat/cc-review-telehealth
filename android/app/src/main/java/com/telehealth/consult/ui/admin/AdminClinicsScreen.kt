package com.telehealth.consult.ui.admin

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.telehealth.consult.data.model.Clinic
import com.telehealth.consult.ui.common.AsyncContent
import com.telehealth.consult.ui.common.LocalContainer
import com.telehealth.consult.ui.common.rememberActionState
import com.telehealth.consult.ui.common.rememberAsync
import com.telehealth.consult.ui.common.run
import kotlinx.coroutines.launch

/** Admin clinic oversight — list + create + delete (delete refused server-side if in use). */
@Composable
fun AdminClinicsScreen() {
    val repo = LocalContainer.current.repository
    val scope = rememberCoroutineScope()
    val action = rememberActionState()
    var showCreate by remember { mutableStateOf(false) }

    val (state, reload) = rememberAsync { repo.clinics() }

    fun mutate(block: suspend () -> Unit) {
        scope.launch { action.run { block() }; reload.reload() }
    }

    Column(Modifier.fillMaxSize()) {
        Row(
            Modifier.fillMaxWidth().padding(start = 16.dp, end = 8.dp, top = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Text("Clinics", style = MaterialTheme.typography.titleLarge)
            IconButton(onClick = { showCreate = true }) {
                Icon(Icons.Filled.Add, contentDescription = "Add clinic")
            }
        }
        action.error?.let {
            Text(
                it,
                color = MaterialTheme.colorScheme.error,
                style = MaterialTheme.typography.bodySmall,
                modifier = Modifier.padding(horizontal = 16.dp),
            )
        }

        AsyncContent(state, onRetry = { reload.reload() }) { clinics ->
            LazyColumn(
                contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                items(clinics, key = { it.id }) { clinic ->
                    ClinicCard(clinic, onDelete = { mutate { repo.deleteClinic(clinic.id) } })
                }
            }
        }
    }

    if (showCreate) {
        ClinicCreateDialog(
            onDismiss = { showCreate = false },
            onCreate = { name, address ->
                showCreate = false
                mutate { repo.createClinic(name, address) }
            },
        )
    }
}

@Composable
private fun ClinicCard(clinic: Clinic, onDelete: () -> Unit) {
    Card(Modifier.fillMaxWidth()) {
        Row(
            Modifier.fillMaxWidth().padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(Modifier.weight(1f)) {
                Text(clinic.name, style = MaterialTheme.typography.titleMedium)
                Text(
                    clinic.address,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            IconButton(onClick = onDelete) {
                Icon(
                    Icons.Filled.Delete,
                    contentDescription = "Delete clinic",
                    tint = MaterialTheme.colorScheme.error,
                )
            }
        }
    }
}

@Composable
private fun ClinicCreateDialog(onDismiss: () -> Unit, onCreate: (String, String) -> Unit) {
    var name by remember { mutableStateOf("") }
    var address by remember { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("New clinic") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Name") },
                    singleLine = true,
                )
                OutlinedTextField(
                    value = address,
                    onValueChange = { address = it },
                    label = { Text("Address") },
                    singleLine = true,
                )
            }
        },
        confirmButton = {
            Button(
                onClick = { onCreate(name.trim(), address.trim()) },
                enabled = name.isNotBlank() && address.isNotBlank(),
            ) { Text("Create") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    )
}
