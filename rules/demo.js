// Step 1 demo: run with `npm run demo`.
// Uses tiny word lists for now; Step 2 replaces them with the real lexicon.
import { createCodeSwitcher } from './codeswitch.js';

const english = new Set(['customer', 'care', 'before', 'receipt', 'stage', 'send', 'money', 'the', 'is', 'at', 'meeting', 'tomorrow', 'please', 'come', 'mama', 'me', 'ok']);
const swahili = new Set(['niko', 'kwa', 'tuma', 'si', 'pata', 'mara', 'moja', 'hii', 'ni', 'safi', 'mama', 'kesho', 'kuja', 'tafadhali', 'leo', 'sana', 'na', 'wewe', 'enda', 'fika']);
const lexicon = new Map([
  ['doh', { lang: 'sw', say: 'doo' }],     // Sheng: money
  ['manze', { lang: 'sw' }],               // Sheng: man / dude
  ['m-pesa', { lang: 'sw', say: 'em pesa' }],
]);

const cs = createCodeSwitcher({ english, swahili, lexicon });

const sentences = [
  'Niko kwa stage, tuma doh before 5pm manze.',
  'Customer care: tuma doh kwa M-Pesa before 5pm, si utapata receipt mara moja.',
  'Tafadhali come to the meeting kesho, mama.',
  'Hii ni rada safi, kudhokoma ni noma.',
];

for (const s of sentences) {
  console.log('\n' + s);
  for (const t of cs.label(s).filter((t) => t.type === 'word')) {
    console.log(`  ${t.text.padEnd(12)} ${t.lang}  (${t.source}${t.say ? ', say "' + t.say + '"' : ''})`);
  }
  console.log('  Spoken as:', cs.segments(s).map((r) => `[${r.lang}] ${r.text}`).join('  '));
}