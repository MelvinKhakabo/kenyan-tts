// Copies the lexicon into the Android app, so the app and the web page use
// exactly the same words. Run after any lexicon change: `npm run sync:android`
// kenyan.json is turned into kenyan.tsv (word, lang, say) so the app needs no JSON library.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const out = new URL('android/app/src/main/assets/lexicon/', root);
mkdirSync(out, { recursive: true });

for (const file of ['english.txt', 'swahili.txt', 'cmu.txt']) {
  copyFileSync(new URL('lexicon/' + file, root), new URL(file, out));
}

const words = JSON.parse(readFileSync(new URL('lexicon/kenyan.json', root), 'utf8')).words;
const tsv = Object.entries(words)
  .map(([word, e]) => [word.toLowerCase(), e.lang, e.say || ''].join('\t'))
  .join('\n') + '\n';
writeFileSync(new URL('kenyan.tsv', out), tsv);

console.log(`Copied english.txt, swahili.txt, cmu.txt and ${Object.keys(words).length} lexicon entries to android/app/src/main/assets/lexicon/`);
