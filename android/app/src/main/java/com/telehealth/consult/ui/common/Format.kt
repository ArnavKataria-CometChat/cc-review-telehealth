package com.telehealth.consult.ui.common

import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Formats an ISO-8601 instant (as returned by the backend) into a friendly
 * local date-time. Falls back to the raw string if parsing fails.
 */
fun formatInstant(iso: String?): String {
    if (iso.isNullOrBlank()) return "—"
    return runCatching {
        val parser = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US).apply {
            timeZone = java.util.TimeZone.getTimeZone("UTC")
        }
        // Trim milliseconds / trailing Z that SimpleDateFormat's pattern won't take.
        val cleaned = iso.substringBefore('.').removeSuffix("Z")
        val date: Date = parser.parse(cleaned) ?: return iso
        SimpleDateFormat("EEE, MMM d · h:mm a", Locale.getDefault()).format(date)
    }.getOrDefault(iso)
}

fun formatDuration(minutes: Int?): String =
    if (minutes == null) "" else "$minutes min"

/**
 * Builds an RFC-3339 UTC timestamp [hoursFromNow] into the future — used by the
 * staff slot creator. Avoids java.time so it runs on minSdk 24 without desugaring.
 */
fun isoFromHoursFromNow(hoursFromNow: Double): String {
    val millis = System.currentTimeMillis() + (hoursFromNow * 3_600_000L).toLong()
    val fmt = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US).apply {
        timeZone = java.util.TimeZone.getTimeZone("UTC")
    }
    return fmt.format(Date(millis))
}
