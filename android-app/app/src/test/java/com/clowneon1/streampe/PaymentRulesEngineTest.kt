package com.clowneon1.streampe

import org.junit.Assert.*
import org.junit.Test

class PaymentRulesEngineTest {

    @Test
    fun testRuleSetsIntegrity() {
        assertFalse("PhonePe rules must not be empty", PaymentRules.PHONEPE_RULES.isEmpty())
        assertFalse("GPay rules must not be empty", PaymentRules.GPAY_RULES.isEmpty())
        assertFalse("Amazon Pay rules must not be empty", PaymentRules.AMAZON_RULES.isEmpty())
        assertFalse("Generic fallback rules must not be empty", PaymentRules.GENERIC_RULES.isEmpty())

        val allRules = PaymentRules.PHONEPE_RULES +
                PaymentRules.GPAY_RULES +
                PaymentRules.AMAZON_RULES +
                PaymentRules.GENERIC_RULES

        val ruleIds = allRules.map { it.id }
        assertEquals("All rule IDs must be unique", ruleIds.toSet().size, ruleIds.size)

        allRules.forEach { rule ->
            assertTrue("Rule ID must not be blank", rule.id.isNotBlank())
            assertTrue("Rule description must not be blank", rule.description.isNotBlank())
            assertTrue(
                "Rule must have at least one regex defined",
                rule.titleRegex != null || rule.bodyRegex != null
            )
        }
    }

    @Test
    fun testCleanSenderSuffixStripping() {
        assertEquals("Rahul Sharma", PaymentParser.cleanSender("Rahul Sharma on Amazon Pay"))
        assertEquals("Rahul Sharma", PaymentParser.cleanSender("Rahul Sharma on Google Pay"))
        assertEquals("Amit Verma", PaymentParser.cleanSender("Amit Verma using UPI"))
        assertEquals("Suresh", PaymentParser.cleanSender("Suresh to your bank account XX1234"))
        assertEquals("Priya", PaymentParser.cleanSender("Priya via HDFC Bank"))
        assertEquals("Vikram", PaymentParser.cleanSender("Vikram for order #123456"))
    }

    @Test
    fun testAmountNormalisation() {
        assertEquals("₹500", PaymentParser.normaliseAmount("500"))
        assertEquals("₹500.00", PaymentParser.normaliseAmount("₹500.00"))
        assertEquals("₹1250", PaymentParser.normaliseAmount("Rs. 1,250"))
        assertEquals("₹2500.50", PaymentParser.normaliseAmount("Rs 2,500.50"))
        assertEquals("₹300", PaymentParser.normaliseAmount("300 rupees"))
        assertEquals("₹10000", PaymentParser.normaliseAmount("₹ 10,000"))
    }

    @Test
    fun testDirectRuleExecution() {
        val phonePeRule = PaymentRules.PHONEPE_RULES.first { it.id == "phonepe_has_sent" }
        assertNotNull("phonepe_has_sent rule must exist", phonePeRule)
        val body = "Rahul Sharma has sent ₹500 to your bank account"
        val match = phonePeRule.bodyRegex?.find(body)
        assertNotNull("Body regex must match", match)
        val result = phonePeRule.extractor(null, match, "", body)
        assertNotNull("Extractor must extract pair", result)
        assertEquals("Rahul Sharma", result?.first)
        assertEquals("500", result?.second)
    }
}
