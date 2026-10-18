# Top výšivka – web (topvysivka.cz)

Statický one-page web: čisté HTML + CSS + JavaScript, bez build kroku.

## Spuštění

- Stačí otevřít `index.html` v prohlížeči.
- Lepší je lokální server (kvůli fontům a 3D):
  `npx serve .` nebo `python3 -m http.server 8000` → http://localhost:8000
- Nasazení: **Cloudflare Workers** (statický web) napojené na GitHub (každý push do `main` = nové nasazení).
  Build command `node scripts/build-site.mjs`, Deploy command `npx wrangler deploy` (nastavení ve `wrangler.jsonc`)
  – na web jde jen `index.html`, `zasady.html`, `assets/` a `_headers`. Přechodně běží i Vercel (`vercel.json`, `.vercelignore`), po přesunu domény ho smazat.

## Struktura

```
index.html                 obsah celé stránky
assets/css/style.css       veškerý vzhled (barvy v :root u .tv – proměnné --yellow, --pink, --sky, --mint, --ink…)
assets/js/main.js          animace (GSAP), 3D nášivka a cívky (Three.js), nit při scrollu, menu, FAQ, formulář
assets/js/vendor/          GSAP 3.13 + ScrollTrigger, Three.js r158
assets/js/consent.js       cookie lišta, měření (GA4 / Meta Pixel) až po souhlasu
assets/fonts/              písma (Anton, DM Sans, Baloo 2) hostovaná u nás, bez Google Fonts
zasady.html                zásady ochrany osobních údajů
_headers                   bezpečnostní hlavičky pro Cloudflare (CSP, HSTS…)
wrangler.jsonc             nastavení Cloudflare Workers (web = složka dist/, /api/* = src/worker.js)
src/worker.js              příjem poptávek z formuláře a odeslání e-mailem (Resend)
scripts/build-site.mjs     sestaví dist/ pro Cloudflare
vercel.json                totéž pro Vercel (dočasně, do přesunu na Cloudflare)
assets/img/                fotka do úvodu, práce (Instagram), loga zákazníků
```

## Co je potřeba doplnit před spuštěním

1. **Odesílání formuláře** – `assets/js/main.js` posílá poptávku na `/api/poptavka`; zpracuje ji Cloudflare Worker
   `src/worker.js` (kontrola polí a příloh, anti-spam) a pošle ji přes **Resend** na `FORM_TO` (info@topvysivka.cz)
   i s přílohami, s „Odpovědět“ rovnou zákazníkovi; zákazníkovi přijde potvrzení (`FORM_CONFIRM`).
   Nastavení: `vars` ve `wrangler.jsonc`; klíč **`RESEND_API_KEY` jako Secret** v Cloudflare (Settings → Variables and Secrets).
   Odesílatel `FORM_FROM` musí být na doméně ověřené v Resendu (DNS záznamy z Resendu přidat v Cloudflare).
   Limity: soubory AI/PDF/SVG/PNG/JPG, max. 10 MB/soubor, 25 MB a 10 souborů celkem.
   Formulář posílá: jmeno, email, telefon, pocet, typ, rozmer, umisteni, material, termin, vlastni_textil, prilohy[], zprava, souhlas.
   Pole `web` je skrytá past na spamboty – na serveru zahodit zprávy, kde je vyplněné.
2. **Zásady ochrany osobních údajů** jsou v `zasady.html` (text nechat zkontrolovat klientem).
3. **Instagram** – galerie (mřížka 3×3, 9 posledních příspěvků) se plní automaticky z Behold.so feedu.
   - Stažené příspěvky si pamatuje v `assets/img/instagram/posts.json`: nový post se přidá nahoru, nejstarší vypadne.
     Na mobilu (2 sloupce) se ukazuje 8 fotek.
   - Skript `scripts/sync-instagram.mjs` stáhne příspěvky, fotky uloží do `assets/img/instagram/`
     a přepíše karty v `index.html` mezi `<!-- INSTAGRAM:START -->` a `<!-- INSTAGRAM:END -->`.
   - GitHub Action `.github/workflows/instagram.yml` ho spouští každý den (~6:17) a změny sama commitne.
     Ručně: záložka Actions → „Instagram galerie" → Run workflow, nebo lokálně `node scripts/sync-instagram.mjs`.
   - Když feed selže, web dál ukazuje poslední fotky.
   - Feed klienta: v GitHubu Settings → Secrets and variables → Actions → Variables přidat `BEHOLD_FEED_URL`
     (nebo přepsat výchozí URL na začátku skriptu).
4. **Mapa** – v kontaktu je kreslená mapa s odkazem do Google Map. Pokud chcete živou mapu,
   vložte `<iframe>` z Google Maps do `.tv-map` místo `<svg class="tv-map__roads">`.
5. Favicon a sdílecí obrázek (`og:image`) – teď se používá fotka z úvodu.

## Úpravy textů (administrace)

