package com.kenyantts.engine

import android.media.AudioFormat
import android.speech.tts.SynthesisCallback
import android.speech.tts.SynthesisRequest
import android.speech.tts.TextToSpeech
import android.speech.tts.TextToSpeechService
import android.speech.tts.UtteranceProgressListener
import android.speech.tts.Voice
import android.util.Log
import java.io.File
import java.io.RandomAccessFile
import java.util.Locale
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/**
 * Kenyan TTS engine.
 *
 * TalkBack (or any app) sends us text. We ask Google's speech engine to turn it
 * into a WAV file, then stream that audio back. We never make sound ourselves.
 *
 * Step 8: pass-through only, no rewriting yet. This proves the route
 * TalkBack -> our engine -> Google -> speaker works on a real phone.
 * Step 10 adds the Kenyan rewriting before the text goes to Google.
 */
class KenyanTtsService : TextToSpeechService() {

    companion object {
        private const val TAG = "KenyanTTS"
        private const val GOOGLE_ENGINE = "com.google.android.tts"
        private const val FALLBACK_SAMPLE_RATE = 22050
    }

    private lateinit var google: TextToSpeech
    private val googleReady = CountDownLatch(1)
    @Volatile private var googleOk = false
    @Volatile private var stopped = false

    // One waiting latch per request we send to Google, keyed by request id.
    private val pending = ConcurrentHashMap<String, CountDownLatch>()
    private val succeeded = ConcurrentHashMap<String, Boolean>()

    private var currentLanguage = arrayOf("eng", "USA", "")

