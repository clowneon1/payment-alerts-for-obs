package com.clowneon1.streampe

import android.Manifest
import android.annotation.SuppressLint
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import android.text.TextUtils
import android.view.View
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.app.AppCompatDelegate
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat

class SetupActivity : AppCompatActivity() {

    private var currentStep = 1
    private var notificationAttempts = 0

    private lateinit var tvStepCounter: TextView
    private lateinit var progStep1: View
    private lateinit var progStep2: View
    private lateinit var progStep3: View
    private lateinit var tvStepBadgeNumber: TextView
    private lateinit var tvTitle: TextView
    private lateinit var tvSubtitle: TextView
    private lateinit var tvStatusBadge: TextView
    private lateinit var btnConfigureAction: Button
    private lateinit var layoutRestrictedCard: LinearLayout
    private lateinit var btnAppInfo: Button
    private lateinit var btnNavBack: Button
    private lateinit var btnNavNext: Button

    override fun onCreate(savedInstanceState: Bundle?) {
        AppCompatDelegate.setDefaultNightMode(AppCompatDelegate.MODE_NIGHT_YES)
        setTheme(R.style.Theme_StreamPe)
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_setup)

        requestPostNotificationsPermission()
        bindViews()
        renderCurrentStep()
    }

    override fun onResume() {
        super.onResume()
        renderCurrentStep()
    }

    private fun requestPostNotificationsPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.POST_NOTIFICATIONS), 101)
            }
        }
    }

    private fun bindViews() {
        tvStepCounter        = findViewById(R.id.tvStepCounter)
        progStep1            = findViewById(R.id.progStep1)
        progStep2            = findViewById(R.id.progStep2)
        progStep3            = findViewById(R.id.progStep3)
        tvStepBadgeNumber    = findViewById(R.id.tvStepBadgeNumber)
        tvTitle              = findViewById(R.id.tvTitle)
        tvSubtitle           = findViewById(R.id.tvSubtitle)
        tvStatusBadge        = findViewById(R.id.tvStatusBadge)
        btnConfigureAction   = findViewById(R.id.btnConfigureAction)
        layoutRestrictedCard = findViewById(R.id.layoutRestrictedCard)
        btnAppInfo           = findViewById(R.id.btnAppInfo)
        btnNavBack           = findViewById(R.id.btnNavBack)
        btnNavNext           = findViewById(R.id.btnNavNext)

        btnAppInfo.setOnClickListener { openAppInfo() }

        btnNavBack.setOnClickListener {
            if (currentStep > 1) {
                currentStep--
                renderCurrentStep()
            }
        }
    }

    private fun renderCurrentStep() {
        when (currentStep) {
            1 -> renderStep1Notification()
            2 -> renderStep2Battery()
            3 -> renderStep3Accessibility()
        }
        updateProgressIndicators()
    }

    // ── STEP 1: Notification Listener (MANDATORY) ─────────────────────────
    private fun renderStep1Notification() {
        val isGranted = isNotificationAccessGranted()

        tvStepBadgeNumber.text = "01"
        tvTitle.text = "Notification Access"
        tvSubtitle.text = "Required to detect payment notifications and send alerts to OBS."
        btnConfigureAction.visibility = View.GONE
        btnNavBack.visibility = View.GONE

        if (isGranted) {
            tvStatusBadge.text = "GRANTED ✓"
            tvStatusBadge.setTextColor(Color.parseColor("#00F593"))
            tvStatusBadge.setBackgroundColor(Color.parseColor("#14291e"))
            layoutRestrictedCard.visibility = View.GONE

            btnNavNext.text = "Next ➔"
            btnNavNext.setOnClickListener {
                currentStep = 2
                renderCurrentStep()
            }
        } else {
            tvStatusBadge.text = "REQUIRED (MANDATORY)"
            tvStatusBadge.setTextColor(Color.parseColor("#ef4444"))
            tvStatusBadge.setBackgroundColor(Color.parseColor("#2d1515"))

            if (notificationAttempts > 0) {
                layoutRestrictedCard.visibility = View.VISIBLE
                btnNavNext.text = "Try Again"
            } else {
                layoutRestrictedCard.visibility = View.GONE
                btnNavNext.text = "Enable in Settings"
            }

            btnNavNext.setOnClickListener {
                notificationAttempts++
                try {
                    startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))
                } catch (e: Exception) {
                    Toast.makeText(this, "Open Settings ➔ Notifications ➔ Device & app notifications", Toast.LENGTH_LONG).show()
                }
            }
        }
    }

    // ── STEP 2: Battery Optimization (OPTIONAL) ───────────────────────────
    private fun renderStep2Battery() {
        val isIgnored = isBatteryOptimizationIgnored()

        tvStepBadgeNumber.text = "02"
        tvTitle.text = "Background Keepalive"
        tvSubtitle.text = "Prevents Android from killing StreamPe when your screen turns off during stream."
        layoutRestrictedCard.visibility = View.GONE
        btnNavBack.visibility = View.VISIBLE

        if (isIgnored) {
            tvStatusBadge.text = "ACTIVE ✓"
            tvStatusBadge.setTextColor(Color.parseColor("#00F593"))
            tvStatusBadge.setBackgroundColor(Color.parseColor("#14291e"))
            btnConfigureAction.visibility = View.GONE
        } else {
            tvStatusBadge.text = "RECOMMENDED"
            tvStatusBadge.setTextColor(Color.parseColor("#ffb703"))
            tvStatusBadge.setBackgroundColor(Color.parseColor("#262208"))

            btnConfigureAction.visibility = View.VISIBLE
            btnConfigureAction.text = "Disable Battery Limits"
            btnConfigureAction.setOnClickListener { openBatterySettings() }
        }

        btnNavNext.text = "Next ➔"
        btnNavNext.setOnClickListener {
            currentStep = 3
            renderCurrentStep()
        }
    }

    // ── STEP 3: Accessibility for Amazon Pay (OPTIONAL) ───────────────────
    private fun renderStep3Accessibility() {
        val isEnabled = isAccessibilityServiceEnabled()

        tvStepBadgeNumber.text = "03"
        tvTitle.text = "Amazon Pay Support"
        tvSubtitle.text = "Only needed for Amazon Pay notifications. PhonePe & Google Pay work without this."
        layoutRestrictedCard.visibility = View.GONE
        btnNavBack.visibility = View.VISIBLE

        if (isEnabled) {
            tvStatusBadge.text = "ENABLED ✓"
            tvStatusBadge.setTextColor(Color.parseColor("#00F593"))
            tvStatusBadge.setBackgroundColor(Color.parseColor("#14291e"))
            btnConfigureAction.visibility = View.GONE
        } else {
            tvStatusBadge.text = "OPTIONAL"
            tvStatusBadge.setTextColor(Color.parseColor("#d5baff"))
            tvStatusBadge.setBackgroundColor(Color.parseColor("#1e1433"))

            btnConfigureAction.visibility = View.VISIBLE
            btnConfigureAction.text = "Configure Amazon Pay"
            btnConfigureAction.setTextColor(Color.parseColor("#FFFFFF"))
            btnConfigureAction.backgroundTintList = ContextCompat.getColorStateList(this, R.color.accent)
            btnConfigureAction.setOnClickListener {
                try {
                    startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
                } catch (e: Exception) {
                    Toast.makeText(this, "Open Settings ➔ Accessibility", Toast.LENGTH_SHORT).show()
                }
            }
        }

        btnNavNext.text = "Finish Setup ✓"
        btnNavNext.setOnClickListener { finishOnboarding() }
    }

    private fun updateProgressIndicators() {
        val activeColor = ContextCompat.getColor(this, R.color.accent)
        val inactiveColor = ContextCompat.getColor(this, R.color.surface2)

        progStep1.setBackgroundColor(if (currentStep >= 1) activeColor else inactiveColor)
        progStep2.setBackgroundColor(if (currentStep >= 2) activeColor else inactiveColor)
        progStep3.setBackgroundColor(if (currentStep >= 3) activeColor else inactiveColor)

        tvStepCounter.text = "STEP $currentStep OF 3"
    }

    private fun finishOnboarding() {
        if (!isNotificationAccessGranted()) {
            Toast.makeText(this, "Please enable notification access first", Toast.LENGTH_SHORT).show()
            currentStep = 1
            renderCurrentStep()
            return
        }

        val prefs = AppPrefs(this)
        prefs.isOnboardingComplete = true

        // Start background forwarder service so notification is visible
        try {
            val serviceIntent = Intent(this, NotificationForwarderService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(serviceIntent)
            } else {
                startService(serviceIntent)
            }
        } catch (e: Exception) {}

        startActivity(Intent(this, HomeActivity::class.java))
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

    private fun isBatteryOptimizationIgnored(): Boolean {
        val pm = getSystemService(POWER_SERVICE) as PowerManager
        return pm.isIgnoringBatteryOptimizations(packageName)
    }

    private fun isAccessibilityServiceEnabled(): Boolean {
        val expected = "$packageName/${PaymentAccessibilityService::class.java.canonicalName}"
        val enabledServices = Settings.Secure.getString(
            contentResolver,
            Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
        ) ?: return false
        val splitter = TextUtils.SimpleStringSplitter(':')
        splitter.setString(enabledServices)
        while (splitter.hasNext()) {
            if (splitter.next().equals(expected, ignoreCase = true)) return true
        }
        return false
    }

    private fun openAppInfo() {
        try {
            val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                data = Uri.parse("package:$packageName")
            }
            startActivity(intent)
        } catch (e: Exception) {
            Toast.makeText(this, "Open Settings ➔ Apps ➔ StreamPe", Toast.LENGTH_SHORT).show()
        }
    }

    @SuppressLint("BatteryLife")
    private fun openBatterySettings() {
        try {
            startActivity(
                Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                    data = Uri.parse("package:$packageName")
                }
            )
        } catch (_: ActivityNotFoundException) {
            try {
                startActivity(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS))
            } catch (_: Exception) {
                Toast.makeText(this, "Open Settings ➔ Battery ➔ Unrestricted", Toast.LENGTH_LONG).show()
            }
        }
    }
}
