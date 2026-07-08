package com.telehealth.consult.ui.staff

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.text.KeyboardOptions
import com.telehealth.consult.data.model.DoctorView
import com.telehealth.consult.data.model.SlotStatus
import com.telehealth.consult.data.model.SlotView
import com.telehealth.consult.ui.common.AsyncContent
import com.telehealth.consult.ui.common.LocalContainer
import com.telehealth.consult.ui.common.SlotBadge
import com.telehealth.consult.ui.common.formatDuration
import com.telehealth.consult.ui.common.formatInstant
import com.telehealth.consult.ui.common.isoFromHoursFromNow
import com.telehealth.consult.ui.common.rememberActionState
import com.telehealth.consult.ui.common.rememberAsync
import com.telehealth.consult.ui.common.run
import kotlinx.coroutines.launch

/** Coordinator slot manager: pick a doctor, create slots, and open/close them. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun StaffSlotsScreen() {
    val repo = LocalContainer.current.repository
    var selectedDoctor by remember { mutableStateOf<String?>(null) }

    val (doctorsState, _) = rememberAsync { repo.doctors() }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp)) {
        Text("Slot manager", style = MaterialTheme.typography.titleLarge)
        Text(
            "Create and open/close consult slots for a doctor.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(bottom = 12.dp),
        )

        AsyncContent(doctorsState) { doctors ->
            if (selectedDoctor == null) selectedDoctor = doctors.firstOrNull()?.userId

            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                doctors.forEach { doc ->
                    FilterChip(
                        selected = selectedDoctor == doc.userId,
                        onClick = { selectedDoctor = doc.userId },
                        label = { Text(doc.name) },
                    )
                }
            }

            selectedDoctor?.let { docId ->
                val doctor = doctors.firstOrNull { it.userId == docId }
                SlotManagerForDoctor(docId, doctor)
            }
        }
    }
}

@Composable
private fun SlotManagerForDoctor(doctorId: String, doctor: DoctorView?) {
    val repo = LocalContainer.current.repository
    val scope = rememberCoroutineScope()
    val action = rememberActionState()

    val (slotsState, slotsReload) = rememberAsync(doctorId) { repo.doctorSlots(doctorId) }

    fun mutate(block: suspend () -> Unit) {
        scope.launch { action.run { block() }; slotsReload.reload() }
    }

    Column(Modifier.padding(top = 16.dp)) {
        doctor?.let {
            Text(
                "${it.name} · ${it.specialty}",
                style = MaterialTheme.typography.titleMedium,
                modifier = Modifier.padding(bottom = 8.dp),
            )
        }

        CreateSlotForm(action.running) { hours, duration ->
            mutate { repo.createSlot(doctorId, isoFromHoursFromNow(hours), duration) }
        }
        action.error?.let {
            Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
        }

        Text("Slots", style = MaterialTheme.typography.titleSmall, modifier = Modifier.padding(top = 16.dp, bottom = 4.dp))
        AsyncContent(slotsState, onRetry = { slotsReload.reload() }) { slots ->
            if (slots.isEmpty()) {
                Text(
                    "No slots yet — create one above.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            } else {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    slots.sortedBy { it.startsAt }.forEach { slot ->
                        SlotManageRow(slot, action.running) { newStatus -> mutate { repo.setSlotStatus(slot.id, newStatus) } }
                    }
                }
            }
        }
    }
}

@Composable
private fun CreateSlotForm(busy: Boolean, onCreate: (hours: Double, duration: Int) -> Unit) {
    var startsIn by remember { mutableStateOf("24") }
    var duration by remember { mutableStateOf("30") }

    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp)) {
            Text("New slot", style = MaterialTheme.typography.titleSmall)
            Row(
                Modifier.fillMaxWidth().padding(top = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                OutlinedTextField(
                    value = startsIn,
                    onValueChange = { startsIn = it.filter(Char::isDigit) },
                    label = { Text("Starts in (hrs)") },
                    singleLine = true,
                    modifier = Modifier.weight(1f),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                )
                OutlinedTextField(
                    value = duration,
                    onValueChange = { duration = it.filter(Char::isDigit) },
                    label = { Text("Duration (min)") },
                    singleLine = true,
                    modifier = Modifier.weight(1f),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                )
            }
            Button(
                onClick = {
                    val h = startsIn.toDoubleOrNull() ?: return@Button
                    val d = duration.toIntOrNull() ?: return@Button
                    if (d > 0) onCreate(h, d)
                },
                enabled = !busy && startsIn.isNotBlank() && duration.isNotBlank(),
                modifier = Modifier.padding(top = 8.dp),
            ) { Text("Create slot") }
        }
    }
}

@Composable
private fun SlotManageRow(slot: SlotView, busy: Boolean, onSetStatus: (SlotStatus) -> Unit) {
    Card(Modifier.fillMaxWidth()) {
        Row(
            Modifier.fillMaxWidth().padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Column(Modifier.weight(1f)) {
                Text(formatInstant(slot.startsAt), style = MaterialTheme.typography.bodyMedium)
                Text(
                    formatDuration(slot.durationMin),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            SlotBadge(slot.status)
            when (slot.status) {
                SlotStatus.OPEN -> OutlinedButton(
                    onClick = { onSetStatus(SlotStatus.BOOKED) },
                    enabled = !busy,
                    modifier = Modifier.padding(start = 8.dp),
                ) { Text("Close") }
                SlotStatus.BOOKED -> OutlinedButton(
                    onClick = { onSetStatus(SlotStatus.OPEN) },
                    enabled = !busy,
                    modifier = Modifier.padding(start = 8.dp),
                ) { Text("Reopen") }
            }
        }
    }
}
