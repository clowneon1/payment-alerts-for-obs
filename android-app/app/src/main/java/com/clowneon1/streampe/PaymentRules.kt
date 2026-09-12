package com.clowneon1.streampe

/**
 * Declarative payment regex rules and extractors for supported UPI apps:
 * - PhonePe
 * - Google Pay (GPay)
 * - Amazon Pay
 * - Generic UPI fallback
 */
object PaymentRules {

    data class Rule(
        val id: String,
        val description: String,
        val titleRegex: Regex? = null,
        val bodyRegex: Regex? = null,
        val extractor: (titleMatch: MatchResult?, bodyMatch: MatchResult?, title: String, body: String) -> Pair<String, String>?
    )

    // Suffixes and noise to strip from extracted sender names
    val STRIP_SUFFIXES = listOf(
        Regex("""\s+on\s+amazon\s+pay.*""", RegexOption.IGNORE_CASE),
        Regex("""\s+on\s+google\s+pay.*""", RegexOption.IGNORE_CASE),
        Regex("""\s+using\s+upi.*""", RegexOption.IGNORE_CASE),
        Regex("""\s+to\s+your\s+(?:bank\s+)?account.*""", RegexOption.IGNORE_CASE),
        Regex("""\s+via\s+\w+.*""", RegexOption.IGNORE_CASE),
        Regex("""\s+for\s+order\s+#?.*""", RegexOption.IGNORE_CASE)
    )

    // ─────────────────────────────────────────────────────────────────────────
    // 1. PhonePe Rules
    // ─────────────────────────────────────────────────────────────────────────
    val PHONEPE_RULES = listOf(
        // PhonePe - <Sender> in Title, amount in Body
        Rule(
            id = "phonepe_title_sender_body_amount",
            description = "PhonePe - <Sender> in Title with amount in Body",
            titleRegex = Regex("""^PhonePe\s*[-:]\s*(.+)$""", RegexOption.IGNORE_CASE),
            bodyRegex = Regex("""(?:(?:₹|rs\.?\s*)([\d,]+(?:\.\d{1,2})?)\s+received|has\s+sent\s+(?:₹|rs\.?\s*)([\d,]+(?:\.\d{1,2})?))""", RegexOption.IGNORE_CASE),
            extractor = { titleMatch, bodyMatch, _, _ ->
                val sender = titleMatch?.groupValues?.getOrNull(1)?.trim() ?: return@Rule null
                val amount = bodyMatch?.groupValues?.getOrNull(1)?.takeIf { it.isNotBlank() }
                    ?: bodyMatch?.groupValues?.getOrNull(2)?.takeIf { it.isNotBlank() }
                    ?: return@Rule null
                sender to amount
            }
        ),
        // <Sender> has sent ₹<Amount>
        Rule(
            id = "phonepe_has_sent",
            description = "<Sender> has sent ₹<Amount>",
            bodyRegex = Regex("""^(.+?)\s+has\s+sent\s+(?:₹|rs\.?\s*)([\d,]+(?:\.\d{1,2})?)""", RegexOption.IGNORE_CASE),
            extractor = { _, bodyMatch, _, _ ->
                val sender = bodyMatch?.groupValues?.getOrNull(1)?.trim() ?: return@Rule null
                val amount = bodyMatch?.groupValues?.getOrNull(2)?.trim() ?: return@Rule null
                sender to amount
            }
        ),
        // ₹<Amount> received from <Sender>
        Rule(
            id = "phonepe_amount_received_from",
            description = "₹<Amount> received from <Sender>",
            bodyRegex = Regex("""(?:₹|rs\.?\s*)([\d,]+(?:\.\d{1,2})?)\s+received\s+from\s+(.+)""", RegexOption.IGNORE_CASE),
            extractor = { _, bodyMatch, _, _ ->
                val amount = bodyMatch?.groupValues?.getOrNull(1)?.trim() ?: return@Rule null
                val sender = bodyMatch?.groupValues?.getOrNull(2)?.trim() ?: return@Rule null
                sender to amount
            }
        ),
        // Payment of ₹<Amount> received from <Sender>
        Rule(
            id = "phonepe_payment_of_amount",
            description = "Payment of ₹<Amount> received from <Sender>",
            bodyRegex = Regex("""payment\s+of\s+(?:₹|rs\.?\s*)([\d,]+(?:\.\d{1,2})?)\s+received\s+from\s+(.+)""", RegexOption.IGNORE_CASE),
            extractor = { _, bodyMatch, _, _ ->
                val amount = bodyMatch?.groupValues?.getOrNull(1)?.trim() ?: return@Rule null
                val sender = bodyMatch?.groupValues?.getOrNull(2)?.trim() ?: return@Rule null
                sender to amount
            }
        ),
        // <Sender> sent ₹<Amount>
        Rule(
            id = "phonepe_sent_amount",
            description = "<Sender> sent ₹<Amount>",
            bodyRegex = Regex("""^(.+?)\s+sent\s+(?:₹|rs\.?\s*)([\d,]+(?:\.\d{1,2})?)""", RegexOption.IGNORE_CASE),
            extractor = { _, bodyMatch, _, _ ->
                val sender = bodyMatch?.groupValues?.getOrNull(1)?.trim() ?: return@Rule null
                val amount = bodyMatch?.groupValues?.getOrNull(2)?.trim() ?: return@Rule null
                sender to amount
            }
        ),
        // ₹<Amount> credited to your bank account ... from <Sender>
        Rule(
            id = "phonepe_bank_credit",
            description = "₹<Amount> credited to your bank account ... from <Sender>",
            bodyRegex = Regex("""(?:₹|rs\.?\s*)([\d,]+(?:\.\d{1,2})?)\s+credited\s+to\s+your\s+bank\s+account.*from\s+(.+)""", RegexOption.IGNORE_CASE),
            extractor = { _, bodyMatch, _, _ ->
                val amount = bodyMatch?.groupValues?.getOrNull(1)?.trim() ?: return@Rule null
                val sender = bodyMatch?.groupValues?.getOrNull(2)?.trim() ?: return@Rule null
                sender to amount
            }
        )
    )

