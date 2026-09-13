package com.clowneon1.streampe

import android.content.Context
import android.net.wifi.WifiManager
import android.net.nsd.NsdManager
import android.net.nsd.NsdServiceInfo
import android.os.Handler
import android.os.Looper
import android.util.Log
import java.net.InetAddress
import kotlin.concurrent.thread

data class DiscoveredServer(
    val serviceName: String,
    val host: String,
    val port: Int,
    val ipAddress: String,
    val httpUrl: String,
    val wsUrl: String,
    val version: String = AppConstants.APP_VERSION
)

class ServerDiscoveryManager(private val context: Context) {

    companion object {
        private const val TAG = "ServerDiscovery"
        private const val SERVICE_TYPE_STREAMPE = AppConstants.SERVICE_TYPE_STREAMPE
        private const val SERVICE_TYPE_LEGACY = AppConstants.SERVICE_TYPE_LEGACY
        const val DEFAULT_SCAN_DURATION_MS = AppConstants.DEFAULT_SCAN_DURATION_MS
        val FALLBACK_PORTS = AppConstants.FALLBACK_PORTS
        const val UDP_DISCOVERY_PORT = AppConstants.UDP_DISCOVERY_PORT
    }

    interface DiscoveryListener {
        fun onServerFound(server: DiscoveredServer)
        fun onServerLost(serviceName: String)
        fun onDiscoveryStateChanged(isSearching: Boolean)
    }

    private val nsdManager: NsdManager = context.getSystemService(Context.NSD_SERVICE) as NsdManager
    private val wifiManager: WifiManager = context.applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
    private val mainHandler = Handler(Looper.getMainLooper())
    private var discoveryListener: NsdManager.DiscoveryListener? = null
    private var isDiscovering = false
    private var scanTimeoutRunnable: Runnable? = null
    private var multicastLock: WifiManager.MulticastLock? = null

    var listener: DiscoveryListener? = null

    private val discoveredServers = java.util.concurrent.ConcurrentHashMap<String, DiscoveredServer>()

    fun getDiscoveredServers(): List<DiscoveredServer> = discoveredServers.values.toList()

    private fun acquireMulticastLock() {
        try {
            if (multicastLock == null) {
                multicastLock = wifiManager.createMulticastLock("StreamPeMulticastLock").apply {
                    setReferenceCounted(false)
                }
            }
            if (multicastLock?.isHeld == false) {
                multicastLock?.acquire()
                Log.d(TAG, "🔒 Acquired MulticastLock for mDNS discovery")
            }
        } catch (e: Exception) {
            Log.w(TAG, "MulticastLock warning: ${e.message}")
        }
    }

    private fun releaseMulticastLock() {
        try {
            if (multicastLock?.isHeld == true) {
                multicastLock?.release()
                Log.d(TAG, "🔓 Released MulticastLock")
            }
        } catch (_: Exception) {}
    }

