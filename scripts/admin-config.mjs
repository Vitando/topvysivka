#!/usr/bin/env node
// Administrace textů – jediné místo, kde jsou pole, popisky a LIMITY (max. délka, formát).
// Vygeneruje:
//  - .pages.yml               (Pages CMS: popisky, maxlength a kontrola formátu přímo při psaní)
//  - scripts/text-limits.json (pojistka v apply-texts.mjs: text přes limit se na web nepropíše)
// a seřadí content/texty.json podle pořadí polí. Hlídá, aby pole a JSON měly stejné klíče.
//
// Spuštění po úpravě:  node scripts/admin-config.mjs
// Limity jsou změřené v prohlížeči (375 / 1024 / 1440 px): delší text by přetekl nebo rozbil rozložení.

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const JSON_PATH = path.join(ROOT, 'content', 'texty.json');
const data = JSON.parse(readFileSync(JSON_PATH, 'utf8'));

// Kontroly formátu [regex, hláška]
const PHONE = ['^\\+?[0-9 ]{9,17}$', 'Zadejte telefon ve tvaru +420 734 395 056.'];
const PHONE_SHORT = ['^[0-9 ]{9,12}$', 'Zadejte telefon bez předvolby, např. 734 395 056.'];
const EMAIL = ['^[^@\\s]+@[^@\\s]+\\.[A-Za-z]{2,}$', 'Zadejte platný e-mail, např. info@topvysivka.cz.'];
const NUM = ['^[0-9]{1,5}$', 'Jen číslo – bez mezer, teček a jednotek.'];

const S = (name, label, max, o = {}) => ({ name, label, type: 'string', max, ...o });
const T = (name, label, max, o = {}) => ({ name, label, type: 'text', max, ...o });
const O = (name, label, fields, o = {}) => ({ name, label, type: 'object', fields, ...o });

const BIG = 'Velké písmo – krátce. Když se slovo nevejde, písmo se samo zmenší.';
const head = (stitek = 30) => [
  S('stitek', 'Štítek nad nadpisem', stitek),
  S('nadpis1', 'Nadpis – 1. řádek', 14, { description: BIG }),
  S('nadpis2', 'Nadpis – 2. řádek', 14, { description: BIG }),
];
const uvodSekce = (max = 200) => T('uvod', 'Úvodní text sekce', max);
const field = (name, label, napoveda = true) => O(name, `Pole „${label}“`, [
  S('popisek', 'Popisek pole', name === 'zprava' ? 40 : 28),
  ...(napoveda ? [S('napoveda', 'Nápověda v poli (šedý text)', name === 'zprava' ? 80 : 45)] : []),
]);
const karta = (name, label) => O(name, `Karta „${label}“`, [
  S('nadpis', 'Nadpis', 24), T('popis', 'Popis', 160), S('hlaska', 'Vtipná hláška', 60), S('tlacitko', 'Tlačítko', 28),
]);
const nt = (name, label, text = 140) => O(name, label, [S('nadpis', 'Nadpis', 40), T('text', 'Text', text)]);

