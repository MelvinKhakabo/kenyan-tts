// One-voice rewriting.
// Instead of switching voices mid-sentence (gaps, broken rhythm), the whole
// sentence goes to ONE voice in one request. Words that the voice would get
// wrong are rewritten into spelling that voice reads correctly.
//
//   base 'en': English voice. Kiswahili words are respelled for English readers.
//   base 'sw': Kiswahili voice. English words are respelled for Kiswahili readers
//              using CMUdict pronunciations.
// Numbers and acronyms are written out as words in the base voice's language.

// --- Kiswahili word -> spelling an English voice reads correctly -----------
// Kiswahili spelling is regular, so this is done by rule, syllable by syllable.
const SW_VOWEL_FOR_EN = { a: 'ah', e: 'eh', i: 'ee', o: 'oh', u: 'oo' };
const SW_CONS_FOR_EN = [['dh', 'th'], ["ng'", 'ng'], ['gh', 'g']];

export function swahiliForEnglishVoice(word) {
  let w = word.toLowerCase();
  for (const [from, to] of SW_CONS_FOR_EN) w = w.split(from).join(to);
  const syllables = w.match(/[^aeiou]*[aeiou]|[^aeiou]+$/g) || [w];
  return syllables
    .map((s) => s.replace(/[aeiou]$/, (v) => SW_VOWEL_FOR_EN[v]))
    .join('-');
}

// --- English word -> spelling a Kiswahili voice reads correctly ------------
// CMUdict sounds (ARPAbet) mapped to Kiswahili letters.
const ARPA_FOR_SW = {
  AA: 'a', AE: 'e', AH: 'a', AO: 'o', AW: 'au', AY: 'ai', EH: 'e', ER: 'a', EY: 'ei',
  IH: 'i', IY: 'i', OW: 'ou', OY: 'oi', UH: 'u', UW: 'u',
  B: 'b', CH: 'ch', D: 'd', DH: 'dh', F: 'f', G: 'g', HH: 'h', JH: 'j', K: 'k', L: 'l',
  M: 'm', N: 'n', NG: 'ng', P: 'p', R: 'r', S: 's', SH: 'sh', T: 't', TH: 'th', V: 'v',
  W: 'w', Y: 'y', Z: 'z', ZH: 'sh',
};

export function englishForSwahiliVoice(word, cmu) {
  const phones = cmu.get(word.toLowerCase());
  if (!phones) return word; // not in CMUdict: leave it for the voice to guess
  const list = phones.split(' ').map((p) => p.replace(/\d/g, ''));
  const isVowel = (p) => p && /^[AEIOU]/.test(p);
  // Kenyan English drops "r" after a vowel ("customer" = kastama) but keeps it
  // before a vowel ("arrive" = araiv), so ER becomes "ar" only before a vowel.
  return list.map((p, i) => (p === 'ER' && isVowel(list[i + 1]) ? 'ar' : ARPA_FOR_SW[p] ?? '')).join('');
}

// --- Numbers ---------------------------------------------------------------
const EN_ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const EN_TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const SW_ONES = ['sifuri', 'moja', 'mbili', 'tatu', 'nne', 'tano', 'sita', 'saba', 'nane', 'tisa'];
const SW_TENS = ['', 'kumi', 'ishirini', 'thelathini', 'arobaini', 'hamsini', 'sitini', 'sabini', 'themanini', 'tisini'];

function enWords(n) {
  if (n < 20) return EN_ONES[n];
  if (n < 100) return EN_TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + EN_ONES[n % 10] : '');
  if (n < 1000) return EN_ONES[Math.floor(n / 100)] + ' hundred' + (n % 100 ? ' and ' + enWords(n % 100) : '');
  if (n < 1e6) return enWords(Math.floor(n / 1000)) + ' thousand' + (n % 1000 ? ' ' + enWords(n % 1000) : '');
  return String(n);
}

function swWords(n) {
  if (n < 10) return SW_ONES[n];
  if (n < 100) return SW_TENS[Math.floor(n / 10)] + (n % 10 ? ' na ' + SW_ONES[n % 10] : '');
  if (n < 1000) return 'mia ' + SW_ONES[Math.floor(n / 100)] + (n % 100 ? ' ' + swWords(n % 100) : '');
  if (n < 1e6) return 'elfu ' + swWords(Math.floor(n / 1000)) + (n % 1000 ? ' ' + swWords(n % 1000) : '');
  return String(n);
}

const digitsOneByOne = (s, base) =>
  s.replace(/\D/g, '').split('').map((d) => (base === 'sw' ? SW_ONES : EN_ONES)[+d]).join(' ');

export function numberToWords(text, base) {
  const m = text.trim().match(/^([\d,.:]+)\s?(am|pm)?$/i);
  if (!m) return text;
  const [, num, ampm] = m;
  const suffix = ampm ? (base === 'sw' ? ' ' + ampm.toLowerCase().split('').map((c) => LETTERS_SW[c]).join(' ') : ' ' + ampm.toLowerCase().split('').join(' ')) : '';
  // Long numbers (tokens, phone numbers, paybills) are read digit by digit.
  const plain = num.replace(/,/g, '');
  if (!/^\d+$/.test(plain) || plain.length > 4) return digitsOneByOne(num, base) + suffix;
  const n = parseInt(plain, 10);
  return (base === 'sw' ? swWords(n) : enWords(n)) + suffix;
}

// --- Acronyms (KPLC, KRA): letter names in the base voice's language ---------
const LETTERS_SW = { a: 'ei', b: 'bi', c: 'si', d: 'di', e: 'i', f: 'efu', g: 'ji', h: 'eichi', i: 'ai', j: 'jei',
  k: 'kei', l: 'eli', m: 'emu', n: 'eni', o: 'ou', p: 'pi', q: 'kyu', r: 'ara', s: 'esi', t: 'ti', u: 'yu',
  v: 'vi', w: 'dabliyu', x: 'eksi', y: 'wai', z: 'zedi' };

const isAcronym = (w) => /^[A-Z]{2,5}$/.test(w);
const spellAcronym = (w, base) =>
  w.toLowerCase().split('').map((c) => (base === 'sw' ? LETTERS_SW[c] : c.toUpperCase())).join(' ');

// --- Whole sentence --------------------------------------------------------
// cs: a code-switcher from createCodeSwitcher(); cmu: Map word -> "PH ON ES".
export function oneVoice(cs, cmu, text, base) {
  const tokens = cs.label(text);
  // A number next to another number ("1234 5678") is a token, phone or account
  // number: read every digit, never "one thousand two hundred...".
  const near = (i, step) => { let j = i + step; while (tokens[j]?.type === 'space') j += step; return tokens[j]; };
  return tokens.map((t, i) => {
    if (t.type === 'number') {
      const inGroup = near(i, -1)?.type === 'number' || near(i, 1)?.type === 'number';
      return inGroup ? digitsOneByOne(t.text, base) : numberToWords(t.text, base);
    }
    if (t.type !== 'word') return t.text;
    if (t.source !== 'lexicon' && isAcronym(t.text) && !cmu.has(t.text.toLowerCase())) return spellAcronym(t.text, base);
    const word = t.say || t.text;
    if (t.lang === base) return word;
    return word.split(/\s+/).map((w) =>
      base === 'en' ? swahiliForEnglishVoice(w) : englishForSwahiliVoice(w, cmu)).join(' ');
  }).join('');
}