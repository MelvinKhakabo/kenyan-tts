package com.kenyantts.engine

import android.content.Context

/**
 * The person's choice of base voice, saved on the phone.
 *   "sw"  - Kiswahili voice, English words respelled (default: says N-words natively)
 *   "en"  - English voice, Kiswahili words respelled
 *   "off" - no rewriting, for side-by-side comparison
 */
object Prefs {
    private const val FILE = "kenyan_tts"
    private const val KEY_BASE = "base"

    fun base(context: Context): String =
        context.getSharedPreferences(FILE, Context.MODE_PRIVATE).getString(KEY_BASE, "sw") ?: "sw"

    fun setBase(context: Context, value: String) {
        context.getSharedPreferences(FILE, Context.MODE_PRIVATE).edit().putString(KEY_BASE, value).apply()
    }
}
