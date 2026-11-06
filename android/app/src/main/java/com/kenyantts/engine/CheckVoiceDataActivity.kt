package com.kenyantts.engine

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.speech.tts.TextToSpeech

/**
 * Android asks each speech engine which languages it has ready.
 * We answer: English and Kiswahili, both ready. No screen is shown.
 */
class CheckVoiceDataActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val result = Intent()
            .putStringArrayListExtra(
                TextToSpeech.Engine.EXTRA_AVAILABLE_VOICES,
                arrayListOf("eng-USA", "swa-KEN")
            )
            .putStringArrayListExtra(
                TextToSpeech.Engine.EXTRA_UNAVAILABLE_VOICES,
                arrayListOf()
            )
        setResult(TextToSpeech.Engine.CHECK_VOICE_DATA_PASS, result)
        finish()
    }
}