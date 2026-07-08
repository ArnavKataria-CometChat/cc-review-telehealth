package com.telehealth.consult.ui.patient

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.selection.selectable
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.telehealth.consult.data.model.SlotStatus
import com.telehealth.consult.data.model.SlotView
import com.telehealth.consult.ui.common.AsyncContent
import com.telehealth.consult.ui.common.EmptyState
import com.telehealth.consult.ui.common.LocalContainer
import com.telehealth.consult.ui.common.formatDuration
import com.telehealth.consult.ui.common.formatInstant
import com.telehealth.consult.ui.common.rememberActionState
import com.telehealth.consult.ui.common.rememberAsync
import com.telehealth.consult.ui.common.run
import kotlinx.coroutines.launch

/** Patient flow step 2: choose an open slot, give a reason, and book. */
@Composable
fun BookScreen(doctorId: String, onBooked: (String) -> Unit, onBack: () -> Unit) {
    val repo = LocalContainer.current.repository
    val scope = rememberCoroutineScope()
    val action = rememberActionState()

    var selectedSlot by remember { mutableStateOf<String?>(null) }
    var reason by remember { mutableStateOf("") }

    val (state, _) = rememberAsync(doctorId) { repo.doctorSlots(doctorId, SlotStatus.OPEN) }

    Column(Modifier.fillMaxSize()) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(start = 4.dp, top = 4.dp)) {
            IconButton(onClick = onBack) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
            }
            Text("Book a consult", style = MaterialTheme.typography.titleLarge)
        }

        AsyncContent(state) { slots ->
            val openSlots = slots.filter { it.status == SlotStatus.OPEN }
            if (openSlots.isEmpty()) {
                EmptyState("This doctor has no open slots right now.")
            } else {
                Column(
                    Modifier.fillMaxSize().padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    Text("Choose a time", style = MaterialTheme.typography.titleSmall)
                    openSlots.forEach { slot ->
                        SlotRow(
                            slot = slot,
                            selected = selectedSlot == slot.id,
                            onSelect = { selectedSlot = slot.id },
                        )
                    }

                    OutlinedTextField(
                        value = reason,
                        onValueChange = { reason = it },
                        label = { Text("Reason for visit") },
                        modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                        minLines = 2,
                    )

                    action.error?.let {
                        Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
                    }

                    Button(
                        onClick = {
                            val slotId = selectedSlot ?: return@Button
                            scope.launch {
                                action.run {
                                    val appt = repo.book(doctorId, slotId, reason.trim())
                                    onBooked(appt.id)
                                }
                            }
                        },
                        enabled = selectedSlot != null && reason.isNotBlank() && !action.running,
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        if (action.running) {
                            CircularProgressIndicator(strokeWidth = 2.dp, modifier = Modifier.padding(end = 8.dp))
                        }
                        Text("Confirm booking")
                    }
                }
            }
        }
    }
}

@Composable
private fun SlotRow(slot: SlotView, selected: Boolean, onSelect: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth().selectable(selected = selected, onClick = onSelect),
        colors = if (selected) {
            CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)
        } else {
            CardDefaults.cardColors()
        },
    ) {
        Row(
            Modifier.fillMaxWidth().padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            RadioButton(selected = selected, onClick = onSelect)
            Column(Modifier.padding(start = 8.dp)) {
                Text(formatInstant(slot.startsAt), style = MaterialTheme.typography.bodyLarge)
                Text(
                    formatDuration(slot.durationMin),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}
