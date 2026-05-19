# ─────────────────────────────────────────────────────────────────────────────
# React Native — core
# R8 must never touch the JS bridge, native module registry, or Hermes classes.
# ─────────────────────────────────────────────────────────────────────────────
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }
-dontwarn com.facebook.react.**
-dontwarn com.facebook.hermes.**
-dontwarn com.facebook.jni.**

# ─────────────────────────────────────────────────────────────────────────────
# React Native New Architecture (Fabric + TurboModules)
# These are looked up by name at runtime via C++ JNI — R8 must not rename them.
# ─────────────────────────────────────────────────────────────────────────────
-keep class com.facebook.react.defaults.** { *; }
-keep class com.facebook.react.fabric.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }
-keep class com.facebook.react.bridge.** { *; }
-keep class com.facebook.react.uimanager.** { *; }

# ─────────────────────────────────────────────────────────────────────────────
# Firebase — react-native-firebase
# Firebase initialises via reflection and uses Class.forName() internally.
# ─────────────────────────────────────────────────────────────────────────────
-keep class io.invertase.firebase.** { *; }
-dontwarn io.invertase.firebase.**

# Firebase SDK itself
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.firebase.**
-dontwarn com.google.android.gms.**

# Firebase Messaging service declared in AndroidManifest — must never be renamed
-keep class io.invertase.firebase.messaging.ReactNativeFirebaseMessagingService { *; }

# ─────────────────────────────────────────────────────────────────────────────
# Notifee
# ─────────────────────────────────────────────────────────────────────────────
-keep class io.notifee.** { *; }
-dontwarn io.notifee.**
-keep class app.notifee.** { *; }
-dontwarn app.notifee.**

# ─────────────────────────────────────────────────────────────────────────────
# React Native Vector Icons
# Font manager is resolved by name — stripping it removes all icons at runtime.
# ─────────────────────────────────────────────────────────────────────────────
-keep class com.oblador.vectoricons.** { *; }
-dontwarn com.oblador.vectoricons.**

# ─────────────────────────────────────────────────────────────────────────────
# AsyncStorage
# ─────────────────────────────────────────────────────────────────────────────
-keep class com.reactnativecommunity.asyncstorage.** { *; }
-dontwarn com.reactnativecommunity.asyncstorage.**

# ─────────────────────────────────────────────────────────────────────────────
# React Navigation + Screens + Safe Area
# ─────────────────────────────────────────────────────────────────────────────
-keep class com.swmansion.** { *; }
-dontwarn com.swmansion.**
-keep class com.th3rdwave.safeareacontext.** { *; }
-dontwarn com.th3rdwave.safeareacontext.**

# ─────────────────────────────────────────────────────────────────────────────
# React Native Image Picker
# ─────────────────────────────────────────────────────────────────────────────
-keep class com.imagepicker.** { *; }
-dontwarn com.imagepicker.**

# ─────────────────────────────────────────────────────────────────────────────
# React Native Document Picker
# ─────────────────────────────────────────────────────────────────────────────
-keep class com.reactnativedocumentpicker.** { *; }
-dontwarn com.reactnativedocumentpicker.**
-keep class com.rnfs.** { *; }

# ─────────────────────────────────────────────────────────────────────────────
# React Native DateTime Picker
# ─────────────────────────────────────────────────────────────────────────────
-keep class com.reactcommunity.rndatetimepicker.** { *; }
-dontwarn com.reactcommunity.rndatetimepicker.**

# ─────────────────────────────────────────────────────────────────────────────
# OkHttp / Okio (used by axios / Firebase under the hood)
# ─────────────────────────────────────────────────────────────────────────────
-dontwarn okhttp3.**
-dontwarn okio.**
-keep class okhttp3.** { *; }
-keep class okio.** { *; }

# ─────────────────────────────────────────────────────────────────────────────
# Suppress R8 warnings from Google Play Services obfuscated JARs
# (the "Invalid stack map table" warnings you see during the build)
# ─────────────────────────────────────────────────────────────────────────────
-dontwarn com.google.android.gms.auth.**

# ─────────────────────────────────────────────────────────────────────────────
# General safety — never strip classes/methods accessed via reflection
# ─────────────────────────────────────────────────────────────────────────────
-keepattributes *Annotation*
-keepattributes Signature
-keepattributes Exceptions
-keepattributes InnerClasses
-keepattributes EnclosingMethod

# Keep all native methods (JNI)
-keepclasseswithmembernames class * {
    native <methods>;
}

# Keep enums (commonly accessed via valueOf/values via reflection)
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}

# Keep Parcelable implementations (used heavily by Android intents)
-keep class * implements android.os.Parcelable {
    public static final android.os.Parcelable$Creator *;
}

# Keep Serializable classes
-keepclassmembers class * implements java.io.Serializable {
    static final long serialVersionUID;
    private static final java.io.ObjectStreamField[] serialPersistentFields;
    private void writeObject(java.io.ObjectOutputStream);
    private void readObject(java.io.ObjectInputStream);
    java.lang.Object writeReplace();
    java.lang.Object readResolve();
}