package com.kenyantts.engine

import android.content.Context

/** Reads the lexicon files from app/src/main/assets/lexicon/ (copied there by `npm run sync:android`). */
object LexiconLoader {
    fun load(context: Context): Lexicon {
        fun lines(name: String): List<String> =
            context.assets.open("lexicon/$name").bufferedReader().use { it.readLines() }
        return Lexicon.fromLines(
            lines("english.txt"),
            lines("swahili.txt"),
            lines("kenyan.tsv"),
            lines("cmu.txt"),
        )
    }
}
