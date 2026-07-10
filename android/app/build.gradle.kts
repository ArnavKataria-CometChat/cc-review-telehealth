import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
    id("org.jetbrains.kotlin.plugin.serialization")
}

// CometChat client credentials (Phase B). App ID + Region only — these are the
// non-secret values a client is allowed to hold. The REST API Key and Auth Key
// stay server-side (../backend); the client logs in with a backend-issued auth
// token. Values live in local.properties (gitignored) and surface as BuildConfig
// fields — never hardcoded in source, never committed.
val localProps = Properties().apply {
    val f = rootProject.file("local.properties")
    if (f.exists()) f.inputStream().use { load(it) }
}

// Base URL of the backend REST API (../backend, Express on :4000).
// Overridable without touching source: pass -PtelehealthApiBaseUrl=... or set
// the TELEHEALTH_API_BASE_URL env var. Default targets the Android emulator,
// where 10.0.2.2 is the host loopback (i.e. the machine running the backend).
val apiBaseUrl: String =
    (project.findProperty("telehealthApiBaseUrl") as String?)
        ?: System.getenv("TELEHEALTH_API_BASE_URL")
        ?: "http://10.0.2.2:4000/api/"

android {
    namespace = "com.telehealth.consult"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.telehealth.consult"
        // CometChat UI Kit v6 requires minSdk 28 (raised from 24 for Phase B).
        minSdk = 28
        targetSdk = 36
        versionCode = 1
        versionName = "1.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        buildConfigField("String", "API_BASE_URL", "\"$apiBaseUrl\"")
        buildConfigField(
            "String",
            "COMETCHAT_APP_ID",
            "\"${localProps.getProperty("cometchat.appId", "")}\"",
        )
        buildConfigField(
            "String",
            "COMETCHAT_REGION",
            "\"${localProps.getProperty("cometchat.region", "")}\"",
        )
    }

    buildTypes {
        debug {
            // Point at the emulator host loopback by default (see apiBaseUrl).
        }
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }
}

configurations.all {
    // The CometChat Chat SDK transitively pulls org.jetbrains:annotations-java5,
    // which duplicate-classes with Kotlin stdlib's org.jetbrains:annotations.
    exclude(group = "org.jetbrains", module = "annotations-java5")
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2025.08.00")
    implementation(composeBom)

    // --- CometChat (Phase B): chat + calling, Jetpack Compose UI Kit v6 --------
    // 6.0.+ tracks the latest GA patch (never pin a -beta). The Calls SDK is a
    // REQUIRED peer dep even though V6 markets calling as "bundled": the chatuikit
    // AAR bytecode-references CometChatCalls$SessionSettingsBuilder, which ships
    // only in calls-sdk-android — without it the app crashes at init.
    implementation("com.cometchat:chatuikit-compose-android:6.0.+")
    implementation("com.cometchat:calls-sdk-android:5.0.+")

    implementation("androidx.core:core-ktx:1.16.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.9.0")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.9.0")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.9.0")
    implementation("androidx.activity:activity-compose:1.10.1")

    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.foundation:foundation")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("androidx.navigation:navigation-compose:2.9.0")

    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("com.squareup.okhttp3:logging-interceptor:4.12.0")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.6.3")

    debugImplementation("androidx.compose.ui:ui-tooling")

    testImplementation("junit:junit:4.13.2")
}
