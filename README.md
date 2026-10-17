# Top výšivka – web (topvysivka.cz)

Statický one-page web: čisté HTML + CSS + JavaScript, bez build kroku.

## Spuštění

- Stačí otevřít `index.html` v prohlížeči.
- Lepší je lokální server (kvůli fontům a 3D):
  `npx serve .` nebo `python3 -m http.server 8000` → http://localhost:8000
- Nasazení: nahrát celou složku na jakýkoli hosting (Wedos, Forpsi, Netlify, Vercel, GitHub Pages…).

## Struktura

```
index.html                 obsah celé stránky
assets/css/style.css       veškerý vzhled (barvy v :root u .tv – proměnné --yellow, --pink, --sky, --mint, --ink…)
assets/js/main.js          animace (GSAP), 3D nášivka a cívky (Three.js), nit při scrollu, menu, FAQ, formulář
assets/js/vendor/          GSAP 3.13 + ScrollTrigger, Three.js r158
assets/img/                fotka do úvodu, práce (Instagram), loga zákazníků
```

## Co je potřeba doplnit před spuštěním

1. **Odesílání formuláře** – v `assets/js/main.js` nahoře nastavit `FORM_ENDPOINT`
   (např. Formspree `https://formspree.io/f/…` nebo vlastní PHP skript). Bez něj formulář jen ukáže poděkování.
   Formulář posílá: jmeno, email, telefon, pocet, typ, rozmer, umisteni, material, termin, vlastni_textil, prilohy[], zprava, souhlas.
   Pole `web` je skrytá past na spamboty – na serveru zahodit zprávy, kde je vyplněné.
2. **Odkazy označené [DOPLNIT]** v `index.html`: vzorník barev, zásady ochrany osobních údajů, Facebook.
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

- **Kde jsou texty:** `content/texty.json`. Co se v administraci zobrazí a s jakými popisky, určuje `.pages.yml`.
- **Jak se dostanou na web:** uložení v administraci = commit `content/texty.json` → GitHub Action
  `.github/workflows/texts.yml` spustí `scripts/apply-texts.mjs`, ten přepíše texty v `index.html` a commitne je →
  Vercel web nasadí. Trvá to zhruba 1–2 minuty.
- **Značky v `index.html`:** každý upravitelný text je obalený `<!--t:klic-->text<!--/t-->` (klíč = cesta v JSON,
  např. `sluzby.nasivky.popis`). FAQ se generuje celé mezi `<!--faq:start-->` a `<!--faq:end-->`.
  Značky nemazat; text mezi nimi při ruční úpravě HTML přepíše další uložení v administraci.
- **Co upravit jde:** úvod (štítek, podtitul, hlavní text, poznámka), záruky, služby, kroky „Jak to funguje“,
  úvodní texty sekcí Instagram, Technická karta a Kontakt, a FAQ (otázky lze přidávat, mazat a přesouvat).
- **Co ne:** velký nadpis v úvodu, nadpisy sekcí, tlačítka, kontaktní údaje, FAQ věta s telefonem.
- Texty se escapují jako HTML (žádné tagy). Chybějící nebo prázdný text = na webu zůstane původní.
- **Nový upravitelný text:** obalit ho v `index.html` značkami, přidat klíč do `content/texty.json`
  a pole do `.pages.yml`.
- Ručně: `node scripts/apply-texts.mjs` (když se nic nezměnilo, `index.html` nepřepíše).
- `texts.yml` i `instagram.yml` sdílí `concurrency: site-content` a před pushem dělají `git pull --rebase`,
  takže se navzájem nepřepisují.

## Poznámky

- Animace respektují nastavení „omezit pohyb“ v systému.
- GSAP je od verze 3.13 zdarma i pro komerční použití, Three.js je pod licencí MIT.
- Nit vlevo/vpravo se počítá z pozic sekcí – při přidání nové `<section>` do `.tv-main` se přizpůsobí sama.
- Velké nadpisy v úvodu se automaticky roztáhnou přes celou šířku (funkce `fitTitle` v main.js).
