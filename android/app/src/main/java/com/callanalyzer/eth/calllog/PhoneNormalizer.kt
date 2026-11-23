package com.callanalyzer.eth.calllog

object PhoneNormalizer {
    /**
     * Normalizes Ethiopian and international numbers so that:
     * - 0911xxxxxx, +251911xxxxxx, 251911xxxxxx, 00251911xxxxxx, +2510911xxxxxx, 911xxxxxx -> 0911xxxxxx
     * - 07xxxxxxxx, +2517xxxxxxxx, 2517xxxxxxxx, 002517xxxxxxxx, +25107xxxxxxxx, 7xxxxxxxx -> 07xxxxxxxx
     */
    fun normalize(raw: String?): String {
        if (raw.isNullOrBlank()) return ""
        val trimmed = raw.trim()
        val hasLeadingPlus = trimmed.startsWith("+")
        val digitsOnly = trimmed.replace(Regex("[^0-9]"), "")
        if (digitsOnly.isEmpty()) return ""

        // Strip +251 or 00251 or 251 country code
        var national: String? = null
        when {
            digitsOnly.startsWith("00251") && digitsOnly.length > 5 -> {
                national = digitsOnly.substring(5)
            }
            digitsOnly.startsWith("251") && digitsOnly.length >= 11 -> {
                national = digitsOnly.substring(3)
            }
        }

        if (national != null) {
            // Handle redundant trunk '0' after +251 (e.g., +2510911xxxxxx or +25107xxxxxxxx)
            val stripped = if (national.startsWith("0")) national.substring(1) else national
            if (stripped.length == 9 && (stripped.startsWith("9") || stripped.startsWith("7"))) {
                return "0$stripped"
            }
            if (national.startsWith("0") && national.length == 10) {
                return national
            }
            return if (national.startsWith("0")) national else "0$national"
        }

        // Local 10-digit mobile / landline already starting with 0
        if (digitsOnly.startsWith("0")) {
            return digitsOnly
        }

        // Bare 9-digit Ethiopian mobile (9xxxxxxxx or 7xxxxxxxx)
        if (!hasLeadingPlus && digitsOnly.length == 9 && (digitsOnly.startsWith("9") || digitsOnly.startsWith("7"))) {
            return "0$digitsOnly"
        }

        return if (hasLeadingPlus) "+$digitsOnly" else digitsOnly
    }
}