const spec = [
  O('seo', 'Google a sdílení odkazu – NENÍ VIDĚT NA STRÁNCE', [
    S('titulek', 'Titulek v Googlu a v záložce prohlížeče', 90),
    T('popis', 'Popis ve výsledcích Googlu', 200),
    S('sdileni_nadpis', 'Nadpis v náhledu odkazu (Facebook, WhatsApp…)', 90),
    T('sdileni_popis', 'Popis v náhledu odkazu', 200),
  ], { description: 'Tyto texty na webu neuvidíte. Zobrazí se jen ve výsledcích Googlu a když někdo pošle odkaz na web.' }),
  O('menu', 'Menu a logo', [
    S('logo', 'Název vedle loga', 20),
    S('sluzby', 'Položka „Služby“', 10), S('jak', 'Položka „Jak to funguje“', 18), S('reference', 'Položka „Reference“', 13),
    S('faq', 'Položka „FAQ“', 8), S('kontakt', 'Položka „Kontakt“', 11),
    S('tlacitko', 'Tlačítko v hlavičce', 20),
  ], { description: 'Platí pro horní menu, mobilní menu i menu v patičce. Položky musí být krátké, jinak se menu nevejde.' }),
  O('uvod', 'Úvod (horní část stránky)', [
    S('stitek', 'Štítek nad nadpisem', 45),
    T('podtitul', 'Podtitul vedle štítku (jen na počítači)', 110),
    S('nadpis1', 'Velký nadpis – 1. řádek', 10, { description: 'Jedno krátké slovo. Nadpis se sám roztáhne přes celou šířku.' }),
    S('nadpis2', 'Velký nadpis – 2. řádek', 10, { description: 'Jedno krátké slovo. Nadpis se sám roztáhne přes celou šířku.' }),
    S('nadpis3', 'Pokračování nadpisu (podtržený text)', 30),
    T('text', 'Hlavní text', 220),
    S('tlacitko1', 'Hlavní tlačítko', 28), S('tlacitko2', 'Druhé tlačítko', 28),
    S('poznamka', 'Poznámka pod tlačítky', 90),
    S('foto_stitek', 'Štítek na fotce', 30),
  ]),
  O('pasky', 'Běžící pásy s textem', [
    S('horni1', 'Horní pás – 1. text', 30), S('horni2', 'Horní pás – 2. text', 30), S('horni3', 'Horní pás – 3. text', 30), S('horni4', 'Horní pás – 4. text', 30),
    S('dolni1', 'Dolní pás – 1. text', 30), S('dolni2', 'Dolní pás – 2. text', 30), S('dolni3', 'Dolní pás – 3. text', 30), S('dolni4', 'Dolní pás – 4. text', 30),
  ], { description: 'Dva pruhy s pohyblivým textem pod úvodem.' }),
  O('zaruky', 'Záruky (čtyři výhody pod úvodem)', [nt('zaruka1', '1. záruka'), nt('zaruka2', '2. záruka'), nt('zaruka3', '3. záruka'), nt('zaruka4', '4. záruka')]),
  O('sluzby', 'Služby', [...head(), uvodSekce(), karta('nasivky', 'Nášivky'), karta('vysivky', 'Výšivky'), karta('textil', 'Reklamní textil')]),
  O('jak', 'Jak to funguje', [...head(), uvodSekce(), nt('krok1', '1. krok'), nt('krok2', '2. krok'), nt('krok3', '3. krok'), nt('krok4', '4. krok'), S('bublina', 'Bublina u maskota', 28)]),
  O('instagram', 'Instagram (Čerstvě vyšito)', [
    S('stitek', 'Štítek nad nadpisem', 30),
    S('nadpis1', 'Nadpis – 1. řádek', 12, { description: BIG }), S('nadpis2', 'Nadpis – 2. řádek', 12, { description: BIG }),
    T('uvod', 'Úvodní text sekce', 200, { description: 'Fotky se načítají z Instagramu automaticky, tady jdou upravit jen texty.' }),
    S('tlacitko', 'Tlačítko pod fotkami', 28),
  ]),
  O('reference', 'Reference (loga zákazníků)', [
    S('stitek', 'Štítek nad nadpisem', 30), S('nadpis', 'Nadpis', 30, { description: BIG }),
    T('seznam', 'Seznam zákazníků – NENÍ VIDĚT', 400, { description: 'Na stránce není vidět, čte ho Google a čtečky pro nevidomé. Loga se tu měnit nedají.' }),
  ]),
  O('technika', 'Technická karta (Stroj & nitě)', [
    ...head(), uvodSekce(),
    S('civky', 'Popisek pod cívkami', 50),
    S('stroj', 'Značka stroje', 10), S('stroj_popis', 'Popis stroje', 30),
    S('plocha_sirka', 'Vyšívací plocha – šířka', 5, { pattern: NUM }), S('plocha_vyska', 'Vyšívací plocha – výška', 5, { pattern: NUM }), S('plocha_popis', 'Popisek pod plochou', 30),
    S('barvy', 'Počet barev', 5, { pattern: NUM }), S('barvy_popis', 'Popisek pod počtem barev', 30),
    S('rychlost', 'Rychlost (stehů za minutu)', 5, { pattern: NUM }), S('rychlost_popis', 'Popisek pod rychlostí', 30),
    O('parametr1', '1. parametr', [S('nazev', 'Název', 28), S('hodnota', 'Hodnota', 28)]),
    O('parametr2', '2. parametr', [S('nazev', 'Název', 28), S('hodnota', 'Hodnota', 28)]),
    O('parametr3', '3. parametr', [S('nazev', 'Název', 28), S('hodnota', 'Hodnota', 28)]),
  ]),
  O('faq_sekce', 'Časté dotazy – nadpis a úvod', [
    ...head(),
    S('uvod_pred', 'Úvodní věta – část před telefonem', 60, { description: 'Telefon se bere z Kontaktu (1. telefon).' }),
    S('uvod_za', 'Úvodní věta – část za telefonem', 60),
  ]),
  'FAQ',
  O('poptavka', 'Poptávkový formulář', [
    ...head(),
    T('uvod', 'Úvodní text', 200),
    S('bod1', '1. odrážka', 40), S('bod2', '2. odrážka', 40),
    S('bod3', '3. odrážka (před telefonem)', 25, { description: 'Telefon se bere z Kontaktu (1. telefon – krátký tvar).' }),
    field('jmeno', 'Jméno'), field('email', 'E-mail'), field('telefon', 'Telefon'), field('pocet', 'Počet kusů'),
    S('typ_nadpis', 'Otázka nad výběrem typu', 40),
    S('typ1', '1. možnost', 18, { description: 'Stejný text se použije i v kartě „Nášivky“ (tlačítko předvybere tuto možnost).' }),
    S('typ2', '2. možnost', 18, { description: 'Stejný text se použije i v kartě „Výšivky“.' }),
    S('typ3', '3. možnost', 18, { description: 'Stejný text se použije i v kartě „Reklamní textil“.' }),
    S('typ4', '4. možnost', 18),
    field('rozmer', 'Rozměr'), field('umisteni', 'Umístění'), field('material', 'Materiál'), field('termin', 'Termín', false),
    S('vlastni_textil', 'Zaškrtávací políčko „vlastní textil“', 60),
    S('prilohy', 'Popisek příloh', 20),
    S('prilohy_info', 'Info o povolených souborech', 70, { description: 'Povolené formáty a velikost hlídá web sám, změna textu je nezmění.' }),
    S('nahrani_nadpis', 'Pole pro nahrání – nadpis', 50), S('nahrani_text', 'Pole pro nahrání – text', 90),
    field('zprava', 'Zpráva'),
    S('souhlas_pred', 'Souhlas – text před odkazem', 40), S('souhlas_odkaz', 'Souhlas – text odkazu', 40), S('souhlas_za', 'Souhlas – text za odkazem', 40),
    S('tlacitko', 'Tlačítko pro odeslání', 28), S('pod_tlacitkem', 'Text pod tlačítkem', 70),
    S('hotovo_nadpis', 'Po odeslání – nadpis', 40), T('hotovo_text', 'Po odeslání – text', 160), S('hotovo_tlacitko', 'Po odeslání – tlačítko', 28),
  ]),
  O('kontakt', 'Kontakt', [
    ...head(), uvodSekce(),
    S('telefon_nadpis', 'Nadpis „Telefon“', 30),
    S('telefon1', '1. telefon', 17, { pattern: PHONE, description: 'Změní se všude na webu včetně odkazu pro volání.' }),
    S('telefon1_kratky', '1. telefon – krátký tvar', 12, { pattern: PHONE_SHORT, description: 'Zobrazí se u formuláře.' }),
    S('telefon2', '2. telefon', 17, { pattern: PHONE, description: 'Změní se všude na webu včetně odkazu pro volání.' }),
    S('email_nadpis', 'Nadpis „E-mail“', 30),
    S('email', 'E-mail', 40, { pattern: EMAIL, description: 'Změní se všude na webu včetně odkazu.' }),
    S('adresa_nadpis', 'Nadpis „Adresa“', 30),
    S('adresa_ulice', 'Ulice a číslo', 30, { description: 'Podle ulice a města se nastaví i odkazy do Google Map.' }),
    S('adresa_mesto', 'PSČ a město', 40),
    S('mapa_stitek', 'Adresa na mapě (krátce)', 40), S('navigovat', 'Tlačítko „Navigovat“', 20),
    S('doba_nadpis', 'Nadpis „Otevírací doba“', 30), S('doba', 'Otevírací doba', 20), S('doba_poznamka', 'Poznámka k otevírací době', 40),
    S('fakturace_nadpis', 'Nadpis „Fakturační údaje“', 30), S('firma', 'Název firmy', 50), S('ico_dic', 'IČ a DIČ', 50),
  ]),
  O('paticka', 'Patička', [
    T('popis', 'Text pod logem', 140),
    S('menu_nadpis', 'Nadpis „Menu“', 16), S('kontakt_nadpis', 'Nadpis „Kontakt“', 16),
    S('adresa', 'Adresa v patičce', 50),
    S('sledujte', 'Nadpis „Sledujte nás“', 16),
    S('rozlouceni', 'Velký text na konci', 14, { description: BIG }),
    S('copyright', 'Řádek s copyrightem', 90),
    S('zasady', 'Text „Zásady ochrany osobních údajů“', 40),
    S('cookies', 'Text „Nastavení cookies“', 25, { description: 'Odkaz je vidět jen tehdy, když web používá měření (Google Analytics / Meta Pixel).' }),
  ]),
  O('cookies', 'Cookie lišta', [
    S('nadpis', 'Nadpis', 40), T('text', 'Text', 300), S('odkaz', 'Odkaz na zásady', 25),
    S('odmitnout', 'Tlačítko „Odmítnout vše“', 16), S('prijmout', 'Tlačítko „Přijmout vše“', 16),
    S('nastaveni', 'Odkaz „Nastavení“', 20), S('ulozit', 'Tlačítko „Uložit výběr“', 20),
    S('nezbytne_nazev', 'Nezbytné – název', 20), T('nezbytne_popis', 'Nezbytné – popis', 160),
    S('analyticke_nazev', 'Analytické – název', 20), T('analyticke_popis', 'Analytické – popis', 160),
    S('marketingove_nazev', 'Marketingové – název', 20), T('marketingove_popis', 'Marketingové – popis', 160),
  ], { description: 'Lišta se ukáže jen tehdy, když web používá měření. Odmítnutí musí zůstat stejně snadné jako přijetí.' }),
];

