package com.clowneon1.streampe

import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.*
import androidx.fragment.app.Fragment
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView

class RecentAlertsFragment : Fragment() {

    private lateinit var recyclerAlerts: RecyclerView
    private lateinit var layoutEmptyState: LinearLayout
    private lateinit var tvAlertsCount: TextView
    private lateinit var etSearchAlerts: EditText
    private lateinit var btnClearAlerts: Button

    private var allEntries: List<AlertEntry> = emptyList()

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        return inflater.inflate(R.layout.fragment_recent, container, false)
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        AlertLog.init(requireContext())

        recyclerAlerts   = view.findViewById(R.id.recyclerAlerts)
        layoutEmptyState = view.findViewById(R.id.layoutEmptyState)
        tvAlertsCount    = view.findViewById(R.id.tvAlertsCount)
        etSearchAlerts   = view.findViewById(R.id.etSearchAlerts)
        btnClearAlerts   = view.findViewById(R.id.btnClearAlerts)

        recyclerAlerts.layoutManager = LinearLayoutManager(requireContext())

        btnClearAlerts.setOnClickListener {
            AlertLog.clear()
            refreshAlerts()
            Toast.makeText(requireContext(), "Alerts log cleared", Toast.LENGTH_SHORT).show()
        }

        etSearchAlerts.addTextChangedListener(object : TextWatcher {
            override fun afterTextChanged(s: Editable?) {
                applyRawTextFilter(s.toString().trim())
            }
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
        })

        refreshAlerts()
    }

    override fun onResume() {
        super.onResume()
        refreshAlerts()
    }

    fun refreshAlerts() {
        allEntries = AlertLog.entries
        applyRawTextFilter(etSearchAlerts.text.toString().trim())
    }

    private fun applyRawTextFilter(query: String) {
        val filtered = if (query.isBlank()) {
            allEntries
        } else {
            val q = query.lowercase()
            allEntries.filter { entry ->
                entry.appName.lowercase().contains(q) ||
                entry.sender.lowercase().contains(q) ||
                entry.amount.lowercase().contains(q) ||
                entry.title.lowercase().contains(q) ||
                entry.text.lowercase().contains(q) ||
                entry.source.lowercase().contains(q) ||
                entry.fullJson.lowercase().contains(q)
            }
        }

        if (filtered.isEmpty()) {
            layoutEmptyState.visibility = View.VISIBLE
            recyclerAlerts.visibility   = View.GONE
            tvAlertsCount.visibility    = View.GONE
        } else {
            layoutEmptyState.visibility = View.GONE
            recyclerAlerts.visibility   = View.VISIBLE
            tvAlertsCount.visibility    = View.VISIBLE
            tvAlertsCount.text = "${filtered.size} alert${if (filtered.size != 1) "s" else ""}"

            recyclerAlerts.adapter = AlertLogAdapter(filtered) { itemToDelete ->
                AlertLog.remove(itemToDelete)
                refreshAlerts()
            }
        }
    }
}
