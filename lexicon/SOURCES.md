# Lexicon sources

Where every word list in this folder comes from, and its licence.

| File | Source | Licence |
|---|---|---|
| `sources/en_50k.txt` | FrequencyWords by Hermit Dave, built from OpenSubtitles 2018. https://github.com/hermitdave/FrequencyWords | CC BY-SA 4.0 |
| `sources/sw_TZ.dic` | Jambo Swahili spellchecker, from the LibreOffice dictionaries. Compiled from the Kamusi Project, the TUKI English-Swahili Dictionary, Egerton University word lists and An Crúbadán. https://github.com/LibreOffice/dictionaries/tree/master/sw_TZ | LGPL |
| `sources/README_sw_TZ.txt` | The original readme for the Swahili list, kept for credit | LGPL |
| `kenyan.json` | Our own lexicon: Sheng, names, brands and exceptions, written and checked by the team and our co-designer | Ours |

## Generated files

`english.txt` and `swahili.txt` are generated from the sources. Do not edit them by hand. To rebuild them, run:

    npm run build:lexicon

## How the lists are cleaned

- **English:** the 30,000 most frequent words, letters only. A word that is also in the Kiswahili list stays English only if it is in the top 3,000 English words (to, me, ago). Rarer overlaps (ni, na, si, niko, mara) come from names and foreign words in film subtitles, so they are left to Kiswahili.
- **Kiswahili:** every entry from the spellchecker list, with spellchecker flags removed and capitalised names and places left out.

## Adding words to kenyan.json

Every entry must be checked by a person, ideally our co-designer, before it is added. Each entry records the pronunciation rules to use (`lang`), an optional respelling (`say`), a note, and who added it (`by`).