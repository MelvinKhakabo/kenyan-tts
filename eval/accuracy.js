// Step 3: score the code-switcher against hand-labelled sentences.
// Run with `npm run eval`.
import { readFileSync } from 'node:fs';
import { createCodeSwitcher } from '../rules/codeswitch.js';
import { loadLexicon } from '../rules/load.js';

const cs = createCodeSwitcher(loadLexicon());

// Read "word/en word/sw ..." lines. Words without a label (numbers) are not scored.
const lines = readFileSync(new URL('./test-set.txt', import.meta.url), 'utf8')
  .split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));

let total = 0, ours = 0, allEnglish = 0, allSwahili = 0;
const errors = [];
const bySource = {};

for (const line of lines) {
  const gold = line.split(/\s+/).map((part) => {
    const m = part.match(/^(.+)\/(en|sw|x)$/);
    return m ? { word: m[1], lang: m[2] } : { word: part, lang: null };
  });
  const sentence = gold.map((g) => g.word).join(' ');
  const predicted = cs.label(sentence).filter((t) => t.type === 'word');

  // Match predicted words to labelled words in order.
  const labelled = gold.filter((g) => !/^\d/.test(g.word));
  labelled.forEach((g, i) => {
    const p = predicted[i];
    if (!p || g.lang === null || g.lang === 'x') return;
    total++;
    if (g.lang === 'en') allEnglish++;
    if (g.lang === 'sw') allSwahili++;
    const src = p.source.split(' ')[0];
    bySource[src] ??= { right: 0, wrong: 0 };
    if (p.lang === g.lang) { ours++; bySource[src].right++; }
    else { bySource[src].wrong++; errors.push(`  "${g.word}" should be ${g.lang}, got ${p.lang} (${p.source})  in: ${sentence}`); }
  });
}

const pct = (n) => ((100 * n) / total).toFixed(1) + '%';
console.log(`Words scored: ${total} in ${lines.length} sentences\n`);
console.log('Words given the right pronunciation:');
console.log(`  Our engine:                 ${pct(ours)}`);
console.log(`  TalkBack, English voice:    ${pct(allEnglish)}`);
console.log(`  TalkBack, Kiswahili voice:  ${pct(allSwahili)}\n`);
console.log('By decision rule:');
for (const [src, r] of Object.entries(bySource)) console.log(`  ${src.padEnd(10)} ${r.right} right, ${r.wrong} wrong`);
console.log(errors.length ? `\nMistakes (${errors.length}):\n` + errors.join('\n') : '\nNo mistakes.');