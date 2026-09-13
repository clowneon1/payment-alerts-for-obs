package com.clowneon1.streampe

import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.app.AppCompatDelegate

class AboutActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        AppCompatDelegate.setDefaultNightMode(AppCompatDelegate.MODE_NIGHT_YES)
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_about)

        val btnAboutBack            = findViewById<Button>(R.id.btnAboutBack)
        val tvAboutVersion          = findViewById<TextView>(R.id.tvAboutVersion)
        val tvAboutStatusBadge      = findViewById<TextView>(R.id.tvAboutStatusBadge)
        val layoutAboutUpdateBox    = findViewById<LinearLayout>(R.id.layoutAboutUpdateBox)
        val tvAboutNewVersionText   = findViewById<TextView>(R.id.tvAboutNewVersionText)
        val btnAboutDownloadUpdate  = findViewById<Button>(R.id.btnAboutDownloadUpdate)
        val btnAboutDiscord         = findViewById<Button>(R.id.btnAboutDiscord)
        val btnAboutGitHub          = findViewById<Button>(R.id.btnAboutGitHub)
        val btnAboutReopenWizard    = findViewById<Button>(R.id.btnAboutReopenWizard)
        val tvAboutMadeWithLove     = findViewById<TextView>(R.id.tvAboutMadeWithLove)

        tvAboutVersion.text = "v${AppConstants.APP_VERSION}"

        btnAboutBack.setOnClickListener { finish() }

        var downloadUrl = AppConstants.GITHUB_REPO_URL

        UpdateChecker.checkUpdate { updateInfo ->
            runOnUiThread {
                if (updateInfo != null && updateInfo.hasUpdate) {
                    tvAboutStatusBadge.text = "Update Available"
                    tvAboutStatusBadge.setTextColor(Color.parseColor("#d5baff"))
                    tvAboutStatusBadge.setBackgroundColor(Color.parseColor("#2d1a4e"))

                    layoutAboutUpdateBox.visibility = View.VISIBLE
                    tvAboutNewVersionText.text = "New update available: v${updateInfo.latestVersion}"
                    downloadUrl = updateInfo.downloadUrl
                } else {
                    tvAboutStatusBadge.text = "Latest Version ✓"
                    tvAboutStatusBadge.setTextColor(Color.parseColor("#00F593"))
                    layoutAboutUpdateBox.visibility = View.GONE
                }
            }
        }

        btnAboutDownloadUpdate.setOnClickListener { openExternalUrl(downloadUrl) }
        btnAboutDiscord.setOnClickListener        { openExternalUrl(AppConstants.DISCORD_URL) }
        btnAboutGitHub.setOnClickListener         { openExternalUrl(AppConstants.GITHUB_REPO_URL) }
        tvAboutMadeWithLove.setOnClickListener    { openExternalUrl(AppConstants.GITHUB_REPO_URL) }

        btnAboutReopenWizard.setOnClickListener {
            startActivity(Intent(this, SetupActivity::class.java))
        }
    }

    private fun openExternalUrl(url: String) {
        try {
            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
        } catch (e: Exception) {
            Toast.makeText(this, "Could not open link", Toast.LENGTH_SHORT).show()
        }
    }
}
