package com.telehealth.consult.ui.admin

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.FilterChip
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
import com.telehealth.consult.data.model.CreateUserRequest
import com.telehealth.consult.data.model.PublicUser
import com.telehealth.consult.data.model.Role
import com.telehealth.consult.ui.common.AsyncContent
import com.telehealth.consult.ui.common.LocalContainer
import com.telehealth.consult.ui.common.RoleBadge
import com.telehealth.consult.ui.common.rememberActionState
import com.telehealth.consult.ui.common.rememberAsync
import com.telehealth.consult.ui.common.run
import kotlinx.coroutines.launch

/** Admin user directory: filter by role, and provision new accounts (RBAC-mapped). */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun AdminUsersScreen() {
    val repo = LocalContainer.current.repository
    val scope = rememberCoroutineScope()
    val action = rememberActionState()
    var roleFilter by remember { mutableStateOf<Role?>(null) }
    var showCreate by remember { mutableStateOf(false) }

    val (state, reload) = rememberAsync(roleFilter) { repo.users(roleFilter) }

    Column(Modifier.fillMaxSize()) {
        Row(
            Modifier.fillMaxWidth().padding(start = 16.dp, end = 8.dp, top = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Text("Users", style = MaterialTheme.typography.titleLarge)
            IconButton(onClick = { showCreate = true }) {
                Icon(Icons.Filled.Add, contentDescription = "Add user")
            }
        }

        FlowRow(
            Modifier.fillMaxWidth().padding(horizontal = 16.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            FilterChip(selected = roleFilter == null, onClick = { roleFilter = null }, label = { Text("All") })
            Role.entries.forEach { role ->
                FilterChip(
                    selected = roleFilter == role,
                    onClick = { roleFilter = role },
                    label = { Text(role.name.lowercase().replaceFirstChar { it.uppercase() }) },
                )
            }
        }

        action.error?.let {
            Text(
                it,
                color = MaterialTheme.colorScheme.error,
                style = MaterialTheme.typography.bodySmall,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
            )
        }

        AsyncContent(state, onRetry = { reload.reload() }) { users ->
            LazyColumn(
                contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                items(users, key = { it.id }) { user -> UserCard(user) }
            }
        }
    }

    if (showCreate) {
        CreateUserDialog(
            onDismiss = { showCreate = false },
            onCreate = { req ->
                showCreate = false
                scope.launch { action.run { repo.createUser(req) }; reload.reload() }
            },
        )
    }
}

@Composable
private fun UserCard(user: PublicUser) {
    Card(Modifier.fillMaxWidth()) {
        Row(
            Modifier.fillMaxWidth().padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Column(Modifier.weight(1f)) {
                Text(user.name, style = MaterialTheme.typography.titleMedium)
                Text(
                    user.email,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            RoleBadge(user.role)
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun CreateUserDialog(onDismiss: () -> Unit, onCreate: (CreateUserRequest) -> Unit) {
    val repo = LocalContainer.current.repository
    var role by remember { mutableStateOf(Role.PATIENT) }
    var name by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var specialty by remember { mutableStateOf("") }
    var clinicId by remember { mutableStateOf<String?>(null) }
    var mrn by remember { mutableStateOf("") }
    var dob by remember { mutableStateOf("") }

    val (clinicsState, _) = rememberAsync { repo.clinics() }

    val valid = name.isNotBlank() && email.isNotBlank() && password.length >= 6 && when (role) {
        Role.DOCTOR -> specialty.isNotBlank() && clinicId != null
        Role.PATIENT -> mrn.isNotBlank() && dob.isNotBlank()
        else -> true
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("New user") },
        text = {
            Column(
                Modifier.verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Role.entries.forEach { r ->
                        FilterChip(
                            selected = role == r,
                            onClick = { role = r },
                            label = { Text(r.name.lowercase().replaceFirstChar { it.uppercase() }) },
                        )
                    }
                }
                OutlinedTextField(name, { name = it }, label = { Text("Name") }, singleLine = true)
                OutlinedTextField(email, { email = it }, label = { Text("Email") }, singleLine = true)
                OutlinedTextField(password, { password = it }, label = { Text("Password (min 6)") }, singleLine = true)

                when (role) {
                    Role.DOCTOR -> {
                        OutlinedTextField(specialty, { specialty = it }, label = { Text("Specialty") }, singleLine = true)
                        Text("Clinic", style = MaterialTheme.typography.labelMedium)
                        AsyncContent(clinicsState) { clinics ->
                            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                clinics.forEach { c ->
                                    FilterChip(
                                        selected = clinicId == c.id,
                                        onClick = { clinicId = c.id },
                                        label = { Text(c.name) },
                                    )
                                }
                            }
                        }
                    }
                    Role.PATIENT -> {
                        OutlinedTextField(mrn, { mrn = it }, label = { Text("MRN") }, singleLine = true)
                        OutlinedTextField(dob, { dob = it }, label = { Text("DOB (YYYY-MM-DD)") }, singleLine = true)
                    }
                    else -> {}
                }
            }
        },
        confirmButton = {
            Button(
                enabled = valid,
                onClick = {
                    onCreate(
                        CreateUserRequest(
                            role = role,
                            name = name.trim(),
                            email = email.trim(),
                            password = password,
                            specialty = specialty.trim().ifBlank { null }.takeIf { role == Role.DOCTOR },
                            clinicId = clinicId.takeIf { role == Role.DOCTOR },
                            mrn = mrn.trim().ifBlank { null }.takeIf { role == Role.PATIENT },
                            dob = dob.trim().ifBlank { null }.takeIf { role == Role.PATIENT },
                        ),
                    )
                },
            ) { Text("Create") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    )
}