    // ─────────────────────────────────────────────────────────────────────────
    // 2. Google Pay Rules
    // ─────────────────────────────────────────────────────────────────────────
    val GPAY_RULES = listOf(
        // <Sender> paid you ₹<Amount>
        Rule(
            id = "gpay_paid_you_symbol",
            description = "<Sender> paid you ₹<Amount>",
            bodyRegex = Regex("""^(.+?)\s+paid\s+you\s+(?:₹|rs\.?\s*)([\d,]+(?:\.\d{1,2})?)""", RegexOption.IGNORE_CASE),
            extractor = { _, bodyMatch, _, _ ->
                val sender = bodyMatch?.groupValues?.getOrNull(1)?.trim() ?: return@Rule null
                val amount = bodyMatch?.groupValues?.getOrNull(2)?.trim() ?: return@Rule null
                sender to amount
            }
        ),
        // <Sender> paid you <Amount> rupees
        Rule(
            id = "gpay_paid_you_words",
            description = "<Sender> paid you <Amount> rupees",
            bodyRegex = Regex("""^(.+?)\s+paid\s+you\s+([\d,]+(?:\.\d{1,2})?)\s+rupees""", RegexOption.IGNORE_CASE),
            extractor = { _, bodyMatch, _, _ ->
                val sender = bodyMatch?.groupValues?.getOrNull(1)?.trim() ?: return@Rule null
                val amount = bodyMatch?.groupValues?.getOrNull(2)?.trim() ?: return@Rule null
                sender to amount
            }
        ),
        // Payment from <Sender> for ₹<Amount>
        Rule(
            id = "gpay_payment_from",
            description = "Payment from <Sender> for ₹<Amount>",
            bodyRegex = Regex("""payment\s+from\s+(.+?)\s+for\s+(?:₹|rs\.?\s*)([\d,]+(?:\.\d{1,2})?)""", RegexOption.IGNORE_CASE),
            extractor = { _, bodyMatch, _, _ ->
                val sender = bodyMatch?.groupValues?.getOrNull(1)?.trim() ?: return@Rule null
                val amount = bodyMatch?.groupValues?.getOrNull(2)?.trim() ?: return@Rule null
                sender to amount
            }
        ),
        // You received ₹<Amount> from <Sender>
        Rule(
            id = "gpay_received_from",
            description = "You received ₹<Amount> from <Sender>",
            bodyRegex = Regex("""you\s+received\s+(?:₹|rs\.?\s*)([\d,]+(?:\.\d{1,2})?)\s+from\s+(.+)""", RegexOption.IGNORE_CASE),
            extractor = { _, bodyMatch, _, _ ->
                val amount = bodyMatch?.groupValues?.getOrNull(1)?.trim() ?: return@Rule null
                val sender = bodyMatch?.groupValues?.getOrNull(2)?.trim() ?: return@Rule null
                sender to amount
            }
        )
    )

