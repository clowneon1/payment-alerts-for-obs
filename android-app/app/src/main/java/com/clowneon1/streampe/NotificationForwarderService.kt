package com.clowneon1.streampe

import android.app.*
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.*
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat

class NotificationForwarderService : Service() {

    companion object {
        const val CHANNEL_ID = "streampe_channel"
        const val NOTIF_ID   = 1
        const val ACTION_STOP = "com.clowneon1.streampe.STOP_SERVICE"
    }

    private var wakeLock: PowerManager.WakeLock? = null
    private val keepAliveHandler  = Handler(Looper.getMainLooper())
    private val keepAliveInterval = 25_000L // 25 seconds

    private val keepAliveRunnable = object : Runnable {
        override fun run() {
            WebSocketManager.ping()
            keepAliveHandler.postDelayed(this, keepAliveInterval)
        }
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        ServiceCompat.startForeground(
            this,
            NOTIF_ID,
            buildNotification(),
            ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
        )
        acquireWakeLock()
        keepAliveHandler.postDelayed(keepAliveRunnable, keepAliveInterval)

        WebSocketManager.onServerUrlChanged = { newUrl ->
            try {
                AppPrefs(this).serverUrl = newUrl
            } catch (_: Exception) {}
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            stopSelf()
            return START_NOT_STICKY
        }

        val prefs = AppPrefs(this)
        if (prefs.serverUrl.isNotBlank() && prefs.isConnected) {
            val wsUrl = prefs.serverUrl
                .replace("http://", "ws://")
                .replace("https://", "wss://")
                .trimEnd('/') + "/android"
            WebSocketManager.connectIfNeeded(wsUrl)
        }

        NotificationService.allowedPackages = prefs.selectedPackages
        return START_STICKY
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        try {
            val restartIntent = Intent(applicationContext, NotificationForwarderService::class.java)
            val pending = PendingIntent.getService(
                applicationContext, 1, restartIntent,
                PendingIntent.FLAG_ONE_SHOT or PendingIntent.FLAG_IMMUTABLE
            )
            val alarm = getSystemService(ALARM_SERVICE) as AlarmManager
            alarm.set(AlarmManager.ELAPSED_REALTIME, SystemClock.elapsedRealtime() + 2000, pending)
        } catch (_: Exception) {}
        super.onTaskRemoved(rootIntent)
    }

    override fun onDestroy() {
        keepAliveHandler.removeCallbacks(keepAliveRunnable)
        if (wakeLock?.isHeld == true) {
            try { wakeLock?.release() } catch (_: Exception) {}
        }
        wakeLock = null
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun acquireWakeLock() {
        val pm = getSystemService(POWER_SERVICE) as PowerManager
        wakeLock = pm.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK,
            "StreamPe::NotificationWakeLock"
        ).also {
            try {
                it.acquire(10 * 60 * 1000L)
            } catch (_: Exception) {}
        }
    }

    private fun buildNotification(): Notification {
        val openIntent = PendingIntent.getActivity(
            this, 0,
            Intent(this, HomeActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE
        )
        val stopIntent = PendingIntent.getService(
            this, 0,
            Intent(this, NotificationForwarderService::class.java).apply { action = ACTION_STOP },
            PendingIntent.FLAG_IMMUTABLE
        )
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("StreamPe")
            .setContentText("Active — listening for payment notifications")
            .setSmallIcon(R.mipmap.ic_launcher)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setContentIntent(openIntent)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Stop", stopIntent)
            .build()
    }

    private fun createNotificationChannel() {
        val channel = NotificationChannel(
            CHANNEL_ID,
            "StreamPe Background Service",
            NotificationManager.IMPORTANCE_LOW
        ).apply { description = "Keeps payment notification listener active during stream" }
        getSystemService(NotificationManager::class.java)?.createNotificationChannel(channel)
    }
}
