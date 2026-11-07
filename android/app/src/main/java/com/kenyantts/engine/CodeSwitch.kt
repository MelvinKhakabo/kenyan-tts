package com.kenyantts.engine

/**
 * Kenyan code-switching rules. Kotlin copy of rules/codeswitch.js - keep the two in step.
 * Decides, word by word, whether to pronounce a word as English ("en") or Kiswahili ("sw").
 *
 * Order of decisions for each word:
 *   1. lexicon   - hand-checked entries (Sheng, names, exceptions) always win
 *   2. list      - known Kiswahili or English word
 *   3. prefix    - Kiswahili prefixes stripped, root is a known Kiswahili word
 *   4. shape     - unknown word (4+ letters) that looks Kiswahili: pronunciation, not origin
 *   5. neighbour - words in both lists, or unknown, follow the words around them
 */
enum class TokenType { WORD, NUMBER, SPACE, PUNCT }

class Token(val type: TokenType, val text: String) {
    var lang: String? = null
    var say: String? = null
    var source: String = ""
}

object CodeSwitch {
    private val SUBJECT = listOf("hatu", "ham", "hawa", "hu", "ha", "si", "ni", "tu", "wa", "u", "a", "m", "i", "ki", "vi", "zi", "li", "ya", "ku", "pa")
    private val TENSE = listOf("nge", "ngali", "na", "li", "ta", "me", "ki", "ka", "ja", "sha", "")
    private val SW_CLUSTERS = setOf("ch", "sh", "th", "dh", "gh", "ny", "ng", "mb", "nd", "nj", "nz", "mv", "kw", "mw", "bw", "gw", "tw", "sw", "nw", "pw", "fy", "vy", "by", "py", "my", "ky", "ly")
    private val VOWELS = setOf('a', 'e', 'i', 'o', 'u')

    // Same pattern as the JavaScript: words, numbers (keeping am/pm), spaces, punctuation.
    private val TOKEN = Regex("(\\p{L}[\\p{L}'’-]*)|(\\d[\\d,.:]*(?:\\s?(?:am|pm)\\b)?)|(\\s+)|([^\\p{L}\\d\\s]+)", RegexOption.IGNORE_CASE)
    private val CONSONANT_RUN = Regex("[^aeiou]+")

    /** Does this word look like Kiswahili spelling? */
    fun looksSwahili(word: String): Boolean {
        val w = word.lowercase().replace("'", "")
        if (w.length < 2) return false
        if ('q' in w || 'x' in w) return false                  // never in Kiswahili
        if (Regex("c(?!h)").containsMatchIn(w)) return false    // "c" only appears as "ch"
        if (w.last() !in VOWELS) return false                   // Kiswahili words end in a vowel
        for (run in CONSONANT_RUN.findAll(w).map { it.value }) {
            if (run.length == 1) continue
            if (run.length == 2 && run in SW_CLUSTERS) continue
            if (run.length == 3 && (run.startsWith("ng") || run.startsWith("mb") || run.startsWith("nd") ||
                    run.startsWith("nj") || run.startsWith("ny") || run.endsWith("w") || run.endsWith("y"))) continue
            return false
        }
        return true
    }

    /** Strip Kiswahili verb prefixes (u-ta-pata) and look for the root in the Kiswahili list. */
    fun swahiliRoot(word: String, swahili: Set<String>): String? {
        val w = word.lowercase()
        for (s in SUBJECT) {
            if (!w.startsWith(s)) continue
            val rest = w.substring(s.length)
            for (t in TENSE) {
                if (!rest.startsWith(t)) continue
                val root = rest.substring(t.length)
                if (root.length >= 2 && root in swahili) return root
            }
        }
        return null
    }

    fun tokenize(text: String): List<Token> = TOKEN.findAll(text).map { m ->
        when {
            m.groups[1] != null -> Token(TokenType.WORD, m.value)
            m.groups[2] != null -> Token(TokenType.NUMBER, m.value)
            m.groups[3] != null -> Token(TokenType.SPACE, m.value)
            else -> Token(TokenType.PUNCT, m.value)
        }
    }.toList()

    private fun classify(t: Token, lex: Lexicon) {
        val w = t.text.lowercase()
        val entry = lex.entries[w]
        if (entry != null) { t.lang = entry.lang; t.say = entry.say; t.source = "lexicon"; return }
        val inSw = w in lex.swahili
        val inEn = w in lex.english
        when {
            inSw && !inEn -> { t.lang = "sw"; t.source = "list" }
            inEn && !inSw -> { t.lang = "en"; t.source = "list" }
            inSw && inEn -> { t.lang = null; t.source = "both-lists" }
            swahiliRoot(w, lex.swahili) != null -> { t.lang = "sw"; t.source = "prefix" }
            // Shape only for 4+ letters: short English words (to, go, so, me) look Kiswahili too.
            w.length >= 4 && looksSwahili(w) -> { t.lang = "sw"; t.source = "shape" }
            else -> { t.lang = null; t.source = "unknown" }
        }
    }

    /** Label every token with a language. */
    fun label(text: String, lex: Lexicon): List<Token> {
        val tokens = tokenize(text)
        val words = tokens.filter { it.type == TokenType.WORD }
        words.forEach { classify(it, lex) }

        // Words still undecided take the language of their nearest decided neighbours.
        val decided = words.filter { it.lang != null }
        val majority = if (decided.count { it.lang == "sw" } > decided.size / 2.0) "sw" else "en"
        words.forEachIndexed { i, t ->
            if (t.lang != null) return@forEachIndexed
            val left = words.subList(0, i).asReversed().firstOrNull { it.lang != null && it.source != "neighbour" }
            val right = words.subList(i + 1, words.size).firstOrNull { it.lang != null && it.source != "neighbour" }
            t.lang = if (left != null && right != null && left.lang != right.lang) majority
                     else (left ?: right)?.lang ?: majority
            t.source = if (t.source == "unknown") "neighbour" else "neighbour (${t.source})"
        }
        // Numbers and punctuation follow the word before them (or after, at the start).
        tokens.forEachIndexed { i, t ->
            if (t.lang != null) return@forEachIndexed
            val prev = tokens.subList(0, i).asReversed().firstOrNull { it.type == TokenType.WORD }
            val next = tokens.subList(i + 1, tokens.size).firstOrNull { it.type == TokenType.WORD }
            t.lang = (prev ?: next)?.lang ?: majority
        }
        return tokens
    }
}
