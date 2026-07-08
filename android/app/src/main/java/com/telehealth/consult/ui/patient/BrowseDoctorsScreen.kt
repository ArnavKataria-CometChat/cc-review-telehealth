package com.telehealth.consult.ui.patient

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.telehealth.consult.data.model.DoctorView
import com.telehealth.consult.ui.common.AsyncContent
import com.telehealth.consult.ui.common.Badge
import com.telehealth.consult.ui.common.EmptyState
import com.telehealth.consult.ui.common.LocalContainer
import com.telehealth.consult.ui.common.rememberAsync

/** Patient flow step 1: browse/filter doctors, then pick one to see open slots. */
@Composable
fun BrowseDoctorsScreen(onBook: (String) -> Unit) {
    val repo = LocalContainer.current.repository
    var specialtyInput by remember { mutableStateOf("") }
    var appliedSpecialty by remember { mutableStateOf("") }

    val (state, _) = rememberAsync(appliedSpecialty) {
        repo.doctors(specialty = appliedSpecialty.ifBlank { null })
    }

    Column(Modifier.fillMaxSize()) {
        Row(
            Modifier.fillMaxWidth().padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            OutlinedTextField(
                value = specialtyInput,
                onValueChange = { specialtyInput = it },
                label = { Text("Filter by specialty") },
                singleLine = true,
                modifier = Modifier.weight(1f),
                leadingIcon = { Icon(Icons.Filled.Search, contentDescription = null) },
            )
            Button(onClick = { appliedSpecialty = specialtyInput.trim() }) { Text("Search") }
        }

        AsyncContent(state) { doctors ->
            if (doctors.isEmpty()) {
                EmptyState("No doctors match that specialty.")
            } else {
                LazyColumn(
                    contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    items(doctors, key = { it.userId }) { doctor ->
                        DoctorCard(doctor, onBook)
                    }
                }
            }
        }
    }
}

@Composable
private fun DoctorCard(doctor: DoctorView, onBook: (String) -> Unit) {
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp)) {
            Text(doctor.name, style = MaterialTheme.typography.titleMedium)
            Row(
                Modifier.padding(top = 6.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Badge(doctor.specialty, MaterialTheme.colorScheme.primary)
                doctor.clinicName?.let { Badge(it, MaterialTheme.colorScheme.tertiary) }
            }
            Button(
                onClick = { onBook(doctor.userId) },
                modifier = Modifier.padding(top = 12.dp),
            ) {
                Text("View open slots")
            }
        }
    }
}
