// Top-level build file. Plugin versions are declared here with `apply false`
// and applied in module build files. Keeps the Android/Kotlin toolchain aligned.
plugins {
    // Kotlin 2.2.0: the CometChat UI Kit v6 GA artifacts (chatuikit-*-android:6.0.2)
    // ship Kotlin 2.2.0 metadata; an older compiler fails compileDebugKotlin with an
    // "incompatible metadata version" error, so the toolchain is aligned to 2.2.0.
    id("com.android.application") version "8.11.1" apply false
    id("org.jetbrains.kotlin.android") version "2.2.0" apply false
    id("org.jetbrains.kotlin.plugin.compose") version "2.2.0" apply false
    id("org.jetbrains.kotlin.plugin.serialization") version "2.2.0" apply false
}
