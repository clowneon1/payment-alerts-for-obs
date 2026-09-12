package com.clowneon1.streampe

import org.junit.Assert.*
import org.junit.Test

class ServerDiscoveryModelTest {

    @Test
    fun testDiscoveredServerModel() {
        val server1 = DiscoveredServer(
            serviceName = "StreamPe-PC",
            host = "StreamPe-PC.local",
            port = 2907,
            ipAddress = "192.168.1.50",
            httpUrl = "http://192.168.1.50:2907",
            wsUrl = "ws://192.168.1.50:2907/android",
            version = "2.2.0"
        )

        assertEquals("StreamPe-PC", server1.serviceName)
        assertEquals("StreamPe-PC.local", server1.host)
        assertEquals(2907, server1.port)
        assertEquals("192.168.1.50", server1.ipAddress)
        assertEquals("http://192.168.1.50:2907", server1.httpUrl)
        assertEquals("ws://192.168.1.50:2907/android", server1.wsUrl)
        assertEquals("2.2.0", server1.version)

        val server2 = DiscoveredServer(
            serviceName = "StreamPe-PC",
            host = "StreamPe-PC.local",
            port = 2907,
            ipAddress = "192.168.1.50",
            httpUrl = "http://192.168.1.50:2907",
            wsUrl = "ws://192.168.1.50:2907/android",
            version = "2.2.0"
        )

        assertEquals("DiscoveredServers with matching fields should be equal", server1, server2)
        assertEquals("HashCodes should match for equal objects", server1.hashCode(), server2.hashCode())
    }

    @Test
    fun testDiscoveredServerDefaultVersion() {
        val server = DiscoveredServer(
            serviceName = "StreamPe-PC",
            host = "StreamPe-PC.local",
            port = 2907,
            ipAddress = "192.168.1.50",
            httpUrl = "http://192.168.1.50:2907",
            wsUrl = "ws://192.168.1.50:2907/android"
        )

        assertEquals(AppConstants.APP_VERSION, server.version)
    }

    @Test
    fun testAppConstantsIntegrity() {
        assertEquals("StreamPe", AppConstants.APP_NAME)
        assertEquals(2907, AppConstants.DEFAULT_PORT)
        assertEquals(58025, AppConstants.UDP_DISCOVERY_PORT)
        assertEquals("_streampe._tcp.", AppConstants.SERVICE_TYPE_STREAMPE)
        assertEquals("_payment-alerts._tcp.", AppConstants.SERVICE_TYPE_LEGACY)
        assertTrue("Fallback ports must contain default port", AppConstants.FALLBACK_PORTS.contains(2907))
    }

    @Test
    fun testUrlNormalizationForWebSocket() {
        fun normalizeServerUrl(rawUrl: String): String {
            var url = rawUrl.trim().trimEnd('/')
            if (!url.startsWith("http://") && !url.startsWith("https://") && !url.startsWith("ws://") && !url.startsWith("wss://")) {
                url = "http://$url"
            }
            return url
        }

        fun toWebSocketUrl(httpUrl: String): String {
            val base = normalizeServerUrl(httpUrl)
            val wsBase = when {
                base.startsWith("https://") -> base.replaceFirst("https://", "wss://")
                base.startsWith("http://") -> base.replaceFirst("http://", "ws://")
                else -> base
            }
            return "$wsBase/android"
        }

        assertEquals("ws://192.168.1.50:2907/android", toWebSocketUrl("http://192.168.1.50:2907/"))
        assertEquals("ws://192.168.1.50:2907/android", toWebSocketUrl("http://192.168.1.50:2907"))
        assertEquals("ws://192.168.1.50:2907/android", toWebSocketUrl("192.168.1.50:2907"))
        assertEquals("wss://myserver.com:2907/android", toWebSocketUrl("https://myserver.com:2907/"))
    }
}
