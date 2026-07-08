package com.telehealth.consult.ui.doctor

import androidx.compose.runtime.Composable
import com.telehealth.consult.ui.appointment.AppointmentList
import com.telehealth.consult.ui.common.LocalContainer
import com.telehealth.consult.ui.common.rememberAsync

/** "My Schedule" — GET /appointments is scoped server-side to this doctor's own. */
@Composable
fun DoctorScheduleScreen(onOpen: (String) -> Unit) {
    val repo = LocalContainer.current.repository
    val (state, _) = rememberAsync { repo.appointments() }
    AppointmentList(
        state = state,
        emptyMessage = "No appointments on your schedule.",
        onOpen = onOpen,
    )
}