const FAQ_FIELDS = [S('otazka', 'Otázka', 90), T('odpoved', 'Odpověď', 400)];
const FAQ_MAX = 15;

// --- kontrola klíčů a seřazení JSON ---
function order(fields, obj, p) {
  const out = {};
  for (const f of fields) {
    if (!(f.name in obj)) throw new Error(`v content/texty.json chybí ${p}${f.name}`);
    out[f.name] = f.type === 'object' ? order(f.fields, obj[f.name], `${p}${f.name}.`) : obj[f.name];
  }
  const extra = Object.keys(obj).filter((k) => !fields.some((f) => f.name === k));
  if (extra.length) throw new Error(`v content/texty.json navíc ${p}${extra.join(', ')}`);
  return out;
}
const sorted = {};
for (const f of spec) {
  if (f === 'FAQ') sorted.faq = data.faq;
  else sorted[f.name] = order(f.fields, data[f.name], f.name + '.');
}
const extra = Object.keys(data).filter((k) => !(k in sorted));
if (extra.length) throw new Error('v content/texty.json navíc ' + extra.join(', '));

// --- limity pro apply-texts.mjs ---
const limits = {};
const walk = (fields, p) => fields.forEach((f) => {
  if (f.type === 'object') walk(f.fields, `${p}${f.name}.`);
  else limits[p + f.name] = f.pattern ? { max: f.max, pattern: f.pattern[0] } : { max: f.max };
});
spec.forEach((f) => (f === 'FAQ' ? null : walk(f.fields, f.name + '.')));
walk(FAQ_FIELDS, 'faq[].');
limits['faq[]'] = { max: FAQ_MAX };

