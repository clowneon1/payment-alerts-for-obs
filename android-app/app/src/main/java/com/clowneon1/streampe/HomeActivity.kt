package com.clowneon1.streampe

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.view.View
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.app.AppCompatDelegate
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.fragment.app.Fragment

class HomeActivity : AppCompatActivity() {

    private lateinit var prefs: AppPrefs

    // Header Views
    private lateinit var dotStatus: View
    private lateinit var tvHeaderSubtitle: TextView
    private lateinit var btnHeaderDisconnect: Button
    private lateinit var btnHeaderInfo: Button

    // Bottom Navigation Bar (3 Tabs: Retrigger, Apps, Test)
    private lateinit var layoutBottomNav: LinearLayout
    private lateinit var btnNavLogs: Button
    private lateinit var btnNavApps: Button
    private lateinit var btnNavTest: Button

    private var activeStreamTab = 0 // 0 = Retrigger (Logs), 1 = Apps, 2 = Test

    private val wsListener = object : WebSocketManager.ConnectionStateListener {
        override fun onConnectionStateChanged(isConnected: Boolean, message: String) {
            runOnUiThread {
                syncConnectionUI(isConnected)
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        AppCompatDelegate.setDefaultNightMode(AppCompatDelegate.MODE_NIGHT_YES)
        setTheme(R.style.Theme_StreamPe)
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_home)

        prefs = AppPrefs(this)
        AlertLog.init(this)

        requestPostNotificationsPermission()
        bindViews()
        setupListeners()

        val isAlreadyConnected = WebSocketManager.isConnected()
        if (isAlreadyConnected) {
            syncConnectionUI(true)
            switchStreamTab(0)
        } else if (prefs.serverUrl.isNotBlank() && prefs.isConnected) {
            autoReconnect()
            showConnectScreen()
        } else {
            showConnectScreen()
        }
    }

    override fun onResume() {
        super.onResume()
        WebSocketManager.addListener(wsListener)
        syncConnectionUI(WebSocketManager.isConnected())
    }

    override fun onPause() {
        super.onPause()
        WebSocketManager.removeListener(wsListener)
    }

    private fun requestPostNotificationsPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.POST_NOTIFICATIONS), 101)
            }
        }
    }

    private fun bindViews() {
        dotStatus           = findViewById(R.id.dotStatus)
        tvHeaderSubtitle    = findViewById(R.id.tvHeaderSubtitle)
        btnHeaderDisconnect = findViewById(R.id.btnHeaderDisconnect)
        btnHeaderInfo       = findViewById(R.id.btnHeaderInfo)

        layoutBottomNav     = findViewById(R.id.layoutBottomNav)
        btnNavLogs          = findViewById(R.id.btnNavLogs)
        btnNavApps          = findViewById(R.id.btnNavApps)
        btnNavTest          = findViewById(R.id.btnNavTest)
    }

    private fun setupListeners() {
        btnNavLogs.setOnClickListener { switchStreamTab(0) }
        btnNavApps.setOnClickListener { switchStreamTab(1) }
        btnNavTest.setOnClickListener { switchStreamTab(2) }

        btnHeaderDisconnect.setOnClickListener {
            disconnectFromServer()
        }

        btnHeaderInfo.setOnClickListener {
            startActivity(Intent(this, AboutActivity::class.java))
        }
    }

    fun onConnectedToServer() {
        syncConnectionUI(true)
        switchStreamTab(0)
    }

    fun syncConnectionUI(isConnected: Boolean) {
        if (isConnected) {
            dotStatus.setBackgroundColor(Color.parseColor("#00F593"))
            val cleanHost = prefs.serverUrl.replace("http://", "").replace("https://", "")
            tvHeaderSubtitle.text = if (cleanHost.isNotBlank()) cleanHost else "Connected"
            tvHeaderSubtitle.setTextColor(Color.parseColor("#00F593"))
            btnHeaderDisconnect.visibility = View.VISIBLE
            layoutBottomNav.visibility = View.VISIBLE

            val currentFrag = supportFragmentManager.findFragmentById(R.id.containerContent)
            if (currentFrag is ConnectFragment || currentFrag == null) {
                switchStreamTab(activeStreamTab)
            }
        } else {
            dotStatus.setBackgroundColor(Color.parseColor("#ef4444"))
            tvHeaderSubtitle.text = "Offline"
            tvHeaderSubtitle.setTextColor(Color.parseColor("#71717a"))
            btnHeaderDisconnect.visibility = View.GONE
            layoutBottomNav.visibility = View.GONE

            val currentFrag = supportFragmentManager.findFragmentById(R.id.containerContent)
            if (currentFrag !is ConnectFragment) {
                showConnectScreen()
            }
        }
    }

    private fun showConnectScreen() {
        supportFragmentManager.beginTransaction()
            .replace(R.id.containerContent, ConnectFragment())
            .commitAllowingStateLoss()
    }

    private fun switchStreamTab(index: Int) {
        activeStreamTab = index
        val targetFragment: Fragment = when (index) {
            0 -> RecentAlertsFragment()
            1 -> AppSelectorFragment()
            else -> TestAlertFragment()
        }

        supportFragmentManager.beginTransaction()
            .replace(R.id.containerContent, targetFragment)
            .commitAllowingStateLoss()

        val activeBg     = ContextCompat.getColor(this, R.color.accent)
        val inactiveBg   = ContextCompat.getColor(this, R.color.surface2)
        val activeText   = Color.WHITE
        val inactiveText = ContextCompat.getColor(this, R.color.textMuted)

        btnNavLogs.setBackgroundColor(if (index == 0) activeBg else inactiveBg)
        btnNavLogs.setTextColor(if (index == 0) activeText else inactiveText)

        btnNavApps.setBackgroundColor(if (index == 1) activeBg else inactiveBg)
        btnNavApps.setTextColor(if (index == 1) activeText else inactiveText)

        btnNavTest.setBackgroundColor(if (index == 2) activeBg else inactiveBg)
        btnNavTest.setTextColor(if (index == 2) activeText else inactiveText)
    }

    private fun disconnectFromServer() {
        WebSocketManager.disconnect()
        prefs.isConnected = false
        stopService(Intent(this, NotificationForwarderService::class.java))
        syncConnectionUI(false)
        showConnectScreen()
        Toast.makeText(this, "Disconnected from server", Toast.LENGTH_SHORT).show()
    }

    private fun autoReconnect() {
        val url = prefs.serverUrl
        if (url.isBlank()) return

        val wsUrl = url
            .replace("http://", "ws://")
            .replace("https://", "wss://")
            .trimEnd('/') + "/android"

        WebSocketManager.connectIfNeeded(wsUrl)

        val serviceIntent = Intent(this, NotificationForwarderService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(serviceIntent)
        } else {
            startService(serviceIntent)
        }
    }
}
