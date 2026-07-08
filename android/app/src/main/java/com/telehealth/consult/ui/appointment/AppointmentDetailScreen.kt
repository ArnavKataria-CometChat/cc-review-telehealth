package com.telehealth.consult.ui.appointment

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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Videocam
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
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
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import com.telehealth.consult.data.model.AppointmentStatus
import com.telehealth.consult.data.model.AppointmentView
import com.telehealth.consult.data.model.NoteView
import com.telehealth.consult.data.model.PatchAppointmentRequest
import com.telehealth.consult.data.model.PublicUser
import com.telehealth.consult.data.model.Role
import com.telehealth.consult.ui.common.Async
import com.telehealth.consult.ui.common.AsyncContent
import com.telehealth.consult.ui.common.Badge
import com.telehealth.consult.ui.common.LocalContainer
import com.telehealth.consult.ui.common.Reloadable
import com.telehealth.consult.ui.common.StatusBadge
import com.telehealth.consult.ui.common.formatInstant
import com.telehealth.consult.ui.common.rememberActionState
import com.telehealth.consult.ui.common.rememberAsync
import com.telehealth.consult.ui.common.run
import kotlinx.coroutines.launch

/**
 * Appointment detail — the screen the spec earmarks for Phase B chat + video.
 * Actions are gated by the caller's role (mirroring the backend transition
 * table); the video/chat block is a deliberately-unbuilt CometChat seam.
 */
@Composable
fun AppointmentDetailScreen(appointmentId: String, user: PublicUser, onBack: () -> Unit) {
    val repo = LocalContainer.current.repository
    val scope = rememberCoroutineScope()
    val action = rememberActionState()

    val (apptState, apptReload) = rememberAsync(appointmentId) { repo.appointment(appointmentId) }
    val (notesState, notesReload) = rememberAsync(appointmentId) { repo.notes(appointmentId) }

    fun mutate(block: suspend () -> Unit) {
        scope.launch {
            action.run { block() }
            apptReload.reload()
            notesReload.reload()
        }
    }

    Column(Modifier.fillMaxSize()) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(start = 4.dp, top = 4.dp)) {
            IconButton(onClick = onBack) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
            }
            Text("Appointment", style = MaterialTheme.typography.titleLarge)
        }

        AsyncContent(apptState, onRetry = { apptReload.reload() }) { appt ->
            Column(
                Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                OverviewCard(appt)
                ConsultSeamCard(appt, user)
                ActionsSection(appt, user, action.running) { mutate(it) }
                action.error?.let {
                    Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
                }
                NotesSection(appt, user, notesState, onRetry = { notesReload.reload() }, onWrite = { body ->
                    mutate { repo.addNote(appt.id, body) }
                })
            }
        }
    }
}

@Composable
private fun OverviewCard(appt: AppointmentView) {
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp)) {
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text("Consult details", style = MaterialTheme.typography.titleMedium)
                StatusBadge(appt.status)
            }
            InfoRow("Doctor", appt.doctor.name ?: appt.doctor.userId)
            appt.doctor.specialty?.let { InfoRow("Specialty", it) }
            InfoRow("Patient", appt.patient.name ?: appt.patient.userId)
            appt.patient.mrn?.let { InfoRow("MRN", it) }
            InfoRow("When", formatInstant(appt.startsAt))
            InfoRow("Reason", appt.reason.ifBlank { "—" })
        }
    }
}

@Composable
private fun InfoRow(label: String, value: String) {
    Row(Modifier.fillMaxWidth().padding(top = 8.dp)) {
        Text(
            label,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(end = 12.dp),
        )
        Text(value, style = MaterialTheme.typography.bodyMedium)
    }
}

/**
 * Phase B seam. The 1:1 video + chat between this appointment's patient and
 * doctor plugs in here. Staff/admin are never chat participants (staff =
 * coordination only, admin = read-only metadata audit), so they see a note.
 */
