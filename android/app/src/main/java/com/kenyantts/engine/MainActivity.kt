package com.kenyantts.engine

import android.os.Bundle
import android.speech.tts.TextToSpeech
import android.widget.Button
import android.widget.EditText
import android.widget.RadioGroup
import android.widget.TextView
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat

/**
 * The app's one screen: choose the base voice, and try a message.
 * Built for TalkBack users: every control has a spoken label, text follows the
 * phone's font size (sp units), touch targets are at least 48dp, light and dark
 * mode follow the phone.
 */
class MainActivity : AppCompatActivity() {

    private var tts: TextToSpeech? = null
    @Volatile private var lexicon: Lexicon? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContentView(R.layout.activity_main)
        ViewCompat.setOnApplyWindowInsetsListener(findViewById(R.id.main)) { v, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            v.setPadding(bars.left, bars.top, bars.right, bars.bottom)
            insets
        }

        // Base voice choice, saved for the engine to use.
        val group = findViewById<RadioGroup>(R.id.baseGroup)
        group.check(
            when (Prefs.base(this)) {
                "en" -> R.id.baseEn
                "off" -> R.id.baseOff
                else -> R.id.baseSw
            }
        )
        group.setOnCheckedChangeListener { _, checkedId ->
            Prefs.setBase(
                this,
                when (checkedId) {
                    R.id.baseEn -> "en"
                    R.id.baseOff -> "off"
                    else -> "sw"
                }
            )
            updatePreview()
        }

        // Load the word lists for the preview, without freezing the screen.
        Thread {
            lexicon = LexiconLoader.load(this)
            runOnUiThread { updatePreview() }
        }.start()

        // Speak through OUR engine (by package name), exactly as TalkBack would.
        tts = TextToSpeech(this, { }, packageName)

        findViewById<Button>(R.id.speak).setOnClickListener {
            val text = findViewById<EditText>(R.id.testText).text.toString()
            updatePreview()
            tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, "kenyan-tts-test")
        }
    }

    /** Show exactly what the voice will receive, so the team can see the rewriting. */
    private fun updatePreview() {
        val lex = lexicon ?: return
        val text = findViewById<EditText>(R.id.testText).text.toString()
        val plan = Respell.plan(text, lex, Prefs.base(this), "en")
        val voice = if (plan.lang == "sw") "Kiswahili" else "English"
        findViewById<TextView>(R.id.preview).text = "The $voice voice receives: ${plan.text}"
    }

    override fun onDestroy() {
        tts?.shutdown()
        super.onDestroy()
    }
}
