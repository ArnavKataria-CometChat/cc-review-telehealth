package com.telehealth.consult.data

import kotlinx.serialization.json.Json

/** Single tolerant JSON codec shared across the data layer. */
val Json: Json = Json {
    ignoreUnknownKeys = true
    encodeDefaults = false
    explicitNulls = false
}
