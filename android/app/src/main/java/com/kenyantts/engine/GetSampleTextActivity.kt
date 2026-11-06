package com.kenyantts.engine

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.speech.tts.TextToSpeech

/**
 * The "Play" button in Settings asks the engine for a sample sentence to speak.
 * We give a mixed Kenyan sentence, so Play shows off code-switching.
 */
class GetSampleTextActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val language = intent.getStringExtra("language") ?: "eng"
        val sample = if (language == "swa")
            "Niaje msee! Hii ni Kenyan TTS, inasoma Kiswahili, Sheng na English kwa sauti moja."
        else
            "Niaje msee! This is Kenyan TTS, reading English, Kiswahili and Sheng in one voice."
        val result = Intent().putExtra(TextToSpeech.Engine.EXTRA_SAMPLE_TEXT, sample)
        setResult(TextToSpeech.LANG_AVAILABLE, result)
        finish()
    }
}