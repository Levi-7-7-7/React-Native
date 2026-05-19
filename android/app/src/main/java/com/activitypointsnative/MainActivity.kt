package com.activitypointsnative

// import android.animation.AnimatorListenerAdapter
// import android.animation.AnimatorSet
// import android.animation.ObjectAnimator
import android.content.Intent
// import android.os.Build
import android.os.Bundle
// import android.view.View
// import android.view.animation.AnticipateInterpolator
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
    val splashScreen = installSplashScreen()
    super.onCreate(null) // null prevents state restore crash on cold start

   /* if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      splashScreen.setOnExitAnimationListener { splashScreenViewProvider ->
        val splashScreenView = splashScreenViewProvider.view
        val iconView = splashScreenViewProvider.iconView

        val scaleX = ObjectAnimator.ofFloat(iconView, View.SCALE_X, 1f, 0f)
        val scaleY = ObjectAnimator.ofFloat(iconView, View.SCALE_Y, 1f, 0f)
        val fadeIcon = ObjectAnimator.ofFloat(iconView, View.ALPHA, 1f, 0f)
        val fadeBackground = ObjectAnimator.ofFloat(splashScreenView, View.ALPHA, 1f, 0f)

        val iconAnimator = AnimatorSet().apply {
          playTogether(scaleX, scaleY, fadeIcon)
          duration = 400
          interpolator = AnticipateInterpolator()
        }

        val bgAnimator = AnimatorSet().apply {
          play(fadeBackground)
          duration = 500
          startDelay = 200
        }

        AnimatorSet().apply {
          playTogether(iconAnimator, bgAnimator)
          addListener(object : AnimatorListenerAdapter() {
            override fun onAnimationEnd(animation: android.animation.Animator) {
              splashScreenViewProvider.remove()
            }
          })
          start()
        }
      }
    }

    // ✅ FIX: When app is cold-started from a killed state via FCM notification,
    // store the launching intent and re-deliver it once the activity is ready.
    // Without this, the intent arrives before the JS bridge is initialised → crash.
    intent?.let { handleIntent(it) }  */
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
