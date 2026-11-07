package com.kenyantts.engine

/**
 * The word lists and Kenyan lexicon, loaded from app/src/main/assets/lexicon/.
 * Those files are copied from the repo's lexicon/ folder by `npm run sync:android`,
 * so the app, the web page and the tests all use the same words.
 */
data class Entry(val lang: String, val say: String?)

class Lexicon(
    val english: Set<String>,
    val swahili: Set<String>,
    val entries: Map<String, Entry>,   // kenyan.tsv: hand-checked words, always win
    val cmu: Map<String, String>,      // English word -> CMUdict sounds, e.g. "S T EY1 JH"
) {
    companion object {
        /** Build a Lexicon from the lines of the four files (no Android code, so it can be tested anywhere). */
        fun fromLines(
            englishLines: List<String>,
            swahiliLines: List<String>,
            kenyanTsvLines: List<String>,
            cmuLines: List<String>,
        ): Lexicon {
            fun clean(lines: List<String>) = lines.map { it.trim() }.filter { it.isNotEmpty() }
            val entries = clean(kenyanTsvLines).associate { line ->
                val parts = line.split("\t")
                parts[0] to Entry(parts[1], parts.getOrNull(2)?.takeIf { it.isNotEmpty() })
            }
            val cmu = clean(cmuLines).associate { line ->
                val i = line.indexOf(' ')
                line.substring(0, i) to line.substring(i + 1)
            }
            return Lexicon(clean(englishLines).toHashSet(), clean(swahiliLines).toHashSet(), entries, cmu)
        }
    }
}
