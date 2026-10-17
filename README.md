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

## Poznámky

- Animace respektují nastavení „omezit pohyb“ v systému.
- GSAP je od verze 3.13 zdarma i pro komerční použití, Three.js je pod licencí MIT.
- Nit vlevo/vpravo se počítá z pozic sekcí – při přidání nové `<section>` do `.tv-main` se přizpůsobí sama.
- Velké nadpisy v úvodu se automaticky roztáhnou přes celou šířku (funkce `fitTitle` v main.js).
