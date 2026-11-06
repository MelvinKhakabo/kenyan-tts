// Loads the word lists and lexicon from disk (Node only).
// The web page and the Android app will load the same files in their own way.
import { readFileSync } from 'node:fs';

const lex = new URL('../lexicon/', import.meta.url);
const words = (name) => new Set(readFileSync(new URL(name, lex), 'utf8').split(/\r?\n/).filter(Boolean));

export function loadLexicon() {
  const english = words('english.txt');
  const swahili = words('swahili.txt');
  const entries = JSON.parse(readFileSync(new URL('kenyan.json', lex), 'utf8')).words;
  const lexicon = new Map(Object.entries(entries).map(([w, e]) => [w.toLowerCase(), e]));
  return { english, swahili, lexicon };
}