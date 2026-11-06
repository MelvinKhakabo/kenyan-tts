// Step 1 demo: run with `npm run demo`.
// Uses the real word lists and lexicon from Step 2.
import { createCodeSwitcher } from './codeswitch.js';
import { loadLexicon } from './load.js';

const { english, swahili, lexicon } = loadLexicon();

const cs = createCodeSwitcher({ english, swahili, lexicon });

const sentences = [
  'Niko kwa stage, tuma doh before 5pm manze.',
  'Customer care: tuma doh kwa M-Pesa before 5pm, si utapata receipt mara moja.',
  'Tafadhali come to the meeting kesho, mama.',
  'Hii ni rada safi, kudhokoma ni noma.',
  'Sasa msee, uko poa? Nimefika town, nitakuja na fare.',
  'Your KPLC token ni 1234 5678, asante for using our service.',
];

for (const s of sentences) {
  console.log('\n' + s);
  for (const t of cs.label(s).filter((t) => t.type === 'word')) {
    console.log(`  ${t.text.padEnd(12)} ${t.lang}  (${t.source}${t.say ? ', say "' + t.say + '"' : ''})`);
  }
  console.log('  Spoken as:', cs.segments(s).map((r) => `[${r.lang}] ${r.text}`).join('  '));
}