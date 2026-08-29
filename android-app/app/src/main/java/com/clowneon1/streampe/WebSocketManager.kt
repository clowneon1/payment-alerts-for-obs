package com.clowneon1.streampe

import android.os.Handler
import android.os.Looper
import android.util.Log
import okhttp3.*
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

object WebSocketManager {

    private const val TAG          = "WebSocketManager"
    private const val MAX_QUEUE    = 100
    private const val RECONNECT_MS = 3_000L

    interface ConnectionStateListener {
        fun onConnectionStateChanged(isConnected: Boolean, message: String)
    }

    private val listeners = CopyOnWriteArrayList<ConnectionStateListener>()

    private val client = OkHttpClient.Builder()
        .pingInterval(10, TimeUnit.SECONDS)
        .connectTimeout(5, TimeUnit.SECONDS)
        .readTimeout(0, TimeUnit.SECONDS)
        .build()

    private var webSocket: WebSocket? = null
    private var serverUrl: String     = ""
    private var shouldAutoReconnect   = false
    private val isConnected           = AtomicBoolean(false)
    private val isConnecting          = AtomicBoolean(false)
    private val isReconnecting        = AtomicBoolean(false)
    private val messageQueue          = ArrayDeque<String>(MAX_QUEUE)
    private val handler               = Handler(Looper.getMainLooper())

    fun isConnected(): Boolean = isConnected.get()

    fun addListener(listener: ConnectionStateListener) {
        listeners.add(listener)
        listener.onConnectionStateChanged(
            isConnected.get(),
            if (isConnected.get()) "Connected" else "Disconnected"
        )
    }

    fun removeListener(listener: ConnectionStateListener) {
        listeners.remove(listener)
    }

    private fun notifyState(connected: Boolean, message: String) {
        handler.post {
            for (l in listeners) {
                try { l.onConnectionStateChanged(connected, message) } catch (_: Exception) {}
            }
        }
    }

    fun connect(url: String) {
        shouldAutoReconnect = true
        if (serverUrl == url && (isConnected.get() || isConnecting.get()) && webSocket != null) {
            Log.d(TAG, "Already connected or connecting to $url — skipping duplicate connection")
            return
        }
        serverUrl = url
        openSocket()
    }

    fun connectIfNeeded(url: String) {
        if (!shouldAutoReconnect && serverUrl.isBlank()) return
        shouldAutoReconnect = true
        if (serverUrl == url && (isConnected.get() || isConnecting.get()) && webSocket != null) return
        serverUrl = url
        openSocket()
    }

    fun send(message: String) {
        if (isConnected.get() && webSocket != null) {
            val sent = webSocket!!.send(message)
            if (!sent) {
                queueMessage(message)
                if (shouldAutoReconnect) scheduleReconnect()
            }
        } else {
            queueMessage(message)
            if (shouldAutoReconnect && !isReconnecting.get() && !isConnecting.get()) {
                scheduleReconnect()
            }
        }
    }

    private fun queueMessage(message: String) {
        if (messageQueue.size >= MAX_QUEUE) messageQueue.removeFirst()
        messageQueue.addLast(message)
    }

    fun ping() {
        if (isConnected.get()) {
            val sent = webSocket?.send("{\"type\":\"ping\"}") ?: false
            if (!sent) {
                isConnected.set(false)
                notifyState(false, "Server ping failed — Reconnecting...")
                if (shouldAutoReconnect) scheduleReconnect()
            }
        } else if (shouldAutoReconnect && !isReconnecting.get() && !isConnecting.get() && serverUrl.isNotBlank()) {
            scheduleReconnect()
        }
    }

    fun disconnect() {
        shouldAutoReconnect = false
        serverUrl = ""
        handler.removeCallbacksAndMessages(null)
        val oldWs = webSocket
        webSocket     = null
        isConnecting.set(false)
        isConnected.set(false)
        isReconnecting.set(false)
        try { oldWs?.close(1000, "User disconnected") } catch (_: Exception) {}
        try { oldWs?.cancel() } catch (_: Exception) {}
        messageQueue.clear()
        notifyState(false, "Disconnected by user")
    }

    private fun openSocket() {
        if (serverUrl.isBlank()) return
        if (isConnecting.getAndSet(true)) {
            Log.d(TAG, "Connection attempt already in progress — skipping duplicate openSocket call")
            return
        }

        val oldWs = webSocket
        webSocket = null
        try { oldWs?.close(1000, "Replaced by new connection") } catch (_: Exception) {}
        try { oldWs?.cancel() } catch (_: Exception) {}

        val request = Request.Builder().url(serverUrl).build()
        webSocket = client.newWebSocket(request, object : WebSocketListener() {

            override fun onOpen(ws: WebSocket, response: Response) {
                Log.d(TAG, "Connected to $serverUrl")
                isConnecting.set(false)
                isConnected.set(true)
                isReconnecting.set(false)
                notifyState(true, "Connected to PC Server")

                while (messageQueue.isNotEmpty()) {
                    ws.send(messageQueue.removeFirst())
                }
            }

            override fun onMessage(ws: WebSocket, text: String) {
                try {
                    val json = org.json.JSONObject(text)
                    if (json.optString("type") == "network_changed") {
                        val newIp = json.optString("primaryIp")
                        if (newIp.isNotBlank() && serverUrl.isNotBlank() && shouldAutoReconnect) {
                            val uri = java.net.URI(serverUrl)
                            val newUrl = "ws://$newIp:${if (uri.port > 0) uri.port else 2907}/android"
                            Log.d(TAG, "🌐 PC Server IP changed mid-session: reconnecting to $newUrl")
                            serverUrl = newUrl
                            openSocket()
                        }
                    }
                } catch (_: Exception) {}
            }

            override fun onFailure(ws: WebSocket, t: Throwable, response: Response?) {
                Log.w(TAG, "Connection failure to $serverUrl: ${t.message}")
                isConnecting.set(false)
                isConnected.set(false)
                notifyState(false, "Server Offline")
                if (shouldAutoReconnect) scheduleReconnect()
            }

            override fun onClosing(ws: WebSocket, code: Int, reason: String) {
                ws.close(1000, null)
                isConnecting.set(false)
                isConnected.set(false)
                notifyState(false, "Server Closed Connection")
                if (shouldAutoReconnect && webSocket == ws) scheduleReconnect()
            }

            override fun onClosed(ws: WebSocket, code: Int, reason: String) {
                isConnecting.set(false)
                isConnected.set(false)
                notifyState(false, "Disconnected")
                if (shouldAutoReconnect && webSocket == ws) scheduleReconnect()
            }
        })
    }

    private fun scheduleReconnect() {
        if (!shouldAutoReconnect || serverUrl.isBlank()) return
        if (isReconnecting.getAndSet(true)) return
        handler.postDelayed({
            isReconnecting.set(false)
            if (shouldAutoReconnect && !isConnected.get() && !isConnecting.get() && serverUrl.isNotBlank()) {
                Log.d(TAG, "Attempting auto-reconnect to $serverUrl...")
                notifyState(false, "Reconnecting to server...")
                openSocket()
            }
        }, RECONNECT_MS)
    }
}
