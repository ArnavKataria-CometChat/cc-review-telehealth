package com.telehealth.consult.ui.appointment

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.dp
import com.telehealth.consult.data.model.AppointmentView
import com.telehealth.consult.ui.common.Async
import com.telehealth.consult.ui.common.AsyncContent
import com.telehealth.consult.ui.common.EmptyState

/** Shared list body: renders a role-scoped set of appointments. */
@Composable
fun AppointmentList(
    state: Async<List<AppointmentView>>,
    emptyMessage: String,
    onOpen: (String) -> Unit,
) {
    AsyncContent(state) { appointments ->
        if (appointments.isEmpty()) {
            EmptyState(emptyMessage)
        } else {
            LazyColumn(
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                items(appointments, key = { it.id }) { appt ->
                    AppointmentCard(appt) { onOpen(appt.id) }
                }
            }
        }
    }
}