@Composable
private fun ConsultSeamCard(appt: AppointmentView, user: PublicUser) {
    val isParticipant = user.id == appt.patient.userId || user.id == appt.doctor.userId
    val liveNow = appt.status == AppointmentStatus.IN_PROGRESS

    Card(
        Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
    ) {
        Column(Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    if (isParticipant) Icons.Filled.Videocam else Icons.Filled.Lock,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.primary,
                )
                Text(
                    "  Video consult & chat",
                    style = MaterialTheme.typography.titleMedium,
                )
            }
            val body = when {
                !isParticipant && user.role == Role.STAFF ->
                    "Coordination only — staff are not participants in the clinical conversation."
                !isParticipant ->
                    "Read-only oversight — admins audit conversation metadata but do not join."
                liveNow ->
                    "This consult is in progress. 1:1 video + chat activates here in Phase B (CometChat)."
                else ->
                    "1:1 video + secure chat between you and " +
                        (if (user.id == appt.patient.userId) appt.doctor.name ?: "your doctor"
                        else appt.patient.name ?: "the patient") +
                        " activates here when the consult starts (Phase B)."
            }
            Text(
                body,
                style = MaterialTheme.typography.bodyMedium,
                modifier = Modifier.padding(top = 8.dp),
            )
            if (isParticipant) {
                Button(
                    onClick = {},
                    enabled = false,
                    modifier = Modifier.padding(top = 12.dp),
                ) {
                    Icon(Icons.Filled.Videocam, contentDescription = null)
                    Text("  Join consult (Phase B)")
                }
            }
            Badge("Scope: ${appt.participants.joinToString(" ↔ ")}", MaterialTheme.colorScheme.tertiary)
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ActionsSection(
    appt: AppointmentView,
    user: PublicUser,
    busy: Boolean,
    mutate: (suspend () -> Unit) -> Unit,
) {
    val repo = LocalContainer.current.repository
    val isTreatingDoctor = user.role == Role.DOCTOR && user.id == appt.doctor.userId
    val isOwningPatient = user.role == Role.PATIENT && user.id == appt.patient.userId
    val isCoordinator = user.role == Role.STAFF || user.role == Role.ADMIN

    fun setStatus(status: AppointmentStatus) =
        mutate { repo.patchAppointment(appt.id, PatchAppointmentRequest(status = status)) }

    val actions = buildList {
        if (isTreatingDoctor && appt.status == AppointmentStatus.SCHEDULED) {
            add(ActionButton("Start consult") { setStatus(AppointmentStatus.IN_PROGRESS) })
        }
        if (isTreatingDoctor && appt.status == AppointmentStatus.IN_PROGRESS) {
            add(ActionButton("Complete") { setStatus(AppointmentStatus.COMPLETED) })
        }
        val canCancel = when {
            isOwningPatient -> appt.status == AppointmentStatus.SCHEDULED
            isTreatingDoctor || isCoordinator ->
                appt.status == AppointmentStatus.SCHEDULED || appt.status == AppointmentStatus.IN_PROGRESS
            else -> false
        }
        if (canCancel) {
            add(ActionButton("Cancel", destructive = true) { setStatus(AppointmentStatus.CANCELLED) })
        }
    }

    if (actions.isEmpty() && !isCoordinator) return

    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp)) {
            Text("Actions", style = MaterialTheme.typography.titleMedium)
            FlowRow(
                Modifier.fillMaxWidth().padding(top = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                actions.forEach { a ->
                    if (a.destructive) {
                        OutlinedButton(
                            onClick = { a.onClick() },
                            enabled = !busy,
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.error),
                        ) { Text(a.label) }
                    } else {
                        Button(onClick = { a.onClick() }, enabled = !busy) { Text(a.label) }
                    }
                }
            }
            if (isCoordinator && (appt.status == AppointmentStatus.SCHEDULED || appt.status == AppointmentStatus.IN_PROGRESS)) {
                ReassignBlock(appt, busy, mutate)
            }
        }
    }
}

private data class ActionButton(
    val label: String,
    val destructive: Boolean = false,
    val onClick: () -> Unit,
)

/** Staff/admin reschedule: move the appointment to another open slot on the same doctor. */
@Composable
private fun ReassignBlock(
    appt: AppointmentView,
    busy: Boolean,
    mutate: (suspend () -> Unit) -> Unit,
) {
    val repo = LocalContainer.current.repository
    var expanded by remember { mutableStateOf(false) }

    OutlinedButton(onClick = { expanded = !expanded }, modifier = Modifier.padding(top = 8.dp)) {
        Text(if (expanded) "Hide reschedule" else "Reschedule / reassign")
    }
    if (expanded) {
        val (slotsState, _) = rememberAsync(appt.doctor.userId) {
            repo.doctorSlots(appt.doctor.userId, com.telehealth.consult.data.model.SlotStatus.OPEN)
        }
        AsyncContent(slotsState) { slots ->
            if (slots.isEmpty()) {
                Text(
                    "No other open slots for this doctor.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 8.dp),
                )
            } else {
                Column(Modifier.padding(top = 8.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    slots.forEach { slot ->
                        OutlinedButton(
                            onClick = {
                                mutate {
                                    repo.patchAppointment(
                                        appt.id,
                                        PatchAppointmentRequest(slotId = slot.id),
                                    )
                                }
                            },
                            enabled = !busy,
                            modifier = Modifier.fillMaxWidth(),
                        ) { Text("Move to ${formatInstant(slot.startsAt)}") }
                    }
                }
            }
        }
    }
}

@Composable
private fun NotesSection(
    appt: AppointmentView,
    user: PublicUser,
    notesState: Async<List<NoteView>>,
    onRetry: () -> Unit,
    onWrite: (String) -> Unit,
) {
    val isTreatingDoctor = user.role == Role.DOCTOR && user.id == appt.doctor.userId
    val canWrite = isTreatingDoctor && appt.status != AppointmentStatus.CANCELLED

    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp)) {
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text("Consultation notes", style = MaterialTheme.typography.titleMedium)
                if (user.role == Role.STAFF || user.role == Role.ADMIN) {
                    Badge("read-only", MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }

            AsyncContent(notesState, onRetry = onRetry) { notes ->
                if (notes.isEmpty()) {
                    Text(
                        "No notes recorded yet.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(top = 8.dp),
                    )
                } else {
                    Column(Modifier.padding(top = 8.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        notes.forEach { NoteItem(it) }
                    }
                }
            }

            if (canWrite) {
                NoteComposer(onWrite)
            }
        }
    }
}

@Composable
private fun NoteItem(note: NoteView) {
    Column(
        Modifier.fillMaxWidth(),
    ) {
        Text(note.body, style = MaterialTheme.typography.bodyMedium)
        Text(
            "${note.authorName} · ${formatInstant(note.createdAt)}",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            fontFamily = FontFamily.Default,
        )
    }
}

@Composable
private fun NoteComposer(onWrite: (String) -> Unit) {
    var text by remember { mutableStateOf("") }
    Column(Modifier.padding(top = 12.dp)) {
        OutlinedTextField(
            value = text,
            onValueChange = { text = it },
            label = { Text("Write a consult note") },
            modifier = Modifier.fillMaxWidth(),
            minLines = 2,
        )
        Button(
            onClick = {
                if (text.isNotBlank()) {
                    onWrite(text.trim())
                    text = ""
                }
            },
            enabled = text.isNotBlank(),
            modifier = Modifier.padding(top = 8.dp),
        ) { Text("Save note") }
    }
}
