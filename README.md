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
3. **Instagram** – mřížka `.tv-ig__grid` (atribut `data-instagram-feed`) má zatím 8 ručně vybraných fotek.
   Napojení: Behold.so / Elfsight widget, nebo Instagram Graph API – stačí generovat stejné `<a class="tv-polaroid">` karty.
4. **Mapa** – v kontaktu je kreslená mapa s odkazem do Google Map. Pokud chcete živou mapu,
   vložte `<iframe>` z Google Maps do `.tv-map` místo `<svg class="tv-map__roads">`.
5. Favicon a sdílecí obrázek (`og:image`) – teď se používá fotka z úvodu.

## Poznámky

- Animace respektují nastavení „omezit pohyb“ v systému.
- GSAP je od verze 3.13 zdarma i pro komerční použití, Three.js je pod licencí MIT.
- Nit vlevo/vpravo se počítá z pozic sekcí – při přidání nové `<section>` do `.tv-main` se přizpůsobí sama.
- Velké nadpisy v úvodu se automaticky roztáhnou přes celou šířku (funkce `fitTitle` v main.js).
