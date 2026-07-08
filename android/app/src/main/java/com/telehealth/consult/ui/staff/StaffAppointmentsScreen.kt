package com.telehealth.consult.ui.staff

import androidx.compose.runtime.Composable
import com.telehealth.consult.ui.appointment.AppointmentList
import com.telehealth.consult.ui.common.LocalContainer
import com.telehealth.consult.ui.common.rememberAsync

/** Coordinator view — staff see all appointments (server grants full visibility). */
@Composable
fun StaffAppointmentsScreen(onOpen: (String) -> Unit) {
    val repo = LocalContainer.current.repository
    val (state, _) = rememberAsync { repo.appointments() }
    AppointmentList(
        state = state,
        emptyMessage = "No appointments in the system yet.",
        onOpen = onOpen,
    )
}