// --- YAML pro Pages CMS ---
const q = (s) => JSON.stringify(s);
const lines = [];
function emit(f, ind) {
  const p = ' '.repeat(ind);
  lines.push(`${p}- name: ${f.name}`, `${p}  label: ${q(f.label)}`);
  const desc = f.type === 'object' ? f.description : [f.description, `Max. ${f.max} znaků.`].filter(Boolean).join(' ');
  if (desc) lines.push(`${p}  description: ${q(desc)}`);
  lines.push(`${p}  type: ${f.type}`);
  if (f.type === 'object') {
    lines.push(`${p}  fields:`);
    f.fields.forEach((x) => emit(x, ind + 4));
    return;
  }
  lines.push(`${p}  required: true`);
  if (f.pattern) lines.push(`${p}  pattern:`, `${p}    regex: ${q(f.pattern[0])}`, `${p}    message: ${q(f.pattern[1])}`);
  lines.push(`${p}  options:`, `${p}    maxlength: ${f.max}`);
}
for (const f of spec) {
  lines.push('');
  if (f !== 'FAQ') { emit(f, 6); continue; }
  lines.push(
    '      - name: faq',
    `        label: ${q('Časté dotazy – otázky a odpovědi')}`,
    `        description: ${q(`Otázky můžete přidávat (max. ${FAQ_MAX}), mazat i přesouvat. První otázka je na webu rozbalená.`)}`,
    '        type: object',
    '        list:',
    '          min: 1',
    `          max: ${FAQ_MAX}`,
    '          collapsible:',
    '            collapsed: true',
    '            summary: "{index}. {otazka}"',
    '        fields:',
  );
  FAQ_FIELDS.forEach((x) => emit(x, 10));
}