    @Synchronized
    fun startDiscovery(durationMs: Long = DEFAULT_SCAN_DURATION_MS) {
        discoveredServers.clear()
        mainHandler.post {
            listener?.onServerLost("")
        }

        acquireMulticastLock()

        if (isDiscovering) {
            scanTimeoutRunnable?.let { mainHandler.removeCallbacks(it) }
            scheduleScanTimeout(durationMs)
            return
        }

        scanTimeoutRunnable?.let { mainHandler.removeCallbacks(it) }

        discoveryListener = object : NsdManager.DiscoveryListener {
            override fun onDiscoveryStarted(regType: String) {
                Log.d(TAG, "mDNS Discovery started for $regType")
                isDiscovering = true
                mainHandler.post { listener?.onDiscoveryStateChanged(true) }
            }

            override fun onServiceFound(serviceInfo: NsdServiceInfo) {
                Log.d(TAG, "mDNS Service found: ${serviceInfo.serviceName} (${serviceInfo.serviceType})")
                if (serviceInfo.serviceType.contains("streampe") || serviceInfo.serviceType.contains("payment-alerts")) {
                    resolveService(serviceInfo)
                }
            }

            override fun onServiceLost(serviceInfo: NsdServiceInfo) {
                Log.d(TAG, "mDNS Service lost: ${serviceInfo.serviceName}")
                val name = serviceInfo.serviceName
                discoveredServers.remove(name)
                mainHandler.post { listener?.onServerLost(name) }
            }

            override fun onDiscoveryStopped(serviceType: String) {
                Log.d(TAG, "mDNS Discovery stopped")
                isDiscovering = false
                releaseMulticastLock()
                mainHandler.post { listener?.onDiscoveryStateChanged(false) }
            }

            override fun onStartDiscoveryFailed(serviceType: String, errorCode: Int) {
                Log.e(TAG, "mDNS Start Discovery failed: Error code $errorCode")
                isDiscovering = false
                releaseMulticastLock()
                try { nsdManager.stopServiceDiscovery(this) } catch (_: Exception) {}
                mainHandler.post { listener?.onDiscoveryStateChanged(false) }
            }

            override fun onStopDiscoveryFailed(serviceType: String, errorCode: Int) {
                Log.e(TAG, "mDNS Stop Discovery failed: Error code $errorCode")
                isDiscovering = false
                releaseMulticastLock()
                mainHandler.post { listener?.onDiscoveryStateChanged(false) }
            }
        }

        try {
            nsdManager.discoverServices(SERVICE_TYPE_STREAMPE, NsdManager.PROTOCOL_DNS_SD, discoveryListener)
            sendUdpDirectBroadcast()
            startSmartUnicastProbing()
            scheduleScanTimeout(durationMs)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to initiate mDNS discovery: ${e.message}")
            isDiscovering = false
            releaseMulticastLock()
            listener?.onDiscoveryStateChanged(false)
        }
    }

    private fun sendUdpDirectBroadcast() {
        thread {
            try {
                val socket = java.net.DatagramSocket()
                socket.broadcast = true
                socket.soTimeout = 1500
                val msg = "STREAMPE_DISCOVER".toByteArray()
                val broadcastAddr = java.net.InetAddress.getByName("255.255.255.255")
                val packet = java.net.DatagramPacket(msg, msg.size, broadcastAddr, 58025)
                socket.send(packet)

                val buf = ByteArray(1024)
                val receivePacket = java.net.DatagramPacket(buf, buf.size)
                val startTime = System.currentTimeMillis()
                while (System.currentTimeMillis() - startTime < 1500) {
                    try {
                        socket.receive(receivePacket)
                        val resp = String(receivePacket.data, 0, receivePacket.length).trim()
                        if (resp.contains("STREAMPE_RESPONSE")) {
                            val json = org.json.JSONObject(resp)
                            val targetIp = json.optString("primaryIp", receivePacket.address?.hostAddress ?: "")
                            val port = json.optInt("port", 2907)
                            val hostName = json.optString("hostname", targetIp)
                            val instanceIdx = FALLBACK_PORTS.indexOf(port)
                            val name = if (instanceIdx <= 0) "StreamPe - $hostName" else "StreamPe - $hostName ($instanceIdx)"
                            val httpUrl = "http://$targetIp:$port"
                            val server = DiscoveredServer(
                                serviceName = name,
                                host = targetIp,
                                port = port,
                                ipAddress = targetIp,
                                httpUrl = httpUrl,
                                wsUrl = "ws://$targetIp:$port/android"
                            )
                            val key = httpUrl.lowercase()
                            if (!discoveredServers.containsKey(key)) {
                                discoveredServers[key] = server
                                Log.d(TAG, "🔴 UDP Direct Broadcast Discovered Server: $name -> $httpUrl")
                                mainHandler.post { listener?.onServerFound(server) }
                            }
                        }
                    } catch (_: java.net.SocketTimeoutException) {
                        break
                    }
                }
                try { socket.close() } catch (_: Exception) {}
            } catch (e: Exception) {
                Log.w(TAG, "UDP direct broadcast warning: ${e.message}")
            }
        }
    }

