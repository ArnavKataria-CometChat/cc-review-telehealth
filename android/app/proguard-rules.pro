# kotlinx.serialization keeps generated serializers on companions; retain them.
-keepclassmembers class **$$serializer { *; }
-keepclasseswithmembers class com.telehealth.consult.data.** {
    kotlinx.serialization.KSerializer serializer(...);
}
-keep,includedescriptorclasses class com.telehealth.consult.data.**$$serializer { *; }
