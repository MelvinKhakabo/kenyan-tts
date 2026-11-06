// Pronunciation test page.
// Plays each sentence four ways using the device's own voices (Web Speech API):
//   1. English voice, sentence as written (what TalkBack does today)
//   2. Kiswahili voice, sentence as written
//   3. One voice, English base: whole sentence to the English voice,
//      Kiswahili words respelled so it says them correctly
//   4. One voice, Kiswahili base: whole sentence to the Kiswahili voice,
//      English words respelled so it says them correctly
import { createCodeSwitcher } from '../rules/codeswitch.js';
import { oneVoice } from '../rules/respell.js';

const $ = (id) => document.getElementById(id);
const say = (text) => { $('message').textContent = text; };
const lines = (text) => text.split(/\r?\n/).map((w) => w.trim()).filter(Boolean);

// Load the same files the Node scripts use.
async function loadData() {
  const get = (path) => fetch(path).then((r) => { if (!r.ok) throw new Error(path + ' ' + r.status); return r; });
  const [en, sw, kenyan, cmu, tests] = await Promise.all([
    get('../lexicon/english.txt').then((r) => r.text()),
    get('../lexicon/swahili.txt').then((r) => r.text()),
    get('../lexicon/kenyan.json').then((r) => r.json()),
    get('../lexicon/cmu.txt').then((r) => r.text()),
    get('../eval/test-set.txt').then((r) => r.text()),
  ]);
  return {
    english: new Set(lines(en)),
    swahili: new Set(lines(sw)),
    lexicon: new Map(Object.entries(kenyan.words).map(([w, e]) => [w.toLowerCase(), e])),
    cmu: new Map(lines(cmu).map((l) => { const i = l.indexOf(' '); return [l.slice(0, i), l.slice(i + 1)]; })),
    // Test sentences with the /en /sw /x labels removed.
    sentences: lines(tests).filter((l) => !l.startsWith('#')).map((l) => l.replace(/\/(en|sw|x)\b/g, '')),
  };
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

// Fill a voice picker. Kenyan voices first, then other voices for that language.
function fillPicker(select, voices, prefix) {
  const norm = (v) => v.lang.toLowerCase().replace('_', '-');
  const mine = voices.filter((v) => norm(v).startsWith(prefix))
    .sort((a, b) => (norm(b).endsWith('-ke') ? 1 : 0) - (norm(a).endsWith('-ke') ? 1 : 0));
  select.innerHTML = '';
  for (const v of mine) select.append(new Option(`${v.name} (${v.lang})`, v.name));
  if (!mine.length) select.append(new Option('No voice found for this language', ''));
  return mine;
}

let allVoices = [];
const chosen = (id) => allVoices.find((v) => v.name === $(id).value) || null;

// Speak one text with one voice, in one request.
function speakOne(text, lang) {
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const v = chosen(lang === 'sw' ? 'sw-voice' : 'en-voice');
  u.lang = lang === 'sw' ? 'sw-KE' : 'en-KE';
  if (v) u.voice = v;
  speechSynthesis.speak(u);
}

const MODES = [
  ['en', '1, English voice as written'],
  ['sw', '2, Kiswahili voice as written'],
  ['one-en', '3, one voice, English base'],
  ['one-sw', '4, one voice, Kiswahili base'],
];

function rewrite(ctx, sentence, mode) {
  if (mode === 'one-en') return oneVoice(ctx.cs, ctx.cmu, sentence, 'en');
  if (mode === 'one-sw') return oneVoice(ctx.cs, ctx.cmu, sentence, 'sw');
  return sentence;
}

function play(ctx, sentence, mode) {
  const lang = mode === 'sw' || mode === 'one-sw' ? 'sw' : 'en';
  speakOne(rewrite(ctx, sentence, mode), lang);
}

function buttonsFor(ctx, getSentence, labelPrefix) {
  return MODES.map(([mode, label]) => {
    const b = document.createElement('button');
    b.textContent = `${labelPrefix}: button ${label}`;
    if (mode.startsWith('one')) b.className = 'one';
    b.addEventListener('click', () => {
      const s = getSentence();
      if (!s) { say('Type or paste a message first.'); return; }
      say('');
      play(ctx, s, mode);
    });
    return b;
  });
}

async function main() {
  const [data, voices] = await Promise.all([loadData(), getVoices()]);
  allVoices = voices;
  const ctx = { cs: createCodeSwitcher(data), cmu: data.cmu };

  const en = fillPicker($('en-voice'), voices, 'en');
  const sw = fillPicker($('sw-voice'), voices, 'sw');
  $('voices').textContent = sw.length
    ? `Ready. ${en.length} English and ${sw.length} Kiswahili voices found. Choose them under "Voices".`
    : 'No Kiswahili voice on this device, so buttons 2 and 4 will not sound right. On Android, set Google as the preferred speech engine and download the Kiswahili voice, then reload.';

  $('own-buttons').append(...buttonsFor(ctx, () => $('own').value.trim(), 'Your message'));

  data.sentences.forEach((s, i) => {
    const n = i + 1;
    const box = document.createElement('section');
    box.className = 'sentence';
    box.setAttribute('aria-labelledby', `s${n}`);
    const h = document.createElement('h3');
    h.id = `s${n}`;
    h.textContent = `Sentence ${n}`;
    const p = document.createElement('p');
    p.textContent = s;
    // What each one-voice button actually sends to the voice, for the team to inspect.
    const details = document.createElement('details');
    details.innerHTML = '<summary>Show rewritten text</summary>';
    for (const mode of ['one-en', 'one-sw']) {
      const r = document.createElement('p');
      r.className = 'rewrite';
      r.textContent = `${mode === 'one-en' ? 'Button 3' : 'Button 4'}: ${rewrite(ctx, s, mode)}`;
      details.append(r);
    }
    box.append(h, p, ...buttonsFor(ctx, () => s, `Sentence ${n}`), details);
    $('sentences').append(box);
  });

  $('stop').addEventListener('click', () => speechSynthesis.cancel());
}

main().catch((e) => { $('voices').textContent = 'Something went wrong loading the page: ' + e.message; });