    private fun startSmartUnicastProbing() {
        thread {
            try {
                val ip = getWifiIpAddress() ?: return@thread
                val prefix = ip.substringBeforeLast(".") + "."
                
                val probeIps = mutableListOf("${prefix}1", "${prefix}100", "${prefix}101", "${prefix}105", "${prefix}2")
                
                for (lastOctet in 1..254) {
                    val candidate = "$prefix$lastOctet"
                    if (candidate !in probeIps && candidate != ip) {
                        probeIps.add(candidate)
                    }
                }

                for (targetIp in probeIps.take(30)) {
                    for (port in FALLBACK_PORTS) {
                        val httpUrl = "http://$targetIp:$port"
                        val key = httpUrl.lowercase()
                        if (discoveredServers.containsKey(key)) continue

                        HealthCheck.check(httpUrl) { isAlive, _ ->
                            if (isAlive) {
                                val instanceIdx = FALLBACK_PORTS.indexOf(port)
                                val name = if (instanceIdx <= 0) "StreamPe - $targetIp" else "StreamPe - $targetIp ($instanceIdx)"
                                val server = DiscoveredServer(
                                    serviceName = name,
                                    host = targetIp,
                                    port = port,
                                    ipAddress = targetIp,
                                    httpUrl = httpUrl,
                                    wsUrl = "ws://$targetIp:$port/android"
                                )
                                if (!discoveredServers.containsKey(key)) {
                                    discoveredServers[key] = server
                                    Log.d(TAG, "⚡ Unicast Probe Discovered Active Server: $name -> $httpUrl")
                                    mainHandler.post { listener?.onServerFound(server) }
                                }
                            }
                        }
                    }
                }
            } catch (e: Exception) {
                Log.w(TAG, "Unicast probe notice: ${e.message}")
            }
        }
    }

    private fun getWifiIpAddress(): String? {
        val ipInt = wifiManager.connectionInfo.ipAddress
        if (ipInt == 0) return null
        return String.format(
            "%d.%d.%d.%d",
            ipInt and 0xff,
            ipInt shr 8 and 0xff,
            ipInt shr 16 and 0xff,
            ipInt shr 24 and 0xff
        )
    }

    private fun scheduleScanTimeout(durationMs: Long) {
        val runnable = Runnable {
            Log.d(TAG, "mDNS Scan duration expired ($durationMs ms) — stopping discovery")
            stopDiscovery()
        }
        scanTimeoutRunnable = runnable
        mainHandler.postDelayed(runnable, durationMs)
    }

    private fun resolveService(serviceInfo: NsdServiceInfo) {
        nsdManager.resolveService(serviceInfo, object : NsdManager.ResolveListener {
            override fun onResolveFailed(serviceInfo: NsdServiceInfo, errorCode: Int) {
                Log.w(TAG, "mDNS Resolve failed for ${serviceInfo.serviceName}: code $errorCode")
            }

            override fun onServiceResolved(serviceInfo: NsdServiceInfo) {
                val host: InetAddress = serviceInfo.host ?: return
                val ip = host.hostAddress ?: return
                val port = serviceInfo.port

                val cleanIp = if (ip.contains("%") || ip.startsWith("fe80")) {
                    ip.split("%")[0]
                } else {
                    ip
                }

                val httpUrl = "http://$cleanIp:$port"
                val wsUrl = "ws://$cleanIp:$port/android"
                val name = serviceInfo.serviceName
                val key = httpUrl.lowercase()

                val server = DiscoveredServer(
                    serviceName = name,
                    host = serviceInfo.host?.hostName ?: cleanIp,
                    port = port,
                    ipAddress = cleanIp,
                    httpUrl = httpUrl,
                    wsUrl = wsUrl
                )

                HealthCheck.check(httpUrl) { isAlive, _ ->
                    if (isAlive) {
                        discoveredServers[key] = server
                        Log.d(TAG, "✅ Verified Active mDNS Server: $name -> $httpUrl")
                        mainHandler.post {
                            listener?.onServerFound(server)
                        }
                    } else {
                        Log.d(TAG, "⚠️ Discovered dead/stale server ignored: $name -> $httpUrl")
                        discoveredServers.remove(key)
                        mainHandler.post {
                            listener?.onServerLost(name)
                        }
                    }
                }
            }
        })
    }

    @Synchronized
    fun stopDiscovery() {
        scanTimeoutRunnable?.let {
            mainHandler.removeCallbacks(it)
            scanTimeoutRunnable = null
        }

        if (!isDiscovering || discoveryListener == null) return

        try {
            nsdManager.stopServiceDiscovery(discoveryListener)
        } catch (e: Exception) {
            Log.w(TAG, "Error stopping discovery: ${e.message}")
        } finally {
            discoveryListener = null
            isDiscovering = false
            releaseMulticastLock()
            listener?.onDiscoveryStateChanged(false)
        }
    }
}
