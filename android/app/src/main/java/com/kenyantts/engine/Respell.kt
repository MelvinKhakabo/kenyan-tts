package com.kenyantts.engine

/**
 * One-voice rewriting. Kotlin copy of rules/respell.js - keep the two in step.
 *
 * The whole sentence goes to ONE voice in one request (no gaps). Words that voice
 * would get wrong are respelled into spelling it reads correctly:
 *   base "sw": Kiswahili voice; English words respelled from CMUdict sounds
 *   base "en": English voice; Kiswahili words respelled by rule, syllable by syllable
 * Numbers and acronyms are written out as words in the base voice's language.
 */
data class Plan(val text: String, val lang: String)

object Respell {
    // --- Kiswahili word -> spelling an English voice reads correctly --------
    private val SW_VOWEL_FOR_EN = mapOf('a' to "ah", 'e' to "eh", 'i' to "ee", 'o' to "oh", 'u' to "oo")
    private val SW_CONS_FOR_EN = listOf("dh" to "th", "ng'" to "ng", "gh" to "g")
    private val SYLLABLE = Regex("[^aeiou]*[aeiou]|[^aeiou]+$")

    fun swahiliForEnglishVoice(word: String): String {
        var w = word.lowercase()
        for ((from, to) in SW_CONS_FOR_EN) w = w.replace(from, to)
        val syllables = SYLLABLE.findAll(w).map { it.value }.toList().ifEmpty { listOf(w) }
        return syllables.joinToString("-") { s ->
            val last = s.lastOrNull()
            if (last != null && last in SW_VOWEL_FOR_EN) s.dropLast(1) + SW_VOWEL_FOR_EN.getValue(last) else s
        }
    }

    // --- English word -> spelling a Kiswahili voice reads correctly ---------
    private val ARPA_FOR_SW = mapOf(
        "AA" to "a", "AE" to "e", "AH" to "a", "AO" to "o", "AW" to "au", "AY" to "ai", "EH" to "e", "ER" to "a", "EY" to "ei",
        "IH" to "i", "IY" to "i", "OW" to "ou", "OY" to "oi", "UH" to "u", "UW" to "u",
        "B" to "b", "CH" to "ch", "D" to "d", "DH" to "dh", "F" to "f", "G" to "g", "HH" to "h", "JH" to "j", "K" to "k", "L" to "l",
        "M" to "m", "N" to "n", "NG" to "ng", "P" to "p", "R" to "r", "S" to "s", "SH" to "sh", "T" to "t", "TH" to "th", "V" to "v",
        "W" to "w", "Y" to "y", "Z" to "z", "ZH" to "sh",
    )
    private val DIGIT = Regex("\\d")

    fun englishForSwahiliVoice(word: String, cmu: Map<String, String>): String {
        val phones = cmu[word.lowercase()] ?: return word   // not in CMUdict: leave it to the voice
        val list = phones.split(" ").map { it.replace(DIGIT, "") }
        // Kenyan English drops "r" after a vowel ("customer" = kastama) but keeps it
        // before a vowel ("arrive" = araiv), so ER becomes "ar" only before a vowel.
        return list.mapIndexed { i, p ->
            val nextIsVowel = list.getOrNull(i + 1)?.let { it.isNotEmpty() && it[0] in "AEIOU" } == true
            if (p == "ER" && nextIsVowel) "ar" else ARPA_FOR_SW[p] ?: ""
        }.joinToString("")
    }

