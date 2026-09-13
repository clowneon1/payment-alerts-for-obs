package com.clowneon1.streampe

import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import java.util.UUID

class PayloadContractTest {

    @Test
    fun testNotificationPayloadStructure() {
        val alertId = UUID.randomUUID().toString()
        val timestamp = System.currentTimeMillis()

        val payload = JSONObject().apply {
            put("type", "notification")
            put("alertId", alertId)
            put("package", "com.phonepe.app")
            put("app", "PhonePe")
            put("title", "PhonePe")
            put("text", "Rahul Sharma has sent ₹500")
            put("bigText", "Rahul Sharma has sent ₹500")
            put("subText", "")
            put("sender", "Rahul Sharma")
            put("amount", "₹500")
            put("time", timestamp)
        }

        assertEquals("notification", payload.getString("type"))
        assertEquals(alertId, payload.getString("alertId"))
        assertEquals("com.phonepe.app", payload.getString("package"))
        assertEquals("PhonePe", payload.getString("app"))
        assertEquals("Rahul Sharma", payload.getString("sender"))
        assertEquals("₹500", payload.getString("amount"))
        assertEquals(timestamp, payload.getLong("time"))
    }

    @Test
    fun testAlertEntryDataClassDefaults() {
        val entry = AlertEntry(
            timestamp = 1700000000000L,
            appName = "PhonePe",
            title = "PhonePe",
            text = "Payment received"
        )

        assertEquals("", entry.bigText)
        assertEquals("", entry.subText)
        assertEquals("", entry.sender)
        assertEquals("", entry.amount)
        assertEquals("notification", entry.source)
        assertEquals("", entry.fullJson)
    }

    @Test
    fun testAlertLogRetriggerFallbackSynthesis() {
        val entry = AlertEntry(
            timestamp = 1700000000000L,
            appName = "PhonePe",
            title = "PhonePe - Suresh",
            text = "has sent ₹1000",
            sender = "Suresh",
            amount = "₹1000",
            fullJson = "" // Empty fullJson, simulates retrigger fallback
        )

        // Simulate AlertLogActivity retrigger fallback logic
        val rawJson = if (entry.fullJson.isNotBlank()) {
            entry.fullJson
        } else {
            JSONObject().apply {
                put("type", "notification")
                put("alertId", UUID.randomUUID().toString())
                put("app", entry.appName)
                put("title", entry.title)
                put("text", entry.text)
                put("bigText", entry.bigText)
                put("subText", entry.subText)
                put("sender", entry.sender)
                put("amount", entry.amount)
                put("time", entry.timestamp)
            }.toString()
        }

        val parsedObj = JSONObject(rawJson)
        assertEquals("notification", parsedObj.getString("type"))
        assertTrue("Must contain generated alertId UUID", parsedObj.has("alertId") && parsedObj.getString("alertId").isNotBlank())
        assertEquals("PhonePe", parsedObj.getString("app"))
        assertEquals("Suresh", parsedObj.getString("sender"))
        assertEquals("₹1000", parsedObj.getString("amount"))
    }
}