Texty webu může klient upravovat sám přes [Pages CMS](https://app.pagescms.org) – bez znalosti HTML a bez GitHub účtu
(je pozvaný e-mailem jako collaborator). Design ani rozložení stránky se z administrace změnit nedá.

- **Kde jsou texty:** `content/texty.json`. Pole, popisky a limity se definují ve `scripts/admin-config.mjs`;
  `node scripts/admin-config.mjs` z nich vygeneruje `.pages.yml` a `scripts/text-limits.json` (oba ručně neupravovat).
- **Jak se dostanou na web:** uložení v administraci = commit `content/texty.json` → GitHub Action
  `.github/workflows/texts.yml` spustí `scripts/apply-texts.mjs`, ten přepíše texty v `index.html` a commitne je →
  Cloudflare web nasadí. Trvá to zhruba 1–2 minuty; pak stránku obnovit (Cmd+Shift+R).
  Texty v sekci „Google a sdílení odkazu“ na stránce vidět nejsou (jen v Googlu a v náhledu odkazu).
- **Blbuvzdornost:** každé pole má maximální délku (změřenou v prohlížeči na mobilu i desktopu) a telefony, e-mail
  a čísla kontrolu formátu – Pages CMS delší / špatný text nedovolí uložit. Pojistka v `apply-texts.mjs`: text přes limit
  se na web nepropíše (zůstane původní) a GitHub Actions ukáže varování. Velké nadpisy se při dlouhém slově samy
  zmenší (`fitLines` v `main.js`). Texty se escapují, takže přes administraci nejde vložit kód.
- **Když se něco pokazí:** každé uložení je commit na GitHubu, jakoukoli změnu jde vrátit (Revert).
- **Značky v `index.html`:** každý upravitelný text je obalený `<!--t:klic-->text<!--/t-->` (klíč = cesta v JSON,
  např. `sluzby.nasivky.popis`). Stejný klíč může být na stránce víckrát (menu, telefony, běžící pásy).
  FAQ se generuje celé mezi `<!--faq:start-->` a `<!--faq:end-->`, `<title>` podle `seo.titulek`.
  Značky nemazat; text mezi nimi při ruční úpravě HTML přepíše další uložení v administraci.
- **Atributy:** tag s `data-t="atribut=zdroj;…"` dostane hodnotu atributu z JSON (placeholdery, hodnoty voleb
  ve formuláři, `data-count` čísel, meta popisy). Zdroj `tel:klic` / `mailto:klic` udělá odkaz na telefon / e-mail,
  `@mapa` a `@trasa` odkaz do Google Map z `kontakt.adresa_ulice` + `kontakt.adresa_mesto`.
- **Co upravit jde:** všechny texty na stránce – SEO popisky, menu, nadpisy, tlačítka, běžící pásy, služby, kroky,
  technická karta, FAQ (otázky lze přidávat, mazat a přesouvat), celý formulář, kontakty a patička.
- **Co ne:** fotky a loga, karty Instagram galerie (plní se samy), odkazy na Instagram/Facebook/vzorník/zásady,
  chybové hlášky formuláře v `assets/js/main.js`.
- Texty se escapují jako HTML (žádné tagy). Chybějící nebo prázdný text = na webu zůstane původní.
- **Nový upravitelný text:** obalit ho v `index.html` značkami, přidat klíč do `content/texty.json`
  a pole do `.pages.yml`.
- Ručně: `node scripts/apply-texts.mjs` (když se nic nezměnilo, `index.html` nepřepíše).
- `texts.yml` i `instagram.yml` sdílí `concurrency: site-content` a před pushem dělají `git pull --rebase`,
  takže se navzájem nepřepisují.

## Bezpečnost a cookies

- **Bez souhlasu se nic nesleduje.** Web sám neukládá žádné cookies a nenačítá nic z cizích serverů
  (písma, obrázky i knihovny jsou u nás). Jediné, co si pamatuje, je volba z cookie lišty (`localStorage`, `tv-consent`).
- **Měření zapnout:** v `assets/js/consent.js` nahoře vyplnit `GA4_ID` (Google Analytics 4) a/nebo `META_PIXEL_ID`.
  Teprve pak se ukáže cookie lišta a odkaz „Nastavení cookies“ v patičce. Skripty se načtou až po souhlasu
  (Google Consent Mode v2, základní režim), po odvolání se cookies měření smažou.
- **Pravidla lišty** (§ 89 zákona č. 127/2005 Sb., GDPR, doporučení ÚOOÚ a EDPB): odmítnutí je stejně snadné jako přijetí
  (stejná tlačítka v první vrstvě), nic není předem zaškrtnuté, volba platí 6 měsíců, souhlas jde kdykoli změnit.
  Přidání dalšího nástroje = zvýšit `CONSENT_VERSION`, doplnit ho do lišty a do `zasady.html`.
- **Bezpečnostní hlavičky** jsou v `_headers` (Cloudflare) a dočasně i ve `vercel.json` (Content-Security-Policy, HSTS, X-Frame-Options, Referrer-Policy,
  Permissions-Policy, nosniff). CSP povoluje jen náš web, Google Analytics, Meta Pixel a služby formuláře
  vlastní `/api/poptavka`. **Jiný měřicí nástroj nebo externí služba = přidat jeho doménu do CSP**, jinak ho prohlížeč zablokuje.
- Na web se nasazuje jen složka `dist/` (README, administrace, skripty ani `content/` na webu nejsou).
  Dočasné adresy `*.workers.dev` mají `X-Robots-Tag: noindex`, aby je Google neindexoval.
- Texty z administrace se do HTML vkládají escapované, takže přes ně nejde vložit kód.

## Poznámky

- Animace respektují nastavení „omezit pohyb“ v systému.
- GSAP je od verze 3.13 zdarma i pro komerční použití, Three.js je pod licencí MIT.
- Nit vlevo/vpravo se počítá z pozic sekcí – při přidání nové `<section>` do `.tv-main` se přizpůsobí sama.
- Velké nadpisy v úvodu se automaticky roztáhnou přes celou šířku (funkce `fitTitle` v main.js).
