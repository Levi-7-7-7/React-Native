package com.activitypointsnative

import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.view.View
import android.view.WindowInsetsController
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

  override fun getMainComponentName(): String = "ActivityPointsNative"

  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

  override fun onCreate(savedInstanceState: Bundle?) {
    installSplashScreen()
    super.onCreate(null) // null prevents state restore crash on cold start

    // ── Status bar setup ──────────────────────────────────────────────────
    // React Native's <StatusBar barStyle="dark-content" translucent={false} />
    // handles icon colour at the JS layer.  However, we also need the window
    // flag set at the native level so it takes effect before the JS bridge
    // loads (avoids a flash of wrong-coloured icons on cold start).
    //
    // API 30+: WindowInsetsController  (modern API)
    // API 23–29: SYSTEM_UI_FLAG_LIGHT_STATUS_BAR  (deprecated but still works)
    // API < 23: status bar icons are always white — nothing we can do.
    //
    // Default here is LIGHT icons (suitable for the dark splash background).
    // React Native will override once the JS bundle runs and <StatusBar>
    // mounts, so this is only the pre-JS appearance.
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      // API 30+
      window.insetsController?.setSystemBarsAppearance(
        0, // clear APPEARANCE_LIGHT_STATUS_BARS → white icons (for splash)
        WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS
      )
    } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      // API 23–29
      @Suppress("DEPRECATION")
      window.decorView.systemUiVisibility =
        window.decorView.systemUiVisibility and
          View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR.inv()
    }
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    handleIntent(intent)
  }

  /**
   * Re-sets the intent so react-native-firebase's getInitialNotification()
   * can read it correctly after the JS bundle has loaded.
   * Also guards against null extras that cause crashes on some OEM ROMs.
   */
  private fun handleIntent(intent: Intent) {
    try {
      setIntent(intent)
    } catch (e: Exception) {
      // Never crash the activity over an intent handling error
      e.printStackTrace()
    }
  }
}
