package com.clowneon1.streampe

/**
 * Extracts (sender, amount, sourceApp, message) from UPI payment notification text.
 * Imports declarative rules from PaymentRules.kt.
 *
 * Returns ParsedPayment when a valid payment notification matches the rules.
 * Returns null if the notification does NOT match any payment patterns (e.g. OTPs, promos, ads).
 */
object PaymentParser {

    data class ParsedPayment(
        val sender: String,
        val amount: String,
        val sourceApp: String,
        val message: String = ""
    )

    // -- Amount normalisation -------------------------------------------------

    fun normaliseAmount(raw: String): String {
        val stripped = raw.trim()
            .replace(Regex("""^[₹\u20B9]\s*"""), "")
            .replace(Regex("""^[Rr][Ss]\.?\s*"""), "")
            .replace(Regex("""\s*rupees$""", RegexOption.IGNORE_CASE), "")
            .replace(",", "")
            .trim()
        return "₹$stripped"
    }

    // -- Sender name cleaning -------------------------------------------------

    fun cleanSender(name: String): String {
        var s = name.trim()
        for (rx in PaymentRules.STRIP_SUFFIXES) {
            s = rx.replace(s, "")
        }
        return s.trim()
    }

    // -------------------------------------------------------------------------

    fun parse(
        title: String,
        text: String,
        bigText: String,
        packageName: String,
        appName: String
    ): ParsedPayment? {

        val tTrim = title.trim()
        val textTrim = text.trim()
        val bigTextTrim = bigText.trim()
        val pkgLower = packageName.trim().lowercase()
        val appLower = appName.trim().lowercase()

        val isGPay = pkgLower.contains("paisa") || pkgLower.contains("gpay") ||
                appLower.contains("google pay") || appLower.contains("gpay")
        val isAmazon = pkgLower.contains("amazon") || appLower.contains("amazon")
        val isPhonePe = pkgLower.contains("phonepe") || appLower.contains("phonepe")

        // Candidates for body text: prefer bigText if present, then text
        val bodyCandidates = listOf(bigTextTrim, textTrim).filter { it.isNotBlank() }.distinct()

        // 1. Google Pay
        if (isGPay) {
            for (candidate in bodyCandidates) {
                for (rule in PaymentRules.GPAY_RULES) {
                    val bodyMatch = rule.bodyRegex?.find(candidate)
                    if (bodyMatch != null) {
                        val extracted = rule.extractor(null, bodyMatch, tTrim, candidate)
                        if (extracted != null) {
                            val (rawSender, rawAmount) = extracted
                            val message = if (textTrim != candidate && textTrim.isNotBlank()) textTrim else ""
                            return ParsedPayment(
                                sender = cleanSender(rawSender),
                                amount = normaliseAmount(rawAmount),
                                sourceApp = "Google Pay",
                                message = message
                            )
                        }
                    }
                }
            }
        }

        // 2. Amazon Pay
        if (isAmazon) {
            for (candidate in bodyCandidates) {
                for (rule in PaymentRules.AMAZON_RULES) {
                    val titleMatch = rule.titleRegex?.find(tTrim)
                    val bodyMatch = rule.bodyRegex?.find(candidate)

                    if (rule.titleRegex != null && titleMatch == null) continue
                    if (rule.bodyRegex != null && bodyMatch == null) continue

                    val extracted = rule.extractor(titleMatch, bodyMatch, tTrim, candidate)
                    if (extracted != null) {
                        val (rawSender, rawAmount) = extracted
                        return ParsedPayment(
                            sender = cleanSender(rawSender),
                            amount = normaliseAmount(rawAmount),
                            sourceApp = "Amazon Pay"
                        )
                    }
                }
            }
        }

        // 3. PhonePe
        if (isPhonePe) {
            for (candidate in bodyCandidates) {
                for (rule in PaymentRules.PHONEPE_RULES) {
                    val titleMatch = rule.titleRegex?.find(tTrim)
                    val bodyMatch = rule.bodyRegex?.find(candidate)

                    if (rule.titleRegex != null && titleMatch == null) continue
                    if (rule.bodyRegex != null && bodyMatch == null) continue

                    val extracted = rule.extractor(titleMatch, bodyMatch, tTrim, candidate)
                    if (extracted != null) {
                        val (rawSender, rawAmount) = extracted
                        return ParsedPayment(
                            sender = cleanSender(rawSender),
                            amount = normaliseAmount(rawAmount),
                            sourceApp = "PhonePe"
                        )
                    }
                }
            }
        }

        // 4. Generic Fallbacks (Any App)
        for (candidate in bodyCandidates) {
            for (rule in PaymentRules.GENERIC_RULES) {
                val bodyMatch = rule.bodyRegex?.find(candidate)
                if (bodyMatch != null) {
                    val extracted = rule.extractor(null, bodyMatch, tTrim, candidate)
                    if (extracted != null) {
                        val (rawSender, rawAmount) = extracted
                        val source = if (appName.isNotBlank()) appName else "UPI"
                        return ParsedPayment(
                            sender = cleanSender(rawSender),
                            amount = normaliseAmount(rawAmount),
                            sourceApp = source
                        )
                    }
                }
            }
        }

        return null
    }
}
