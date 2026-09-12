package com.clowneon1.streampe

import org.junit.Assert.*
import org.junit.Test

class PaymentParserTest {

    // ─────────────────────────────────────────────────────────────────────────
    // 1. PhonePe Test Cases
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    fun testPhonePeTitleSenderBodyAmount() {
        val result = PaymentParser.parse(
            title = "PhonePe - Rahul Sharma",
            text = "has sent ₹500.00",
            bigText = "has sent ₹500.00",
            packageName = "com.phonepe.app",
            appName = "PhonePe"
        )
        assertNotNull("Should parse PhonePe title sender pattern", result)
        assertEquals("Rahul Sharma", result?.sender)
        assertEquals("₹500.00", result?.amount)
        assertEquals("PhonePe", result?.sourceApp)
    }

    @Test
    fun testPhonePeHasSent() {
        val result = PaymentParser.parse(
            title = "PhonePe",
            text = "Rahul Sharma has sent ₹500 to your bank account",
            bigText = "",
            packageName = "com.phonepe.app",
            appName = "PhonePe"
        )
        assertNotNull("Should parse PhonePe has sent pattern", result)
        assertEquals("Rahul Sharma", result?.sender)
        assertEquals("₹500", result?.amount)
        assertEquals("PhonePe", result?.sourceApp)
    }

    @Test
    fun testPhonePeAmountReceivedFrom() {
        val result = PaymentParser.parse(
            title = "PhonePe",
            text = "₹250 received from Amit Kumar",
            bigText = "₹250 received from Amit Kumar",
            packageName = "com.phonepe.app",
            appName = "PhonePe"
        )
        assertNotNull("Should parse PhonePe amount received from pattern", result)
        assertEquals("Amit Kumar", result?.sender)
        assertEquals("₹250", result?.amount)
    }

    @Test
    fun testPhonePeBusinessPaymentOf() {
        val result = PaymentParser.parse(
            title = "PhonePe Business",
            text = "Payment of ₹2,500 received from Suresh",
            bigText = "Payment of ₹2,500 received from Suresh",
            packageName = "com.phonepe.app",
            appName = "PhonePe"
        )
        assertNotNull("Should parse PhonePe Business payment of pattern", result)
        assertEquals("Suresh", result?.sender)
        assertEquals("₹2500", result?.amount)
    }

