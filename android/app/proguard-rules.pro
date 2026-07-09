# kotlinx.serialization keeps generated serializers on companions; retain them.
-keepclassmembers class **$$serializer { *; }
-keepclasseswithmembers class com.telehealth.consult.data.** {
    kotlinx.serialization.KSerializer serializer(...);
}
-keep,includedescriptorclasses class com.telehealth.consult.data.**$$serializer { *; }

# CometChat UI Kit / Chat / Calls SDKs (Phase B) — keep so release R8 doesn't
# strip kit classes (would crash with ClassNotFoundException at runtime).
-keep class com.cometchat.** { *; }
-dontwarn com.cometchat.**
