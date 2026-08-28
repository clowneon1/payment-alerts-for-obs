package com.clowneon1.streampe

import android.content.Context
import android.content.SharedPreferences

class AppPrefs(context: Context) {
    private val prefs: SharedPreferences =
        context.getSharedPreferences("streampe_prefs", Context.MODE_PRIVATE)

    var serverUrl: String
        get() = prefs.getString("server_url", "") ?: ""
        set(value) = prefs.edit().putString("server_url", value).apply()

    var isConnected: Boolean
        get() = prefs.getBoolean("is_connected", false)
        set(value) = prefs.edit().putBoolean("is_connected", value).apply()

    var selectedPackages: Set<String>
        get() = prefs.getStringSet("selected_packages", emptySet()) ?: emptySet()
        set(value) = prefs.edit().putStringSet("selected_packages", value).apply()

    var savedServers: List<String>
        get() {
            val csv = prefs.getString("recent_servers_list", "") ?: ""
            if (csv.isNotBlank()) {
                return csv.split(",").filter { it.isNotBlank() }.take(3)
            }
            val oldSet = prefs.getStringSet("saved_servers", emptySet()) ?: emptySet()
            return oldSet.toList().take(3)
        }
        set(value) {
            val trimmedList = value.map { it.trim() }.filter { it.isNotBlank() }.distinct().take(3)
            prefs.edit().putString("recent_servers_list", trimmedList.joinToString(",")).apply()
        }

    fun addSavedServer(url: String) {
        val trimmed = url.trim()
        if (trimmed.isNotBlank()) {
            val current = savedServers.toMutableList()
            current.remove(trimmed)
            current.add(0, trimmed)
            savedServers = current.take(3)
        }
    }

    fun removeSavedServer(url: String) {
        val current = savedServers.toMutableList()
        if (current.remove(url.trim())) {
            savedServers = current
        }
    }
}
