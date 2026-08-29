package com.clowneon1.streampe

import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.EditText
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView

class AppSelectorFragment : Fragment() {

    private lateinit var prefs: AppPrefs
    private lateinit var adapter: AppListAdapter
    private lateinit var etSearchApps: EditText
    private var allApps: List<AppItem> = emptyList()

    private val TARGET_PACKAGES = setOf(
        "com.phonepe.app",
        "com.google.android.apps.nbu.paisa.user",
        "in.amazon.mShop.android.shopping",
        "com.amazon.mShop.android.shopping",
        "com.whatsapp",
        "com.whatsapp.w4b"
    )

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        return inflater.inflate(R.layout.fragment_apps, container, false)
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        prefs = AppPrefs(requireContext())

        val recycler = view.findViewById<RecyclerView>(R.id.recyclerApps)
        val btnSave  = view.findViewById<Button>(R.id.btnSaveAppSelection)
        etSearchApps = view.findViewById(R.id.etSearchApps)

        val savedPkgs = prefs.selectedPackages
        adapter = AppListAdapter(mutableListOf(), savedPkgs)
        recycler.layoutManager = LinearLayoutManager(requireContext())
        recycler.adapter = adapter

        Thread {
            allApps = getInstalledApps()
            activity?.runOnUiThread { filterAndApplyApps(etSearchApps.text.toString().trim()) }
        }.start()

        etSearchApps.addTextChangedListener(object : TextWatcher {
            override fun afterTextChanged(s: Editable?) {
                filterAndApplyApps(s.toString().trim())
            }
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
        })

        btnSave.setOnClickListener {
            val selected = adapter.getSelectedPackages()
            prefs.selectedPackages = selected
            NotificationService.allowedPackages = selected
            Toast.makeText(requireContext(), "Saved ${selected.size} app(s)", Toast.LENGTH_SHORT).show()
        }

        NotificationService.allowedPackages = savedPkgs
    }

    private fun filterAndApplyApps(query: String) {
        val filtered = if (query.isBlank()) {
            allApps
        } else {
            val q = query.lowercase()
            allApps.filter { it.appName.lowercase().contains(q) || it.packageName.lowercase().contains(q) }
        }
        adapter.updateList(filtered)
    }

    private fun getInstalledApps(): List<AppItem> {
        val pm = requireContext().packageManager
        return TARGET_PACKAGES.mapNotNull { pkg ->
            try {
                val info = pm.getApplicationInfo(pkg, 0)
                AppItem(
                    packageName = info.packageName,
                    appName     = pm.getApplicationLabel(info).toString(),
                    icon        = try { pm.getApplicationIcon(info.packageName) } catch (e: Exception) { null }
                )
            } catch (e: Exception) {
                null
            }
        }.sortedBy { it.appName.lowercase() }
    }
}