    override fun onCreate() {
        super.onCreate()
        // Connect to Google's engine by name, so we never connect to ourselves.
        google = TextToSpeech(this, { status ->
            googleOk = status == TextToSpeech.SUCCESS
            Log.d(TAG, "Google engine ready: $googleOk")
            googleReady.countDown()
        }, GOOGLE_ENGINE)

        google.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
            override fun onStart(utteranceId: String) {}
            override fun onDone(utteranceId: String) {
                succeeded[utteranceId] = true
                pending[utteranceId]?.countDown()
            }
            @Deprecated("Deprecated in Java")
            override fun onError(utteranceId: String) {
                pending[utteranceId]?.countDown()
            }
            override fun onError(utteranceId: String, errorCode: Int) {
                pending[utteranceId]?.countDown()
            }
            override fun onStop(utteranceId: String, interrupted: Boolean) {
                pending[utteranceId]?.countDown()
            }
        })
    }

    override fun onDestroy() {
        google.shutdown()
        super.onDestroy()
    }

    // --- Languages: we offer English and Kiswahili ---------------------------

    override fun onIsLanguageAvailable(lang: String?, country: String?, variant: String?): Int {
        if (lang != "eng" && lang != "swa") return TextToSpeech.LANG_NOT_SUPPORTED
        return if (country.isNullOrEmpty()) TextToSpeech.LANG_AVAILABLE
        else TextToSpeech.LANG_COUNTRY_AVAILABLE
    }

    override fun onGetLanguage(): Array<String> = currentLanguage

    override fun onLoadLanguage(lang: String?, country: String?, variant: String?): Int {
        val result = onIsLanguageAvailable(lang, country, variant)
        if (result >= TextToSpeech.LANG_AVAILABLE) {
            currentLanguage = arrayOf(lang ?: "eng", country ?: "", variant ?: "")
        }
        return result
    }

    // --- NEW: Voices. Newer Android (and TalkBack) ask for named voices -------

    private val voices = listOf(
        Voice("en-US", Locale("en", "US"), Voice.QUALITY_HIGH, Voice.LATENCY_NORMAL, false, emptySet<String>()),
        Voice("sw-KE", Locale("sw", "KE"), Voice.QUALITY_HIGH, Voice.LATENCY_NORMAL, false, emptySet<String>()),
    )

    override fun onGetVoices(): List<Voice> = voices

    override fun onIsValidVoiceName(voiceName: String?): Int =
        if (voices.any { it.name == voiceName }) TextToSpeech.SUCCESS else TextToSpeech.ERROR

    override fun onLoadVoice(voiceName: String?): Int {
        val voice = voices.firstOrNull { it.name == voiceName } ?: return TextToSpeech.ERROR
        currentLanguage = arrayOf(voice.locale.getISO3Language(), voice.locale.getISO3Country(), "")
        return TextToSpeech.SUCCESS
    }

    // Whatever language is asked for, we always have a voice: Kiswahili for
    // Kiswahili requests, English for everything else.
    override fun onGetDefaultVoiceNameFor(lang: String?, country: String?, variant: String?): String =
        if (lang == "swa") "sw-KE" else "en-US"

    // --- Stopping: TalkBack calls this the moment the user swipes ------------

    override fun onStop() {
        stopped = true
        google.stop()
    }

    // --- Speaking ------------------------------------------------------------

    override fun onSynthesizeText(request: SynthesisRequest?, callback: SynthesisCallback?) {
        if (request == null || callback == null) return
        stopped = false

        val text = request.charSequenceText?.toString() ?: ""
        Log.d(TAG, "Request (${request.language}, rate ${request.speechRate}): $text")

        if (text.isBlank()) {
            callback.start(FALLBACK_SAMPLE_RATE, AudioFormat.ENCODING_PCM_16BIT, 1)
            callback.done()
            return
        }
        if (!googleReady.await(5, TimeUnit.SECONDS) || !googleOk) {
            Log.e(TAG, "Google speech engine is not available on this phone")
            callback.error()
            return
        }

        // Step 8: pass-through. Step 10 will rewrite `text` and choose the base voice here.
        val locale = if (request.language == "swa") Locale("sw", "KE") else Locale("en", "US")

        val wav = synthesizeWithGoogle(text, locale, request.speechRate, request.pitch)
        if (wav == null) {
            if (!stopped) callback.error()
            return
        }
        try {
            streamWav(wav, callback)
        } finally {
            wav.delete()
        }
    }

    /** Ask Google to write `text` to a WAV file, and wait until it is finished. */
    private fun synthesizeWithGoogle(text: String, locale: Locale, rate: Int, pitch: Int): File? {
        val id = UUID.randomUUID().toString()
        val file = File(cacheDir, "$id.wav")
        val latch = CountDownLatch(1)
        pending[id] = latch

        synchronized(google) {
            google.setLanguage(locale)
            google.setSpeechRate(rate / 100f)   // TalkBack's speed: 100 = normal
            google.setPitch(pitch / 100f)
            val result = google.synthesizeToFile(text, null, file, id)
            if (result != TextToSpeech.SUCCESS) {
                pending.remove(id)
                Log.e(TAG, "Google refused the request")
                return null
            }
        }

        val finished = latch.await(15, TimeUnit.SECONDS)
        pending.remove(id)
        val ok = succeeded.remove(id) == true
        if (!finished || !ok || stopped) {
            file.delete()
            return null
        }
        return file
    }

    /** Read a WAV file and hand its audio to Android in small pieces, stopping early if asked. */
    private fun streamWav(file: File, callback: SynthesisCallback) {
        RandomAccessFile(file, "r").use { raf ->
            raf.seek(12) // skip "RIFF", file size, "WAVE"
            var sampleRate = FALLBACK_SAMPLE_RATE
            var channels = 1
            var bits = 16

            while (raf.filePointer + 8 <= raf.length()) {
                val idBytes = ByteArray(4)
                raf.readFully(idBytes)
                val chunkId = String(idBytes, Charsets.US_ASCII)
                val size = Integer.reverseBytes(raf.readInt()) // WAV numbers are little-endian

                when (chunkId) {
                    "fmt " -> {
                        val fmt = ByteArray(size)
                        raf.readFully(fmt)
                        channels = le16(fmt, 2)
                        sampleRate = le32(fmt, 4)
                        bits = le16(fmt, 14)
                    }
                    "data" -> {
                        if (bits != 16) {
                            Log.e(TAG, "Unexpected audio format: $bits bits")
                            callback.error()
                            return
                        }
                        callback.start(sampleRate, AudioFormat.ENCODING_PCM_16BIT, channels)
                        val left = raf.length() - raf.filePointer
                        var remaining = if (size <= 0 || size > left) left.toInt() else size
                        val buffer = ByteArray(callback.maxBufferSize)
                        while (remaining > 0 && !stopped) {
                            val n = raf.read(buffer, 0, minOf(buffer.size, remaining))
                            if (n <= 0) break
                            callback.audioAvailable(buffer, 0, n)
                            remaining -= n
                        }
                        callback.done()
                        return
                    }
                    else -> raf.seek(raf.filePointer + size + (size and 1)) // skip other chunks
                }
            }
            Log.e(TAG, "No audio found in Google's file")
            callback.error()
        }
    }

    private fun le16(b: ByteArray, i: Int) =
        (b[i].toInt() and 0xff) or ((b[i + 1].toInt() and 0xff) shl 8)

    private fun le32(b: ByteArray, i: Int) =
        le16(b, i) or (le16(b, i + 2) shl 16)
}