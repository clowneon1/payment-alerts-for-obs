package com.clowneon1.streampe

object AppConstants {
    const val APP_NAME = "StreamPe"
    const val DEFAULT_PORT = 2907
    const val UDP_DISCOVERY_PORT = 58025
    const val SERVICE_TYPE_STREAMPE = "_streampe._tcp."
    const val SERVICE_TYPE_LEGACY = "_payment-alerts._tcp."
    const val DEFAULT_SCAN_DURATION_MS = 5000L
    const val MAX_RECENT_SERVERS = 3
    val FALLBACK_PORTS = listOf(DEFAULT_PORT, 8876, 2708, 9091, 1001)

    const val APP_VERSION = "2.2.0"
    const val DEFAULT_FALLBACK_URL = "http://192.168.1.100:2907"
    const val DISCORD_URL = "https://partially-practical.codepenguin.in"
    const val WEBSITE_URL = "https://partially-practical.codepenguin.in"
    const val GITHUB_REPO_URL = "https://github.com/clowneon1/streampe"
    const val GITHUB_API_LATEST_RELEASE = "https://api.github.com/repos/clowneon1/streampe/releases/latest"
}
