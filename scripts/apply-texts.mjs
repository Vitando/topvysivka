#!/usr/bin/env node
// Texty webu z administrace (Pages CMS) pro topvysivka.cz
// Načte content/texty.json a v index.html přepíše:
//  - obsah mezi značkami <!--t:klic-->…<!--/t--> (klíč = cesta v JSON, např. sluzby.nasivky.popis),
//  - FAQ mezi <!--faq:start--> a <!--faq:end--> (vygeneruje ze seznamu "faq"),
//  - <title> podle seo.titulek,
//  - atributy tagů s data-t="atribut=zdroj;…", kde zdroj je:
//      klic            hodnota klíče (placeholder, value, content, data-count…)
//      tel:klic        odkaz na telefon (tel:+420…, bez mezer)
//      mailto:klic     odkaz na e-mail
//      @mapa / @trasa  odkaz do Google Map na adresu kontakt.adresa_ulice + kontakt.adresa_mesto
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
const escAttr = (s) => esc(s).replace(/"/g, '&quot;');

// Text z administrace: řetězec bez okrajových mezer a zalomení řádků, jinak null
const textOf = (v) => {
  if (typeof v !== 'string') return null;
  const t = v.replace(/[ \t\r\n]+/g, ' ').trim(); // pevné mezery (&nbsp;) zůstávají
  return t || null;
};

const lookup = (data, key) => key.split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), data);

// Pojistka: text delší než limit nebo ve špatném formátu se nepropíše (na webu zůstane původní).
// Limity generuje scripts/admin-config.mjs (stejné hlídá i Pages CMS při psaní).
const LIMITS = JSON.parse(await readFile(path.join(ROOT, 'scripts', 'text-limits.json'), 'utf8'));
const rejected = [];
function allowed(key, t) {
  if (t === null) return null;
  const lim = LIMITS[key.replace(/^faq\[\d+\]/, 'faq[]')];
  if (!lim) return t;
  if ([...t].length > lim.max) { rejected.push(`${key}: ${[...t].length} znaků, max. ${lim.max}`); return null; }
  if (lim.pattern && !new RegExp(lim.pattern).test(t)) { rejected.push(`${key}: špatný formát („${t}“)`); return null; }
  return t;
}
const textAt = (data, key) => allowed(key, textOf(lookup(data, key)));

// Hodnota atributu podle zdroje z data-t, nebo null (atribut zůstane, jak je)
function attrValue(data, src) {
  if (src === '@mapa' || src === '@trasa') {
    const ulice = textAt(data, 'kontakt.adresa_ulice');
    const mesto = textAt(data, 'kontakt.adresa_mesto');
    if (!ulice || !mesto) return null;
    const adresa = `${ulice}, ${mesto}`;
    return src === '@mapa'
      ? 'https://www.google.com/maps/search/?api=1&' + new URLSearchParams({ query: adresa })
      : 'https://www.google.com/maps/dir/?api=1&' + new URLSearchParams({ destination: adresa });
  }
  const m = src.match(/^(tel:|mailto:)?(.+)$/);
  const v = textAt(data, m[2]);
  if (v === null) return null;
  if (m[1] === 'tel:') return 'tel:' + v.replace(/[^\d+]/g, '');
  if (m[1] === 'mailto:') return 'mailto:' + v;
  return v;
}

// Strukturované údaje o firmě pro Google (adresa, telefon, otevírací doba) – z kontaktů v administraci
const SITE = 'https://topvysivka.cz/';
function companyLd(data) {
  const g = (k) => textAt(data, k);
  const mesto = g('kontakt.adresa_mesto') || '';
  const psc = mesto.match(/^(\d{3}\s?\d{2})\s+(.+)$/);
  const tel = g('kontakt.telefon1');
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: g('menu.logo') || 'Top výšivka',
    legalName: g('kontakt.firma') || undefined,
    description: g('seo.popis') || undefined,
    url: SITE,
    image: SITE + 'assets/img/og-image.jpg',
    logo: SITE + 'assets/img/apple-touch-icon.png',
    telephone: tel ? tel.replace(/[^\d+]/g, '') : undefined,
    email: g('kontakt.email') || undefined,
    address: {
      '@type': 'PostalAddress',
      streetAddress: g('kontakt.adresa_ulice') || undefined,
      postalCode: psc ? psc[1].replace(/\s/g, '') : undefined,
      addressLocality: psc ? psc[2] : mesto || undefined,
      addressCountry: 'CZ',
    },
    sameAs: ['https://www.instagram.com/topvysivka.cz/', 'https://www.facebook.com/topvysivkacz/'],
  };
  // „Po–Pá 8–17“ → otevírací doba; jiný tvar textu se do Googlu neposílá (radši nic než špatně)
  const doba = (g('kontakt.doba') || '').match(/^Po\s*[–-]\s*Pá\s+(\d{1,2})(?::(\d{2}))?\s*[–-]\s*(\d{1,2})(?::(\d{2}))?$/);
  if (doba) {
    const t = (h, m) => `${h.padStart(2, '0')}:${m || '00'}`;
    ld.openingHoursSpecification = [{ '@type': 'OpeningHoursSpecification', dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], opens: t(doba[1], doba[2]), closes: t(doba[3], doba[4]) }];
  }
  return JSON.stringify(ld).replace(/</g, '\\u003c'); // bezpečně uvnitř <script>
}

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
    const t = textAt(data, key);
    if (t === null) { missing.push(key); return whole; }
    return `<!--t:${key}-->${esc(t)}<!--/t-->`;
  });

  next = next.replace(/<[a-z][^<>]*\sdata-t="([^"]*)"[^<>]*>/g, (tag, spec) => {
    for (const part of spec.split(';')) {
      const [name, src] = part.split('=');
      const v = attrValue(data, src);
      if (v === null) { missing.push(src); continue; }
      tag = tag.replace(new RegExp(`(\\s${name}=")[^"]*"`), (_, pre) => `${pre}${escAttr(v)}"`);
    }
    return tag;
  });

  next = next.replace(/(<script type="application\/ld\+json" id="tv-ld">)[\s\S]*?(<\/script>)/, (_, a, b) => a + companyLd(data) + b);

  const title = textAt(data, 'seo.titulek');
  if (title === null) missing.push('seo.titulek');
  else next = next.replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`);

  if (Array.isArray(data.faq)) {
    const a = next.indexOf(FAQ_START);
    const b = next.indexOf(FAQ_END);
    if (a < 0 || b < a) throw new Error('v index.html chybí značky faq:start / faq:end');
    const items = data.faq
      .slice(0, LIMITS['faq[]'].max)
      .map((x, i) => [allowed(`faq[${i}].otazka`, textOf(x && x.otazka)), allowed(`faq[${i}].odpoved`, textOf(x && x.odpoved))])
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

  const rejectedKeys = new Set(rejected.map((r) => r.split(':')[0]));
  const absent = [...new Set(missing)].filter((k) => !rejectedKeys.has(k.replace(/^(tel|mailto):/, '')));
  if (absent.length) console.log(`Beze změny (chybí v texty.json): ${absent.join(', ')}`);
  // GitHub Actions ukáže varování u běhu workflow; text na webu zůstane původní
  for (const r of new Set(rejected)) console.log(`::warning title=Text z administrace se nepropsal::${r}`);

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
