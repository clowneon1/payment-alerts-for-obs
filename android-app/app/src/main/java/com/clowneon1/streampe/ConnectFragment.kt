package com.clowneon1.streampe

import android.content.Intent
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.*
import androidx.core.content.ContextCompat
import androidx.fragment.app.Fragment

class ConnectFragment : Fragment() {

    private lateinit var prefs: AppPrefs
    private lateinit var discoveryManager: ServerDiscoveryManager

    private lateinit var pbScan: ProgressBar
    private lateinit var tvScanStatus: TextView
    private lateinit var btnRefreshScan: Button
    private lateinit var layoutDiscoveredList: LinearLayout
    private lateinit var layoutRecentServersContainer: LinearLayout
    private lateinit var layoutRecentChips: LinearLayout
    private lateinit var etServerInput: EditText
    private lateinit var btnConnect: Button
    private lateinit var tvConnectError: TextView

    private var activeConnectListener: WebSocketManager.ConnectionStateListener? = null

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        return inflater.inflate(R.layout.fragment_connect, container, false)
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        prefs = AppPrefs(requireContext())
        discoveryManager = ServerDiscoveryManager(requireContext())

        bindViews(view)
        setupDiscoveryListener()
        setupListeners()
        renderRecentChips()
    }

    override fun onResume() {
        super.onResume()
        renderRecentChips()
        discoveryManager.startDiscovery()
    }

    override fun onPause() {
        super.onPause()
        discoveryManager.stopDiscovery()
        activeConnectListener?.let { WebSocketManager.removeListener(it) }
    }

    private fun bindViews(view: View) {
        pbScan                       = view.findViewById(R.id.pbScan)
        tvScanStatus                 = view.findViewById(R.id.tvScanStatus)
        btnRefreshScan               = view.findViewById(R.id.btnRefreshScan)
        layoutDiscoveredList         = view.findViewById(R.id.layoutDiscoveredList)
        layoutRecentServersContainer = view.findViewById(R.id.layoutRecentServersContainer)
        layoutRecentChips            = view.findViewById(R.id.layoutRecentChips)
        etServerInput                = view.findViewById(R.id.etServerInput)
        btnConnect                   = view.findViewById(R.id.btnConnect)
        tvConnectError               = view.findViewById(R.id.tvConnectError)

        etServerInput.setText(prefs.serverUrl.ifBlank { AppConstants.DEFAULT_FALLBACK_URL })
    }

    private fun setupListeners() {
        btnRefreshScan.setOnClickListener {
            discoveryManager.stopDiscovery()
            discoveryManager.startDiscovery()
            Toast.makeText(requireContext(), "Scanning local Wi-Fi for PC server…", Toast.LENGTH_SHORT).show()
        }

        btnConnect.setOnClickListener {
            var url = etServerInput.text.toString().trim()
            if (url.isBlank()) {
                Toast.makeText(requireContext(), "Enter server IP/URL", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            if (!url.startsWith("http://") && !url.startsWith("https://")) {
                url = "http://$url"
                etServerInput.setText(url)
            }
            performConnect(url)
        }
    }

    private fun setupDiscoveryListener() {
        discoveryManager.listener = object : ServerDiscoveryManager.DiscoveryListener {
            override fun onServerFound(server: DiscoveredServer) {
                activity?.runOnUiThread {
                    updateDiscoveredServersUI()
                    val current = etServerInput.text.toString().trim()
                    if (current.isBlank() || current == AppConstants.DEFAULT_FALLBACK_URL) {
                        etServerInput.setText(server.httpUrl)
                    }
                }
            }

            override fun onServerLost(serviceName: String) {
                activity?.runOnUiThread { updateDiscoveredServersUI() }
            }

            override fun onDiscoveryStateChanged(isSearching: Boolean) {
                activity?.runOnUiThread {
                    pbScan.visibility = if (isSearching) View.VISIBLE else View.GONE
                    val count = discoveryManager.getDiscoveredServers().size
                    tvScanStatus.text = if (isSearching) {
                        if (count > 0) "Found $count server(s) on Wi-Fi" else "Scanning local Wi-Fi for PC server…"
                    } else {
                        if (count > 0) "Found $count server(s)" else "No servers found — tap Scan to retry"
                    }
                }
            }
        }
    }

    private fun updateDiscoveredServersUI() {
        layoutDiscoveredList.removeAllViews()
        val servers = discoveryManager.getDiscoveredServers()

        if (servers.isEmpty()) {
            val emptyTv = TextView(requireContext()).apply {
                text = "No PC servers detected on local Wi-Fi"
                textSize = 11f
                setTextColor(Color.parseColor("#71717a"))
                setPadding(0, 4, 0, 4)
            }
            layoutDiscoveredList.addView(emptyTv)
            return
        }

        servers.forEach { srv ->
            val card = LinearLayout(requireContext()).apply {
                orientation = LinearLayout.HORIZONTAL
                setBackgroundColor(Color.parseColor("#18181b"))
                setPadding(12, 8, 12, 8)
                gravity = android.view.Gravity.CENTER_VERTICAL
                val params = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                ).apply { setMargins(0, 0, 0, 6) }
                layoutParams = params
            }

            val titleTv = TextView(requireContext()).apply {
                text = "${srv.serviceName} (${srv.httpUrl})"
                textSize = 12f
                setTextColor(Color.parseColor("#d5baff"))
                layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
            }

            val connectBtn = Button(requireContext()).apply {
                text = "Connect"
                textSize = 11f
                setTextColor(Color.WHITE)
                backgroundTintList = ContextCompat.getColorStateList(requireContext(), R.color.accent)
                setPadding(12, 0, 12, 0)
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.WRAP_CONTENT,
                    (34 * resources.displayMetrics.density).toInt()
                )
                stateListAnimator = null
                setOnClickListener {
                    etServerInput.setText(srv.httpUrl)
                    performConnect(srv.httpUrl)
                }
            }

            card.addView(titleTv)
            card.addView(connectBtn)
            layoutDiscoveredList.addView(card)
        }
    }

    private fun renderRecentChips() {
        layoutRecentChips.removeAllViews()
        val saved = prefs.savedServers

        if (saved.isEmpty()) {
            layoutRecentServersContainer.visibility = View.GONE
            return
        }

        layoutRecentServersContainer.visibility = View.VISIBLE
        saved.forEach { url ->
            val chip = LinearLayout(requireContext()).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = android.view.Gravity.CENTER_VERTICAL
                setBackgroundColor(Color.parseColor("#18181b"))
                setPadding(10, 5, 8, 5)
                val params = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.WRAP_CONTENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                ).apply { setMargins(0, 0, 6, 0) }
                layoutParams = params
            }

            val label = TextView(requireContext()).apply {
                text = url.replace("http://", "").replace("https://", "")
                textSize = 11f
                setTextColor(Color.parseColor("#d5baff"))
                setOnClickListener {
                    etServerInput.setText(url)
                    performConnect(url)
                }
            }

            val removeBtn = TextView(requireContext()).apply {
                text = " ✕"
                textSize = 11f
                setTextColor(Color.parseColor("#71717a"))
                setPadding(4, 0, 2, 0)
                setOnClickListener {
                    prefs.removeSavedServer(url)
                    renderRecentChips()
                }
            }

            chip.addView(label)
            chip.addView(removeBtn)
            layoutRecentChips.addView(chip)
        }
    }

    private fun performConnect(url: String) {
        tvConnectError.text = "Connecting…"
        tvConnectError.setTextColor(Color.parseColor("#ffb703"))
        btnConnect.isEnabled = false

        prefs.serverUrl = url
        prefs.isConnected = true
        prefs.addSavedServer(url)

        val wsUrl = url
            .replace("http://", "ws://")
            .replace("https://", "wss://")
            .trimEnd('/') + "/android"

        val serviceIntent = Intent(requireContext(), NotificationForwarderService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            requireContext().startForegroundService(serviceIntent)
        } else {
            requireContext().startService(serviceIntent)
        }

        activeConnectListener?.let { WebSocketManager.removeListener(it) }

        val listener = object : WebSocketManager.ConnectionStateListener {
            override fun onConnectionStateChanged(isConnected: Boolean, message: String) {
                activity?.runOnUiThread {
                    if (isConnected) {
                        WebSocketManager.removeListener(this)
                        activeConnectListener = null
                        tvConnectError.text = ""
                        btnConnect.isEnabled = true
                        (activity as? HomeActivity)?.onConnectedToServer()
                    } else if (message.contains("failure", ignoreCase = true) || message.contains("Offline", ignoreCase = true) || message.contains("Closed", ignoreCase = true)) {
                        tvConnectError.text = "Could not connect: $message"
                        tvConnectError.setTextColor(Color.parseColor("#ef4444"))
                        btnConnect.isEnabled = true
                    }
                }
            }
        }

        activeConnectListener = listener
        WebSocketManager.addListener(listener)
        WebSocketManager.connect(wsUrl)
    }
}