    // --- Numbers ------------------------------------------------------------
    private val EN_ONES = listOf("zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
        "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen")
    private val EN_TENS = listOf("", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety")
    private val SW_ONES = listOf("sifuri", "moja", "mbili", "tatu", "nne", "tano", "sita", "saba", "nane", "tisa")
    private val SW_TENS = listOf("", "kumi", "ishirini", "thelathini", "arobaini", "hamsini", "sitini", "sabini", "themanini", "tisini")

    private fun enWords(n: Int): String = when {
        n < 20 -> EN_ONES[n]
        n < 100 -> EN_TENS[n / 10] + if (n % 10 != 0) " " + EN_ONES[n % 10] else ""
        n < 1000 -> EN_ONES[n / 100] + " hundred" + if (n % 100 != 0) " and " + enWords(n % 100) else ""
        n < 1_000_000 -> enWords(n / 1000) + " thousand" + if (n % 1000 != 0) " " + enWords(n % 1000) else ""
        else -> n.toString()
    }

    private fun swWords(n: Int): String = when {
        n < 10 -> SW_ONES[n]
        n < 100 -> SW_TENS[n / 10] + if (n % 10 != 0) " na " + SW_ONES[n % 10] else ""
        n < 1000 -> "mia " + SW_ONES[n / 100] + if (n % 100 != 0) " " + swWords(n % 100) else ""
        n < 1_000_000 -> "elfu " + swWords(n / 1000) + if (n % 1000 != 0) " " + swWords(n % 1000) else ""
        else -> n.toString()
    }

    private fun digitsOneByOne(s: String, base: String): String =
        s.filter { it.isDigit() }.map { (if (base == "sw") SW_ONES else EN_ONES)[it - '0'] }.joinToString(" ")

    private val NUMBER = Regex("^([\\d,.:]+)\\s?(am|pm)?$", RegexOption.IGNORE_CASE)
    private val PLAIN_DIGITS = Regex("^\\d+$")

    fun numberToWords(text: String, base: String): String {
        val m = NUMBER.find(text.trim()) ?: return text
        val num = m.groupValues[1]
        val ampm = m.groupValues[2].lowercase()
        val suffix = when {
            ampm.isEmpty() -> ""
            base == "sw" -> " " + ampm.map { LETTERS_SW.getValue(it) }.joinToString(" ")
            else -> " " + ampm.toList().joinToString(" ")
        }
        // Long numbers (tokens, phone numbers, paybills) are read digit by digit.
        val plain = num.replace(",", "")
        if (!PLAIN_DIGITS.matches(plain) || plain.length > 4) return digitsOneByOne(num, base) + suffix
        val n = plain.toInt()
        return (if (base == "sw") swWords(n) else enWords(n)) + suffix
    }

    // --- Acronyms (KPLC, KRA): letter names in the base voice's language ------
    private val LETTERS_SW = mapOf('a' to "ei", 'b' to "bi", 'c' to "si", 'd' to "di", 'e' to "i", 'f' to "efu", 'g' to "ji",
        'h' to "eichi", 'i' to "ai", 'j' to "jei", 'k' to "kei", 'l' to "eli", 'm' to "emu", 'n' to "eni", 'o' to "ou",
        'p' to "pi", 'q' to "kyu", 'r' to "ara", 's' to "esi", 't' to "ti", 'u' to "yu", 'v' to "vi", 'w' to "dabliyu",
        'x' to "eksi", 'y' to "wai", 'z' to "zedi")
    private val ACRONYM = Regex("^[A-Z]{2,5}$")
    private val SPACES = Regex("\\s+")

    private fun spellAcronym(w: String, base: String): String =
        w.lowercase().map { if (base == "sw") LETTERS_SW.getValue(it) else it.uppercase() }.joinToString(" ")

    /** Rewrite a whole sentence for one voice. */
    fun oneVoice(text: String, lex: Lexicon, base: String): String {
        val tokens = CodeSwitch.label(text, lex)
        // A number next to another number ("1234 5678") is a token, phone or account
        // number: read every digit, never "one thousand two hundred...".
        fun near(i: Int, step: Int): Token? {
            var j = i + step
            while (tokens.getOrNull(j)?.type == TokenType.SPACE) j += step
            return tokens.getOrNull(j)
        }
        return tokens.mapIndexed { i, t ->
            when (t.type) {
                TokenType.NUMBER -> {
                    val inGroup = near(i, -1)?.type == TokenType.NUMBER || near(i, 1)?.type == TokenType.NUMBER
                    if (inGroup) digitsOneByOne(t.text, base) else numberToWords(t.text, base)
                }
                TokenType.WORD -> when {
                    t.source != "lexicon" && ACRONYM.matches(t.text) && t.text.lowercase() !in lex.cmu -> spellAcronym(t.text, base)
                    else -> {
                        val word = t.say ?: t.text
                        if (t.lang == base) word
                        else word.split(SPACES).joinToString(" ") { w ->
                            if (base == "en") swahiliForEnglishVoice(w) else englishForSwahiliVoice(w, lex.cmu)
                        }
                    }
                }
                else -> t.text
            }
        }.joinToString("")
    }

    /**
     * Decide what to send to Google, and in which voice.
     *   base "off": unchanged text, in the language TalkBack asked for (for comparison)
     *   all-English text (TalkBack menus, "Double-tap to activate"): unchanged, English voice
     *   anything else: rewritten for one voice in the chosen base language
     */
    fun plan(text: String, lex: Lexicon?, base: String, requestLang: String): Plan {
        if (base == "off" || lex == null) return Plan(text, requestLang)
        val words = CodeSwitch.label(text, lex).filter { it.type == TokenType.WORD }
        if (words.all { it.lang == "en" }) return Plan(text, "en")
        return Plan(oneVoice(text, lex, base), base)
    }
}