const yml = `# Administrace textů – Pages CMS (https://pagescms.org)
# NEUPRAVOVAT RUČNĚ – generuje scripts/admin-config.mjs (tam jsou popisky i limity polí).
# Upravuje jen content/texty.json; do index.html je promítne GitHub Action .github/workflows/texts.yml.

content:
  - name: texty
    label: Texty webu
    type: file
    path: content/texty.json
    format: json
    fields:${lines.join('\n')}
`;

writeFileSync(path.join(ROOT, '.pages.yml'), yml);
writeFileSync(path.join(ROOT, 'scripts', 'text-limits.json'), JSON.stringify(limits, null, 2) + '\n');
writeFileSync(JSON_PATH, JSON.stringify(sorted, null, 2) + '\n');

// aktuální texty musí limity splňovat, jinak by je administrace nešla uložit
const bad = [];
const check = (key, val, lim) => {
  if (typeof val !== 'string') return;
  if ([...val].length > lim.max) bad.push(`${key} (${[...val].length} > ${lim.max})`);
  if (lim.pattern && !new RegExp(lim.pattern).test(val)) bad.push(`${key} (formát)`);
};
for (const [key, lim] of Object.entries(limits)) {
  if (key.startsWith('faq[]')) continue;
  check(key, key.split('.').reduce((o, k) => o && o[k], sorted), lim);
}
sorted.faq.forEach((x, i) => FAQ_FIELDS.forEach((f) => check(`faq[${i}].${f.name}`, x[f.name], limits[`faq[].${f.name}`])));
if (sorted.faq.length > FAQ_MAX) bad.push(`faq (${sorted.faq.length} > ${FAQ_MAX})`);
if (bad.length) { console.error('Současné texty porušují limity:\n  ' + bad.join('\n  ')); process.exit(1); }
console.log(`Hotovo: .pages.yml (${Object.keys(limits).length} pravidel), scripts/text-limits.json, content/texty.json.`);
