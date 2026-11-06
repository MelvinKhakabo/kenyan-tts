// Kenyan code-switching rules.
// Decides, word by word, whether to pronounce a word as English ("en")
// or Kiswahili ("sw"), and records why. No AI, no network.
//
// Order of decisions for each word:
//   1. lexicon   - hand-checked entries (Sheng, names, exceptions) always win
//   2. list      - known Kiswahili or English word
//   3. prefix    - Kiswahili prefixes stripped, root is a known Kiswahili word
//   4. shape     - unknown word that looks Kiswahili (pronunciation, not origin)
//   5. neighbour - words in both lists, or unknown, follow the words around them

// Kiswahili verb prefixes, longest first, so "hatu" is tried before "ha".
// subject (ni, u, a, tu, m, wa ...) + tense (na, li, ta, me, ki, nge ...)
const SUBJECT = ['hatu', 'ham', 'hawa', 'hu', 'ha', 'si', 'ni', 'tu', 'wa', 'u', 'a', 'm', 'i', 'ki', 'vi', 'zi', 'li', 'ya', 'ku', 'pa'];
const TENSE = ['nge', 'ngali', 'na', 'li', 'ta', 'me', 'ki', 'ka', 'ja', 'sha', ''];

// Letter pairs that are normal in Kiswahili spelling.
const SW_CLUSTERS = ['ch', 'sh', 'th', 'dh', 'gh', 'ny', 'ng', 'mb', 'nd', 'nj', 'nz', 'mv', 'ny', 'kw', 'mw', 'bw', 'gw', 'tw', 'sw', 'nw', 'pw', 'fy', 'vy', 'by', 'py', 'my', 'ky', 'ly'];

const VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);

// Does this word look like Kiswahili spelling?
export function looksSwahili(word) {
  const w = word.toLowerCase().replace(/'/g, '');
  if (w.length < 2) return false;
  if (/[qx]/.test(w)) return false;            // never in Kiswahili
  if (/c(?!h)/.test(w)) return false;          // "c" only appears as "ch"
  if (!VOWELS.has(w[w.length - 1])) return false; // Kiswahili words end in a vowel
  // Every run of consonants must be one consonant or a known Kiswahili cluster.
  const runs = w.match(/[^aeiou]+/g) || [];
  for (const run of runs) {
    if (run.length === 1) continue;
    if (run.length === 2 && SW_CLUSTERS.includes(run)) continue;
    if (run.length === 3 && (run.startsWith('ng') || run.startsWith('mb') || run.startsWith('nd') || run.startsWith('nj') || run.startsWith('ny') || run.endsWith('w') || run.endsWith('y'))) continue;
    return false;
  }
  return true;
}

// Try to strip Kiswahili verb prefixes and find the root in the Kiswahili list.
export function swahiliRoot(word, swahili) {
  const w = word.toLowerCase();
  for (const s of SUBJECT) {
    if (!w.startsWith(s)) continue;
    for (const t of TENSE) {
      const rest = w.slice(s.length);
      if (!rest.startsWith(t)) continue;
      const root = rest.slice(t.length);
      if (root.length >= 2 && swahili.has(root)) return root;
    }
  }
  return null;
}

// Split text into tokens, keeping everything so the sentence can be rebuilt.
export function tokenize(text) {
  const re = /([\p{L}][\p{L}'’-]*)|(\d[\d,.:]*\s?(?:am|pm)?)|(\s+)|([^\p{L}\d\s]+)/giu;
  const tokens = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m[1]) tokens.push({ type: 'word', text: m[1] });
    else if (m[2]) tokens.push({ type: 'number', text: m[2] });
    else if (m[3]) tokens.push({ type: 'space', text: m[3] });
    else tokens.push({ type: 'punct', text: m[4] });
  }
  return tokens;
}

// Build a code-switcher from word lists and a lexicon.
//   english, swahili: Set of lowercase words
//   lexicon: Map of lowercase word -> { lang: 'en' | 'sw', say?: string }
export function createCodeSwitcher({ english = new Set(), swahili = new Set(), lexicon = new Map() } = {}) {

  function classifyWord(word) {
    const w = word.toLowerCase();
    if (lexicon.has(w)) {
      const e = lexicon.get(w);
      return { lang: e.lang, say: e.say, source: 'lexicon' };
    }
    const inSw = swahili.has(w);
    const inEn = english.has(w);
    if (inSw && !inEn) return { lang: 'sw', source: 'list' };
    if (inEn && !inSw) return { lang: 'en', source: 'list' };
    if (inSw && inEn) return { lang: null, source: 'both-lists' };
    if (swahiliRoot(w, swahili)) return { lang: 'sw', source: 'prefix' };
    // Shape only for 4+ letters: short English words (to, go, so, me) look Kiswahili too.
    if (w.length >= 4 && looksSwahili(w)) return { lang: 'sw', source: 'shape' };
    return { lang: null, source: 'unknown' };
  }

  // Label every token with a language.
  function label(text) {
    const tokens = tokenize(text);
    for (const t of tokens) {
      if (t.type === 'word') Object.assign(t, classifyWord(t.text));
      else t.lang = null;
    }
    // Words still undecided take the language of their nearest decided neighbours.
    const words = tokens.filter((t) => t.type === 'word');
    const decided = words.filter((t) => t.lang);
    const majority = decided.filter((t) => t.lang === 'sw').length > decided.length / 2 ? 'sw' : 'en';
    words.forEach((t, i) => {
      if (t.lang) return;
      const left = words.slice(0, i).reverse().find((x) => x.lang && x.source !== 'neighbour');
      const right = words.slice(i + 1).find((x) => x.lang && x.source !== 'neighbour');
      t.lang = left && right && left.lang !== right.lang ? majority : (left || right)?.lang || majority;
      t.source = t.source === 'unknown' ? 'neighbour' : 'neighbour (' + t.source + ')';
    });
    // Numbers and punctuation follow the word before them (or after, at the start).
    tokens.forEach((t, i) => {
      if (t.lang) return;
      const prev = tokens.slice(0, i).reverse().find((x) => x.type === 'word');
      const next = tokens.slice(i + 1).find((x) => x.type === 'word');
      t.lang = (prev || next)?.lang || majority;
    });
    return tokens;
  }

  // Group labelled tokens into runs of one language, ready to be spoken.
  function segments(text) {
    const runs = [];
    for (const t of label(text)) {
      const spoken = t.say || t.text;
      const last = runs[runs.length - 1];
      if (last && (last.lang === t.lang || t.type === 'space')) last.text += spoken;
      else runs.push({ lang: t.lang, text: spoken });
    }
    return runs.map((r) => ({ ...r, text: r.text.trim() })).filter((r) => r.text);
  }

  return { classifyWord, label, segments };
}