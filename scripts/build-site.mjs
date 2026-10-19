#!/usr/bin/env node
// Sestaví složku dist/ pro Cloudflare: jen soubory webu, bez README, administrace a skriptů.
// Cloudflare: Build command `node scripts/build-site.mjs`, Deploy command `npx wrangler deploy` (viz wrangler.jsonc).
//
// Spuštění ručně:  node scripts/build-site.mjs

import { rm, mkdir, cp, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'dist');
const SITE = ['index.html', 'zasady.html', 'obchodni-podminky.html', '404.html', 'robots.txt', 'sitemap.xml', 'favicon.ico', 'assets', '_headers'];

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT);
for (const item of SITE) {
  const from = path.join(ROOT, item);
  await access(from); // chybějící soubor = chyba buildu, ne poloviční web
  await cp(from, path.join(OUT, item), { recursive: true, filter: (src) => !/\.DS_Store$/.test(src) });
}
console.log(`Web připraven v dist/ (${SITE.join(', ')}).`);