    @Test
    fun testPhonePeBankCredit() {
        val result = PaymentParser.parse(
            title = "PhonePe",
            text = "₹1,500.00 credited to your bank account XX5678 from Amit",
            bigText = "₹1,500.00 credited to your bank account XX5678 from Amit",
            packageName = "com.phonepe.app",
            appName = "PhonePe"
        )
        assertNotNull("Should parse PhonePe bank credit pattern", result)
        assertEquals("Amit", result?.sender)
        assertEquals("₹1500.00", result?.amount)
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2. Google Pay (GPay) Test Cases
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    fun testGooglePayPaidYouSymbol() {
        val result = PaymentParser.parse(
            title = "Google Pay",
            text = "Keep up the awesome streaming!",
            bigText = "Rahul Kumar paid you ₹500",
            packageName = "com.google.android.apps.nbu.paisa.user",
            appName = "Google Pay"
        )
        assertNotNull("Should parse Google Pay paid you symbol pattern", result)
        assertEquals("Rahul Kumar", result?.sender)
        assertEquals("₹500", result?.amount)
        assertEquals("Google Pay", result?.sourceApp)
        assertEquals("Keep up the awesome streaming!", result?.message)
    }

    @Test
    fun testGooglePayPaidYouWords() {
        val result = PaymentParser.parse(
            title = "Google Pay",
            text = "GG WP!",
            bigText = "Amit Sharma paid you 500 rupees",
            packageName = "com.google.android.apps.nbu.paisa.user",
            appName = "Google Pay"
        )
        assertNotNull("Should parse Google Pay paid you rupees words pattern", result)
        assertEquals("Amit Sharma", result?.sender)
        assertEquals("₹500", result?.amount)
        assertEquals("GG WP!", result?.message)
    }

    @Test
    fun testGooglePayPaymentFrom() {
        val result = PaymentParser.parse(
            title = "Google Pay",
            text = "Payment from Priya for ₹100",
            bigText = "Payment from Priya for ₹100",
            packageName = "com.google.android.apps.nbu.paisa.user",
            appName = "Google Pay"
        )
        assertNotNull("Should parse Google Pay payment from pattern", result)
        assertEquals("Priya", result?.sender)
        assertEquals("₹100", result?.amount)
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 3. Amazon Pay Test Cases
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    fun testAmazonPayTitleAmountBodySender() {
        val result = PaymentParser.parse(
            title = "₹500 received",
            text = "Money received from Rahul Sharma on Amazon Pay",
            bigText = "Money received from Rahul Sharma on Amazon Pay",
            packageName = "in.amazon.mShop.android.shopping",
            appName = "Amazon Pay"
        )
        assertNotNull("Should parse Amazon Pay title amount + body sender pattern", result)
        assertEquals("Rahul Sharma", result?.sender)
        assertEquals("₹500", result?.amount)
        assertEquals("Amazon Pay", result?.sourceApp)
    }

    @Test
    fun testAmazonPayStandaloneApp() {
        val result = PaymentParser.parse(
            title = "100.00 received",
            text = "Money received from Priya on Amazon Pay",
            bigText = "Money received from Priya on Amazon Pay",
            packageName = "com.amazon.pay.android",
            appName = "Amazon Pay"
        )
        assertNotNull("Should parse standalone Amazon Pay app pattern", result)
        assertEquals("Priya", result?.sender)
        assertEquals("₹100.00", result?.amount)
        assertEquals("Amazon Pay", result?.sourceApp)
    }

    @Test
    fun testAmazonPayReceivedFrom() {
        val result = PaymentParser.parse(
            title = "Amazon Pay",
            text = "Rs.750 received from Rajesh",
            bigText = "Rs.750 received from Rajesh",
            packageName = "com.amazon.mShop.android.shopping",
            appName = "Amazon Pay"
        )
        assertNotNull("Should parse Amazon Pay Rs. received from pattern", result)
        assertEquals("Rajesh", result?.sender)
        assertEquals("₹750", result?.amount)
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 4. WhatsApp Test Simulation
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    fun testWhatsAppSimulation() {
        val result = PaymentParser.parse(
            title = "WhatsApp",
            text = "₹500 received from Rahul",
            bigText = "₹500 received from Rahul",
            packageName = "com.whatsapp",
            appName = "WhatsApp"
        )
        assertNotNull("Should parse WhatsApp simulated test alert", result)
        assertEquals("Rahul", result?.sender)
        assertEquals("₹500", result?.amount)
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 5. Non-Payment Noise Filtering (Negative Test Cases)
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    fun testFilterOtpNotifications() {
        val result = PaymentParser.parse(
            title = "PhonePe OTP",
            text = "Your OTP for PhonePe is 482910. Do not share with anyone.",
            bigText = "Your OTP for PhonePe is 482910. Do not share with anyone.",
            packageName = "com.phonepe.app",
            appName = "PhonePe"
        )
        assertNull("OTP notifications must return null and be filtered out", result)
    }

    @Test
    fun testFilterPromotionalAds() {
        val result = PaymentParser.parse(
            title = "Google Pay Deals",
            text = "Get up to 50% cashback on your next food order with Zomato!",
            bigText = "Get up to 50% cashback on your next food order with Zomato!",
            packageName = "com.google.android.apps.nbu.paisa.user",
            appName = "Google Pay"
        )
        assertNull("Promotional deal notifications must return null and be filtered out", result)
    }

    @Test
    fun testFilterRechargeReminders() {
        val result = PaymentParser.parse(
            title = "Amazon Pay Bill Reminder",
            text = "Your electricity bill of ₹850 is due tomorrow. Pay now to avoid late fee.",
            bigText = "Your electricity bill of ₹850 is due tomorrow. Pay now to avoid late fee.",
            packageName = "in.amazon.mShop.android.shopping",
            appName = "Amazon Pay"
        )
        assertNull("Bill reminder alerts must return null and not trigger payment alerts", result)
    }

    @Test
    fun testFilterSecurityWarnings() {
        val result = PaymentParser.parse(
            title = "PhonePe Security Alert",
            text = "New device login detected from Chrome Windows. If not you, secure your account.",
            bigText = "New device login detected from Chrome Windows. If not you, secure your account.",
            packageName = "com.phonepe.app",
            appName = "PhonePe"
        )
        assertNull("Security warning notifications must return null", result)
    }

    @Test
    fun testFilterOutgoingPaymentsDebited() {
        val result = PaymentParser.parse(
            title = "Google Pay",
            text = "Paid ₹450 to Swiggy using HDFC Bank account XX1234",
            bigText = "Paid ₹450 to Swiggy using HDFC Bank account XX1234",
            packageName = "com.google.android.apps.nbu.paisa.user",
            appName = "Google Pay"
        )
        assertNull("Outgoing debited payment notifications must not trigger incoming alerts", result)
    }
}
