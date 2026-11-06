// Step 2: build clean word lists from the downloaded sources.
// Reads lexicon/sources/*, writes lexicon/english.txt, lexicon/swahili.txt
// and lexicon/cmu.txt. Run with `npm run build:lexicon`.
import { readFileSync, writeFileSync } from 'node:fs';

const here = new URL('./', import.meta.url);
const read = (name) => readFileSync(new URL('sources/' + name, here), 'utf8');
const onlyLetters = (w) => /^[a-z][a-z'-]*$/.test(w);

// English: top 30,000 words from the OpenSubtitles frequency list ("word count" per line).
// Lower ranks are mostly names and noise, which would steal Kiswahili-looking words.
const english = read('en_50k.txt').split(/\r?\n/)
  .map((line) => line.split(' ')[0].toLowerCase())
  .filter(onlyLetters)
  .slice(0, 30000);

// Kiswahili: the LibreOffice/Jambo spellchecker list. First line is a count;
// each entry may end in "/FLAGS" for the spellchecker, which we drop.
// Capitalised entries are names and places, kept out of the word list.
const swahili = read('sw_TZ.dic').split(/\r?\n/).slice(1)
  .map((line) => line.split('/')[0].trim())
  .filter((w) => w && w[0] === w[0].toLowerCase())
  .map((w) => w.toLowerCase())
  .filter(onlyLetters);

// A word in BOTH lists stays English only if it is a very common English word
// (top 3,000: to, me, ago). Rarer overlaps (ni, na, si, niko, mara) come from
// names and foreign words in subtitles, so they are left to Kiswahili.
const sw = new Set(swahili);
const englishKept = english.filter((w, rank) => !sw.has(w) || rank < 3000);

const unique = (list) => [...new Set(list)].sort();
writeFileSync(new URL('english.txt', here), unique(englishKept).join('\n') + '\n');
writeFileSync(new URL('swahili.txt', here), unique(swahili).join('\n') + '\n');

// CMUdict: English pronunciations, kept only for words in english.txt.
// "word PH ON ES" per line; alternative pronunciations like "word(2)" are dropped.
const keep = new Set(englishKept);
const cmu = read('cmudict.dict').split(/\r?\n/)
  .map((line) => line.split(' #')[0].trim())
  .filter((line) => line && !/^\S+\(\d\)/.test(line))
  .filter((line) => keep.has(line.split(' ')[0]));
writeFileSync(new URL('cmu.txt', here), cmu.join('\n') + '\n');
console.log(`cmu.txt: ${cmu.length} pronunciations`);

const en = new Set(englishKept);
const both = unique(swahili.filter((w) => en.has(w)));
console.log(`english.txt: ${unique(englishKept).length} words`);
console.log(`swahili.txt: ${unique(swahili).length} words`);
console.log(`in both lists (decided by neighbours): ${both.length}, e.g. ${both.slice(0, 15).join(', ')}`);