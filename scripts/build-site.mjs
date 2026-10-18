#!/usr/bin/env node
// Sestaví složku dist/ pro Cloudflare Pages: jen soubory webu, bez README, administrace a skriptů.
// Cloudflare Pages: Build command `node scripts/build-site.mjs`, Build output directory `dist`.
//
// Spuštění ručně:  node scripts/build-site.mjs

import { rm, mkdir, cp, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'dist');
const SITE = ['index.html', 'zasady.html', 'assets', '_headers'];

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT);
for (const item of SITE) {
  const from = path.join(ROOT, item);
  await access(from); // chybějící soubor = chyba buildu, ne poloviční web
  await cp(from, path.join(OUT, item), { recursive: true, filter: (src) => !/\.DS_Store$/.test(src) });
}
console.log(`Web připraven v dist/ (${SITE.join(', ')}).`);
