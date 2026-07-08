package com.telehealth.consult.ui.common

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.telehealth.consult.data.model.AppointmentStatus
import com.telehealth.consult.data.model.Role
import com.telehealth.consult.data.model.SlotStatus

/** Renders [Async] state: spinner, retryable error, or the success content. */
@Composable
fun <T> AsyncContent(
    state: Async<T>,
    onRetry: (() -> Unit)? = null,
    content: @Composable (T) -> Unit,
) {
    when (state) {
        is Async.Loading -> CenteredBox { CircularProgressIndicator() }
        is Async.Failure -> ErrorState(state.message, onRetry)
        is Async.Success -> content(state.data)
    }
}

@Composable
fun CenteredBox(content: @Composable () -> Unit) {
    Box(Modifier.fillMaxSize().padding(24.dp), contentAlignment = Alignment.Center) { content() }
}

@Composable
fun ErrorState(message: String, onRetry: (() -> Unit)? = null) {
    CenteredBox {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(
                message,
                textAlign = TextAlign.Center,
                color = MaterialTheme.colorScheme.error,
                style = MaterialTheme.typography.bodyMedium,
            )
            if (onRetry != null) Button(onClick = onRetry) { Text("Retry") }
        }
    }
}

@Composable
fun EmptyState(message: String) {
    CenteredBox {
        Text(
            message,
            textAlign = TextAlign.Center,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodyMedium,
        )
    }
}

/** Small coloured pill used for statuses and roles. */
@Composable
fun Badge(text: String, color: androidx.compose.ui.graphics.Color) {
    Surface(color = color.copy(alpha = 0.16f), shape = RoundedCornerShape(50)) {
        Text(
            text,
            color = color,
            style = MaterialTheme.typography.labelMedium,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
        )
    }
}

@Composable
fun StatusBadge(status: AppointmentStatus) {
    val (label, color) = when (status) {
        AppointmentStatus.SCHEDULED -> "Scheduled" to MaterialTheme.colorScheme.tertiary
        AppointmentStatus.IN_PROGRESS -> "In progress" to MaterialTheme.colorScheme.primary
        AppointmentStatus.COMPLETED -> "Completed" to MaterialTheme.colorScheme.onSurfaceVariant
        AppointmentStatus.CANCELLED -> "Cancelled" to MaterialTheme.colorScheme.error
    }
    Badge(label, color)
}

@Composable
fun SlotBadge(status: SlotStatus) {
    val (label, color) = when (status) {
        SlotStatus.OPEN -> "Open" to MaterialTheme.colorScheme.primary
        SlotStatus.BOOKED -> "Booked" to MaterialTheme.colorScheme.onSurfaceVariant
    }
    Badge(label, color)
}

@Composable
fun RoleBadge(role: Role) {
    val color = when (role) {
        Role.PATIENT -> MaterialTheme.colorScheme.tertiary
        Role.DOCTOR -> MaterialTheme.colorScheme.primary
        Role.STAFF -> MaterialTheme.colorScheme.secondary
        Role.ADMIN -> MaterialTheme.colorScheme.error
    }
    Badge(role.name.lowercase().replaceFirstChar { it.uppercase() }, color)
}

fun defaultContentPadding() = PaddingValues(16.dp)

@Composable
fun SectionHeader(text: String, modifier: Modifier = Modifier) {
    Text(
        text,
        style = MaterialTheme.typography.titleSmall,
        color = MaterialTheme.colorScheme.primary,
        modifier = modifier.fillMaxWidth().padding(top = 8.dp, bottom = 4.dp),
    )
}
