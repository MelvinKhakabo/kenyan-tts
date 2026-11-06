// Step 4: pronunciation test page.
// Plays each sentence three ways using the phone's own voices (Web Speech API):
// Google English, Google Kiswahili, and ours (each part sent to the right voice).
import { createCodeSwitcher } from '../rules/codeswitch.js';

const status = document.getElementById('status');
const words = (text) => new Set(text.split(/\r?\n/).map((w) => w.trim()).filter(Boolean));

// Load the same files the Node scripts use.
async function loadLexicon() {
  const [en, sw, kenyan] = await Promise.all([
    fetch('../lexicon/english.txt').then((r) => r.text()),
    fetch('../lexicon/swahili.txt').then((r) => r.text()),
    fetch('../lexicon/kenyan.json').then((r) => r.json()),
  ]);
  const lexicon = new Map(Object.entries(kenyan.words).map(([w, e]) => [w.toLowerCase(), e]));
  return { english: words(en), swahili: words(sw), lexicon };
}

// Test sentences come from eval/test-set.txt, with the /en /sw /x labels removed.
async function loadSentences() {
  const text = await fetch('../eval/test-set.txt').then((r) => r.text());
  return text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))
    .map((l) => l.replace(/\/(en|sw|x)\b/g, ''));
}

// Voices load late on Android, so wait for them.
function getVoices() {
  return new Promise((resolve) => {
    const v = speechSynthesis.getVoices();
    if (v.length) return resolve(v);
    speechSynthesis.addEventListener('voiceschanged', () => resolve(speechSynthesis.getVoices()), { once: true });
    setTimeout(() => resolve(speechSynthesis.getVoices()), 3000);
  });
}

// Prefer a Kenyan voice (en-KE, sw-KE), otherwise any voice for the language.
const pick = (voices, prefix) =>
  voices.find((v) => v.lang.toLowerCase().replace('_', '-').startsWith(prefix + '-ke')) ||
  voices.find((v) => v.lang.toLowerCase().startsWith(prefix)) || null;

let voice = { en: null, sw: null };

// Speak a list of { lang, text } parts, one after another.
function speak(parts) {
  speechSynthesis.cancel();
  for (const part of parts) {
    const u = new SpeechSynthesisUtterance(part.text);
    u.lang = part.lang === 'sw' ? 'sw-KE' : 'en-GB';
    if (voice[part.lang]) u.voice = voice[part.lang];
    speechSynthesis.speak(u);
  }
}

function play(cs, sentence, mode) {
  if (mode === 'ours') speak(cs.segments(sentence));
  else speak([{ lang: mode, text: sentence }]);
}

async function main() {
  const [lex, sentences, voices] = await Promise.all([loadLexicon(), loadSentences(), getVoices()]);
  const cs = createCodeSwitcher(lex);
  voice = { en: pick(voices, 'en'), sw: pick(voices, 'sw') };

  status.textContent = voice.sw
    ? `Ready. English voice: ${voice.en ? voice.en.name : 'default'}. Kiswahili voice: ${voice.sw.name}.`
    : 'Warning: no Kiswahili voice found on this device, so all three buttons will sound the same. On Android, set Google as the preferred speech engine and download the Kiswahili voice, then reload this page.';

  const list = document.getElementById('sentences');
  sentences.forEach((s, i) => {
    const n = i + 1;
    const box = document.createElement('section');
    box.className = 'sentence';
    box.setAttribute('aria-labelledby', `s${n}`);
    const h = document.createElement('h3');
    h.id = `s${n}`;
    h.textContent = `Sentence ${n}`;
    const p = document.createElement('p');
    p.textContent = s;
    box.append(h, p);
    for (const [mode, label] of [['en', 'Google English voice'], ['sw', 'Google Kiswahili voice'], ['ours', 'Our version']]) {
      const b = document.createElement('button');
      b.textContent = `Sentence ${n}: ${label}`;
      if (mode === 'ours') b.className = 'ours';
      b.addEventListener('click', () => play(cs, s, mode));
      box.append(b);
    }
    list.append(box);
  });

  document.querySelectorAll('[data-own]').forEach((b) => b.addEventListener('click', () => {
    const text = document.getElementById('own').value.trim();
    if (!text) { status.textContent = 'Type or paste a message first.'; return; }
    play(cs, text, b.dataset.own);
  }));
  document.getElementById('stop').addEventListener('click', () => speechSynthesis.cancel());
}

main().catch((e) => { status.textContent = 'Something went wrong loading the page: ' + e.message; });