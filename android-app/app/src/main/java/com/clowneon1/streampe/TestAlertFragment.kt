package com.clowneon1.streampe

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.*
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.fragment.app.Fragment
import org.json.JSONObject
import java.util.UUID

class TestAlertFragment : Fragment() {

    companion object {
        private const val CHANNEL_ID = "tester_channel"
        private var notifId = 100
    }

    data class TestPreset(
        val label   : String,
        val title   : String,
        val text    : String,
        val bigText : String = "",
        val pkg     : String,
        val appName : String
    )

    private val presets = listOf(
        TestPreset(
            label   = "PhonePe (₹500)",
            title   = "PhonePe - Rahul Sharma",
            text    = "has sent ₹500.00",
            bigText = "has sent ₹500.00",
            pkg     = "com.phonepe.app",
            appName = "PhonePe"
        ),
        TestPreset(
            label   = "PhonePe Business (₹2,500)",
            title   = "PhonePe Business",
            text    = "Payment of ₹2,500 received from Suresh",
            bigText = "Payment of ₹2,500 received from Suresh",
            pkg     = "com.phonepe.app",
            appName = "PhonePe"
        ),
        TestPreset(
            label   = "Google Pay (₹500)",
            title   = "Google Pay",
            text    = "Rahul Kumar paid you ₹500",
            bigText = "Awesome stream! 🔥",
            pkg     = "com.google.android.apps.nbu.paisa.user",
            appName = "Google Pay"
        ),
        TestPreset(
            label   = "Amazon Pay (₹500)",
            title   = "₹500 received",
            text    = "Money received from Rahul Sharma on Amazon Pay",
            bigText = "Money received from Rahul Sharma on Amazon Pay",
            pkg     = "com.amazon.mShop.android.shopping",
            appName = "Amazon Pay"
        ),
        TestPreset(
            label   = "Custom",
            title   = "",
            text    = "",
            bigText = "",
            pkg     = "",
            appName = "Custom"
        )
    )

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        return inflater.inflate(R.layout.fragment_test, container, false)
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        createNotificationChannel()

        val spinner   = view.findViewById<Spinner>(R.id.spinnerTestPresets)
        val etTitle   = view.findViewById<EditText>(R.id.etTestTitle)
        val etText    = view.findViewById<EditText>(R.id.etTestText)
        val etPkg     = view.findViewById<EditText>(R.id.etTestPkg)
        val btnSend   = view.findViewById<Button>(R.id.btnSendTestAlert)
        val tvOutput  = view.findViewById<TextView>(R.id.tvTestOutput)

        val labels = presets.map { it.label }
        val adapter = ArrayAdapter(requireContext(), android.R.layout.simple_spinner_item, labels)
        adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
        spinner.adapter = adapter

        fun applyPreset(pos: Int) {
            val preset = presets[pos]
            etTitle.setText(preset.title)
            etText.setText(preset.text)
            etPkg.setText(preset.pkg)
        }

        spinner.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(parent: AdapterView<*>, view: View?, pos: Int, id: Long) {
                applyPreset(pos)
                if (pos == presets.indexOfFirst { it.label == "Custom" }) etTitle.requestFocus()
            }
            override fun onNothingSelected(parent: AdapterView<*>) {}
        }

        btnSend.setOnClickListener {
            val pos     = spinner.selectedItemPosition
            val preset  = presets[pos]
            val title   = etTitle.text.toString().trim()
            val text    = etText.text.toString().trim()
            val pkgVal  = etPkg.text.toString().trim().ifBlank {
                if (preset.pkg.isNotBlank()) preset.pkg else requireContext().packageName
            }
            val appName = if (pos == presets.indexOfFirst { it.label == "Custom" }) "Custom" else preset.appName

            if (title.isBlank() || text.isBlank()) {
                Toast.makeText(requireContext(), "Title and text cannot be empty", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            val bigTextVal = if (text == preset.text && preset.bigText.isNotBlank()) preset.bigText else text
            fireLocalNotification(title, text, bigTextVal)

            val alertId = UUID.randomUUID().toString()

            val json = JSONObject().apply {
                put("alertId",     alertId)
                put("source",      "tester")
                put("simulated",   true)
                put("packageName", pkgVal)
                put("appName",     appName)
                put("title",       title)
                put("text",        text)
                put("bigText",     bigTextVal)
                put("timestamp",   System.currentTimeMillis())
            }

            AlertLog.add(AlertLog.fromJson(json))
            WebSocketManager.send(json.toString())

            val logLine = "[${preset.label}] $title: $text\n"
            tvOutput.text = logLine + tvOutput.text
            Toast.makeText(requireContext(), "Test alert sent to OBS", Toast.LENGTH_SHORT).show()
        }
    }

    private fun fireLocalNotification(title: String, text: String, bigText: String) {
        val ctx = context ?: return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ActivityCompat.checkSelfPermission(ctx, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                return
            }
        }

        val builder = NotificationCompat.Builder(ctx, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(title)
            .setContentText(text)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)

        if (bigText.isNotBlank()) {
            builder.setStyle(NotificationCompat.BigTextStyle().bigText(bigText))
        }

        NotificationManagerCompat.from(ctx).notify(notifId++, builder.build())
    }

    private fun createNotificationChannel() {
        val ctx = context ?: return
        val channel = NotificationChannel(
            CHANNEL_ID, "Notification Tester", NotificationManager.IMPORTANCE_HIGH
        ).apply { description = "Simulated notifications for testing overlay" }
        ctx.getSystemService(NotificationManager::class.java)?.createNotificationChannel(channel)
    }
}
