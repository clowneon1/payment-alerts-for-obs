package com.clowneon1.streampe

import android.os.Handler
import android.os.Looper
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.util.concurrent.TimeUnit

data class UpdateInfo(
    val hasUpdate: Boolean,
    val latestVersion: String,
    val downloadUrl: String,
    val releaseNotes: String
)

object UpdateChecker {
    private val client by lazy {
        OkHttpClient.Builder()
            .connectTimeout(5, TimeUnit.SECONDS)
            .readTimeout(5, TimeUnit.SECONDS)
            .build()
    }

    private val mainHandler by lazy { Handler(Looper.getMainLooper()) }

    fun checkUpdate(callback: (UpdateInfo?) -> Unit) {
        Thread {
            try {
                val req = Request.Builder()
                    .url(AppConstants.GITHUB_API_LATEST_RELEASE)
                    .header("User-Agent", "StreamPe-Android/${AppConstants.APP_VERSION}")
                    .header("Accept", "application/vnd.github.v3+json")
                    .build()

                val res = client.newCall(req).execute()
                res.use { response ->
                    if (!response.isSuccessful) {
                        mainHandler.post { callback(null) }
                        return@Thread
                    }

                    val body = response.body?.string() ?: ""
                    val json = JSONObject(body)
                    val rawTag = json.optString("tag_name", "")
                    val cleanTag = rawTag.replace(Regex("^(release-|beta-|v)"), "")
                    val releaseNotes = json.optString("body", "")

                    // Find Companion APK asset download URL if available
                    var downloadUrl = json.optString("html_url", AppConstants.GITHUB_REPO_URL)
                    val assets = json.optJSONArray("assets")
                    if (assets != null) {
                        for (i in 0 until assets.length()) {
                            val asset = assets.getJSONObject(i)
                            val name = asset.optString("name", "")
                            if (name.endsWith(".apk", ignoreCase = true)) {
                                downloadUrl = asset.optString("browser_download_url", downloadUrl)
                                break
                            }
                        }
                    }

                    val hasUpdate = isNewerVersion(cleanTag, AppConstants.APP_VERSION)
                    val info = UpdateInfo(
                        hasUpdate = hasUpdate,
                        latestVersion = cleanTag.ifBlank { rawTag },
                        downloadUrl = downloadUrl,
                        releaseNotes = releaseNotes
                    )

                    mainHandler.post { callback(info) }
                }
            } catch (e: Exception) {
                mainHandler.post { callback(null) }
            }
        }.start()
    }

    fun isNewerVersion(remote: String, local: String): Boolean {
        if (remote.isBlank() || local.isBlank()) return false
        val cleanRemote = remote.trim().replace(Regex("""^(?:release-|beta-|v)""", RegexOption.IGNORE_CASE), "")
        val cleanLocal = local.trim().replace(Regex("""^(?:release-|beta-|v)""", RegexOption.IGNORE_CASE), "")
        val rParts = cleanRemote.split("-")[0].split(".").mapNotNull { it.toIntOrNull() }
        val lParts = cleanLocal.split("-")[0].split(".").mapNotNull { it.toIntOrNull() }
        val maxLen = maxOf(rParts.size, lParts.size)
        for (i in 0 until maxLen) {
            val r = rParts.getOrElse(i) { 0 }
            val l = lParts.getOrElse(i) { 0 }
            if (r > l) return true
            if (r < l) return false
        }
        return false
    }
}
