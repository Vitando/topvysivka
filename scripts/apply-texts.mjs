#!/usr/bin/env node
// Texty webu z administrace (Pages CMS) pro topvysivka.cz
// Načte content/texty.json a v index.html přepíše:
//  - obsah mezi značkami <!--t:klic-->…<!--/t--> (klíč = cesta v JSON, např. sluzby.nasivky.popis),
//  - FAQ mezi <!--faq:start--> a <!--faq:end--> (vygeneruje ze seznamu "faq").
// Texty se escapují jako HTML. Chybějící nebo prázdný klíč = zůstane původní text.
// Když se nic nezměnilo, index.html se nepřepisuje.
//
// Spuštění ručně:  node scripts/apply-texts.mjs

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HTML_PATH = path.join(ROOT, 'index.html');
const JSON_PATH = path.join(ROOT, 'content', 'texty.json');
const FAQ_START = '<!--faq:start-->';
const FAQ_END = '<!--faq:end-->';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Text z administrace: řetězec bez okrajových mezer a zalomení řádků, jinak null
const textOf = (v) => {
  if (typeof v !== 'string') return null;
  const t = v.replace(/[ \t\r\n]+/g, ' ').trim(); // pevné mezery (&nbsp;) zůstávají
  return t || null;
};

const lookup = (data, key) => key.split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), data);

const FAQ_ICON = '<span class="tv-qa__icon" aria-hidden="true"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"></path></svg></span>';

// Stejná šablona jako ruční FAQ; první otázka otevřená, ostatní zavřené (akordeon v assets/js/main.js)
function faqItem(q, a, i) {
  const open = i === 0;
  return `<div class="tv-qa${open ? ' tv-qa--open' : ''}"><h3><button class="tv-qa__btn" type="button" id="tv-faq-b${i}" aria-controls="tv-faq-p${i}" aria-expanded="${open}"><span>${esc(q)}</span>${FAQ_ICON}</button></h3>` +
    `<div class="tv-qa__a" id="tv-faq-p${i}" role="region" aria-labelledby="tv-faq-b${i}"${open ? '' : ' hidden'}>${esc(a)}</div></div>`;
}

async function main() {
  const data = JSON.parse(await readFile(JSON_PATH, 'utf8'));
  const html = await readFile(HTML_PATH, 'utf8');
  const missing = [];

  let next = html.replace(/<!--t:([\w.-]+)-->([\s\S]*?)<!--\/t-->/g, (whole, key) => {
    const t = textOf(lookup(data, key));
    if (t === null) { missing.push(key); return whole; }
    return `<!--t:${key}-->${esc(t)}<!--/t-->`;
  });

  if (Array.isArray(data.faq)) {
    const a = next.indexOf(FAQ_START);
    const b = next.indexOf(FAQ_END);
    if (a < 0 || b < a) throw new Error('v index.html chybí značky faq:start / faq:end');
    const items = data.faq
      .map((x) => [textOf(x && x.otazka), textOf(x && x.odpoved)])
      .filter(([q, ans]) => q && ans)
      .map(([q, ans], i) => '          ' + faqItem(q, ans, i));
    if (items.length) {
      next = next.slice(0, a) + `${FAQ_START}\n${items.join('\n')}\n        ` + next.slice(b);
    } else {
      missing.push('faq');
    }
  } else {
    missing.push('faq');
  }

  if (missing.length) console.log(`Beze změny (chybí v texty.json): ${missing.join(', ')}`);

  if (next !== html) {
    await writeFile(HTML_PATH, next);
    console.log('Texty aktualizovány.');
  } else {
    console.log('Texty beze změny.');
  }
}

main().catch((err) => {
  console.error('Úprava textů selhala:', err.message, '(index.html zůstal beze změny)');
  process.exit(1);
});
