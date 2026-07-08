package com.telehealth.consult.ui.admin

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.telehealth.consult.data.model.AuditEntry
import com.telehealth.consult.ui.common.AsyncContent
import com.telehealth.consult.ui.common.Badge
import com.telehealth.consult.ui.common.EmptyState
import com.telehealth.consult.ui.common.LocalContainer
import com.telehealth.consult.ui.common.formatInstant
import com.telehealth.consult.ui.common.rememberAsync

/** Admin audit trail — full, read-only oversight of platform actions. */
@Composable
fun AdminAuditScreen() {
    val repo = LocalContainer.current.repository
    val (state, reload) = rememberAsync { repo.audit() }

    Column(Modifier.fillMaxSize()) {
        Text(
            "Audit log",
            style = MaterialTheme.typography.titleLarge,
            modifier = Modifier.padding(start = 16.dp, top = 12.dp),
        )
        AsyncContent(state, onRetry = { reload.reload() }) { entries ->
            if (entries.isEmpty()) {
                EmptyState("No audit entries yet.")
            } else {
                LazyColumn(
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    items(entries, key = { it.id }) { entry -> AuditRow(entry) }
                }
            }
        }
    }
}

@Composable
private fun AuditRow(entry: AuditEntry) {
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(12.dp)) {
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Badge(entry.action, MaterialTheme.colorScheme.primary)
                entry.actorRole?.let { Badge(it.name.lowercase(), MaterialTheme.colorScheme.tertiary) }
            }
            Text(
                entry.target,
                style = MaterialTheme.typography.bodyMedium,
                modifier = Modifier.padding(top = 6.dp),
            )
            entry.detail?.let {
                Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Text(
                formatInstant(entry.at),
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 4.dp),
            )
        }
    }
}
