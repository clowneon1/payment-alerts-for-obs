package com.clowneon1.streampe

import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import android.text.TextUtils
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val prefs = AppPrefs(this)

        if (!isNotificationAccessGranted() || !prefs.isOnboardingComplete) {
            startActivity(Intent(this, SetupActivity::class.java))
        } else {
            startActivity(Intent(this, HomeActivity::class.java))
        }
        finish()
    }

    private fun isNotificationAccessGranted(): Boolean {
        val flat = Settings.Secure.getString(contentResolver, "enabled_notification_listeners") ?: return false
        val pkg = packageName
        return flat.split(":").any { comp ->
            val slash = comp.indexOf('/')
            val compPkg = if (slash != -1) comp.substring(0, slash) else comp
            compPkg == pkg
        }
    }
}
