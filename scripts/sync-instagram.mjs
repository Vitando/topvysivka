#!/usr/bin/env node
// Instagram galerie pro topvysivka.cz
// Stáhne poslední příspěvky z Behold.so JSON feedu, uloží fotky do
// assets/img/instagram/ a přepíše galerii v index.html mezi značkami
// <!-- INSTAGRAM:START --> a <!-- INSTAGRAM:END -->.
// Když cokoliv selže, index.html zůstane beze změny (web dál ukazuje poslední fotky).
//
// Spuštění ručně:  node scripts/sync-instagram.mjs
// Jiný feed:       BEHOLD_FEED_URL=https://feeds.behold.so/XXXX node scripts/sync-instagram.mjs

import { readFile, writeFile, mkdir, readdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FEED_URL = process.env.BEHOLD_FEED_URL || 'https://feeds.behold.so/PP8w0EJWDQ0HDUtMJgjM';
const PROFILE_URL = process.env.INSTAGRAM_PROFILE_URL || 'https://www.instagram.com/topvysivka.cz/';
const MAX_POSTS = 6;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HTML_PATH = path.join(ROOT, 'index.html');
const IMG_DIR_REL = 'assets/img/instagram';
const IMG_DIR = path.join(ROOT, IMG_DIR_REL);
const START = '<!-- INSTAGRAM:START -->';
const END = '<!-- INSTAGRAM:END -->';

const IG_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="2.2"></rect><circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" stroke-width="2.2"></circle><circle cx="17.3" cy="6.7" r="1.3" fill="currentColor"></circle></svg>';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Odstraní hashtagy, zmínky a zbytečné mezery
const clean = (s) => String(s || '').replace(/#[\p{L}\p{N}_]+/gu, '').replace(/@[\w.]+/g, '').replace(/\s+/g, ' ').trim();

function titleFrom(raw) {
  const firstLine = String(raw || '').split('\n').map(clean).find(Boolean) || '';
  const sentence = firstLine.split(/[.!?]/)[0].trim() || firstLine;
  if (!sentence) return 'Top výšivka';
  if (sentence.length <= 26) return sentence;
  return sentence.slice(0, 25).replace(/\s+\S*$/, '') + '…';
}

function altFrom(raw) {
  const text = clean(raw);
  if (!text) return 'Výšivka od Top výšivka';
  return text.length <= 140 ? text : text.slice(0, 139).replace(/\s+\S*$/, '') + '…';
}

// Vybere obrázek: preferuje Behold velikosti, u videa náhled
function pickImage(post) {
  const s = post.sizes || {};
  const size = [s.medium, s.large, s.full, s.small].find((x) => x && x.mediaUrl);
  if (size) return { url: size.mediaUrl, width: size.width || 720, height: size.height || 720 };
  const url = post.mediaType === 'VIDEO' ? post.thumbnailUrl : (post.mediaUrl || post.thumbnailUrl);
  return url ? { url, width: 720, height: 720 } : null;
}

const extFor = (type) => (type.includes('webp') ? '.webp' : type.includes('png') ? '.png' : '.jpg');

async function download(url, id) {
  const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`obrázek ${id}: HTTP ${res.status}`);
  const type = res.headers.get('content-type') || 'image/jpeg';
  if (!type.startsWith('image/')) throw new Error(`obrázek ${id}: nečekaný typ ${type}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 1000) throw new Error(`obrázek ${id}: podezřele malý soubor`);
  const file = id + extFor(type);
  await writeFile(path.join(IMG_DIR, file), buf);
  return file;
}

async function main() {
  const res = await fetch(FEED_URL, { signal: AbortSignal.timeout(20000), headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`feed vrátil HTTP ${res.status}`);
  const data = await res.json();
  const posts = (Array.isArray(data) ? data : data.posts || []).slice(0, MAX_POSTS);
  if (!posts.length) throw new Error('feed neobsahuje žádné příspěvky');

  await mkdir(IMG_DIR, { recursive: true });
  const existing = await readdir(IMG_DIR);
  const used = new Set();
  const cards = [];

  for (const post of posts) {
    const img = pickImage(post);
    if (!img) continue;
    const id = String(post.id || '').replace(/[^\w-]/g, '');
    if (!id) continue;
    const file = existing.find((f) => f.startsWith(id + '.')) || (await download(img.url, id));
    used.add(file);
    const raw = post.caption || post.prunedCaption || '';
    const i = cards.length;
    cards.push(
      `<a class="tv-polaroid" href="${esc(post.permalink || PROFILE_URL)}" target="_blank" rel="noopener">` +
      `<span class="tv-polaroid__img tv-polaroid__img--${i % 4}"><img src="${IMG_DIR_REL}/${file}" alt="${esc(altFrom(raw))}" loading="lazy" width="${img.width}" height="${img.height}"></span>` +
      `<span class="tv-polaroid__cap"><span>${esc(titleFrom(raw))}</span>${IG_ICON}</span></a>`
    );
  }
  if (!cards.length) throw new Error('žádný příspěvek nemá použitelný obrázek');

  const html = await readFile(HTML_PATH, 'utf8');
  const a = html.indexOf(START);
  const b = html.indexOf(END);
  if (a < 0 || b < a) throw new Error('v index.html chybí značky INSTAGRAM:START / INSTAGRAM:END');
  const block = `${START}\n${cards.map((c) => '          ' + c).join('\n')}\n        `;
  const next = html.slice(0, a) + block + html.slice(b);

  if (next !== html) {
    await writeFile(HTML_PATH, next);
    console.log(`Galerie aktualizována (${cards.length} příspěvků).`);
  } else {
    console.log('Žádné nové příspěvky.');
  }

  // Smaže staré fotky, které už v galerii nejsou
  for (const f of await readdir(IMG_DIR)) {
    if (!used.has(f) && !f.startsWith('.')) await unlink(path.join(IMG_DIR, f)).catch(() => {});
  }
}

main().catch((err) => {
  console.error('Instagram sync selhal:', err.message, '(index.html zůstal beze změny)');
  process.exit(1);
});