    // ─────────────────────────────────────────────────────────────────────────
    // 3. Amazon Pay Rules
    // ─────────────────────────────────────────────────────────────────────────
    val AMAZON_RULES = listOf(
        // Amount in Title, Sender in Body: "Money received from <Sender> on Amazon Pay"
        Rule(
            id = "amazon_title_amount_body_sender",
            description = "₹<Amount> received + Money received from <Sender> on Amazon Pay",
            titleRegex = Regex("""(?:₹|rs\.?\s*)?([\d,]+(?:\.\d{1,2})?)\s+received""", RegexOption.IGNORE_CASE),
            bodyRegex = Regex("""money\s+rec(?:ei)?ved\s+from\s+(.+?)\s+on\s+amazon\s+pay""", RegexOption.IGNORE_CASE),
            extractor = { titleMatch, bodyMatch, _, _ ->
                val amount = titleMatch?.groupValues?.getOrNull(1)?.trim() ?: return@Rule null
                val sender = bodyMatch?.groupValues?.getOrNull(1)?.trim() ?: return@Rule null
                sender to amount
            }
        ),
        // Body: "₹<Amount> received from <Sender>"
        Rule(
            id = "amazon_received_from",
            description = "₹<Amount> received from <Sender>",
            bodyRegex = Regex("""(?:₹|rs\.?\s*)([\d,]+(?:\.\d{1,2})?)\s+received\s+from\s+(.+)""", RegexOption.IGNORE_CASE),
            extractor = { _, bodyMatch, _, _ ->
                val amount = bodyMatch?.groupValues?.getOrNull(1)?.trim() ?: return@Rule null
                val sender = bodyMatch?.groupValues?.getOrNull(2)?.trim() ?: return@Rule null
                sender to amount
            }
        ),
        // Body: "<Sender> paid you ₹<Amount> on Amazon Pay"
        Rule(
            id = "amazon_paid_you",
            description = "<Sender> paid you ₹<Amount> on Amazon Pay",
            bodyRegex = Regex("""^(.+?)\s+paid\s+you\s+(?:₹|rs\.?\s*)([\d,]+(?:\.\d{1,2})?)""", RegexOption.IGNORE_CASE),
            extractor = { _, bodyMatch, _, _ ->
                val sender = bodyMatch?.groupValues?.getOrNull(1)?.trim() ?: return@Rule null
                val amount = bodyMatch?.groupValues?.getOrNull(2)?.trim() ?: return@Rule null
                sender to amount
            }
        )
    )

    // ─────────────────────────────────────────────────────────────────────────
    // 4. Generic Fallbacks (Any App)
    // ─────────────────────────────────────────────────────────────────────────
    val GENERIC_RULES = listOf(
        Rule(
            id = "generic_has_sent",
            description = "<Sender> has sent ₹<Amount>",
            bodyRegex = Regex("""(.+?)\s+has\s+sent\s+(?:₹|rs\.?\s*)([\d,]+(?:\.\d{1,2})?)""", RegexOption.IGNORE_CASE),
            extractor = { _, bodyMatch, _, _ ->
                val sender = bodyMatch?.groupValues?.getOrNull(1)?.trim() ?: return@Rule null
                val amount = bodyMatch?.groupValues?.getOrNull(2)?.trim() ?: return@Rule null
                sender to amount
            }
        ),
        Rule(
            id = "generic_payment_of_received",
            description = "Payment of ₹<Amount> received from <Sender>",
            bodyRegex = Regex("""payment\s+of\s+(?:₹|rs\.?\s*)([\d,]+(?:\.\d{1,2})?)\s+received\s+from\s+(.+)""", RegexOption.IGNORE_CASE),
            extractor = { _, bodyMatch, _, _ ->
                val amount = bodyMatch?.groupValues?.getOrNull(1)?.trim() ?: return@Rule null
                val sender = bodyMatch?.groupValues?.getOrNull(2)?.trim() ?: return@Rule null
                sender to amount
            }
        ),
        Rule(
            id = "generic_amount_received_from",
            description = "₹<Amount> received from <Sender>",
            bodyRegex = Regex("""(?:₹|rs\.?\s*)([\d,]+(?:\.\d{1,2})?)\s+received\s+from\s+(.+)""", RegexOption.IGNORE_CASE),
            extractor = { _, bodyMatch, _, _ ->
                val amount = bodyMatch?.groupValues?.getOrNull(1)?.trim() ?: return@Rule null
                val sender = bodyMatch?.groupValues?.getOrNull(2)?.trim() ?: return@Rule null
                sender to amount
            }
        ),
        Rule(
            id = "generic_sent_amount",
            description = "<Sender> sent ₹<Amount>",
            bodyRegex = Regex("""^(.+?)\s+sent\s+(?:₹|rs\.?\s*)([\d,]+(?:\.\d{1,2})?)""", RegexOption.IGNORE_CASE),
            extractor = { _, bodyMatch, _, _ ->
                val sender = bodyMatch?.groupValues?.getOrNull(1)?.trim() ?: return@Rule null
                val amount = bodyMatch?.groupValues?.getOrNull(2)?.trim() ?: return@Rule null
                sender to amount
            }
        ),
        Rule(
            id = "generic_you_paid",
            description = "You paid ₹<Amount> to <Sender> (Simulated/Outgoing)",
            bodyRegex = Regex("""you\s+(?:have\s+)?paid\s+(?:₹|rs\.?\s*)([\d,]+(?:\.\d{1,2})?)\s+to\s+(.+)""", RegexOption.IGNORE_CASE),
            extractor = { _, bodyMatch, _, _ ->
                val amount = bodyMatch?.groupValues?.getOrNull(1)?.trim() ?: return@Rule null
                val sender = bodyMatch?.groupValues?.getOrNull(2)?.trim() ?: return@Rule null
                sender to amount
            }
        )
    )
}
