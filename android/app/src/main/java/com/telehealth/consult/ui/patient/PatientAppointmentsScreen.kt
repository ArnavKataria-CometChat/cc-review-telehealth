package com.telehealth.consult.ui.patient

import androidx.compose.runtime.Composable
import com.telehealth.consult.ui.appointment.AppointmentList
import com.telehealth.consult.ui.common.LocalContainer
import com.telehealth.consult.ui.common.rememberAsync

/** "My Appointments" — the backend scopes GET /appointments to the patient's own. */
@Composable
fun PatientAppointmentsScreen(onOpen: (String) -> Unit) {
    val repo = LocalContainer.current.repository
    val (state, _) = rememberAsync { repo.appointments() }
    AppointmentList(
        state = state,
        emptyMessage = "You have no appointments yet. Book one from Find Care.",
        onOpen = onOpen,
    )
}
