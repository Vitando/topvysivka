/*!
 * Top výšivka – Cloudflare Worker
 * Statický web servíruje Cloudflare (složka dist/, viz wrangler.jsonc). Tenhle kód běží jen pro /api/*:
 *   POST /api/poptavka  → zkontroluje poptávku z formuláře a pošle ji e-mailem přes Resend (i s přílohami).
 *
 * Nastavení (Cloudflare → Workers → topvysivka → Settings → Variables and Secrets):
 *   RESEND_API_KEY  (Secret)  klíč z resend.com → API Keys
 * Ve wrangler.jsonc (vars):
 *   FORM_TO        kam chodí poptávky (info@topvysivka.cz)
 *   FORM_FROM      odesílatel – adresa na doméně ověřené v Resendu
 *   FORM_CONFIRM   "1" = zákazníkovi přijde potvrzení „Poptávka je u nás“
 */

const MAX_FILE = 10 * 1024 * 1024;   // stejné jako ve formuláři (assets/js/main.js)
const MAX_TOTAL = 25 * 1024 * 1024;  // limit e-mailu s přílohami
const MAX_FILES = 10;
const ALLOWED_EXT = ['ai', 'pdf', 'svg', 'png', 'jpg', 'jpeg'];
const MIN_FILL_MS = 3000;            // rychlejší vyplnění = robot

// [pole, popisek v e-mailu, max. délka]
const FIELDS = [
  ['jmeno', 'Jméno', 100],
  ['email', 'E-mail', 200],
  ['telefon', 'Telefon', 40],
  ['pocet', 'Počet kusů', 10],
  ['typ', 'Co potřebuje', 60],
  ['rozmer', 'Přibližný rozměr', 200],
  ['umisteni', 'Umístění', 200],
  ['material', 'Materiál', 200],
  ['termin', 'Požadovaný termín', 20],
  ['vlastni_textil', 'Vlastní textil', 10],
  ['zprava', 'Zpráva', 5000],
];

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
});
const fail = (status, error) => json({ ok: false, error }, status);

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const oneLine = (s) => String(s).replace(/[\r\n]+/g, ' ').trim();
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$/;

function base64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

async function sendEmail(env, message) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(message),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

export async function handleInquiry(request, env) {
  if (request.method !== 'POST') return fail(405, 'Použijte prosím formulář na webu.');
  if (!env.RESEND_API_KEY || !env.FORM_TO || !env.FORM_FROM) return fail(503, 'Odesílání poptávek ještě není nastavené.');

  // jen z našeho webu (ochrana proti odesílání z cizích stránek)
  const origin = request.headers.get('Origin');
  if (origin && new URL(origin).host !== new URL(request.url).host) return fail(403, 'Neplatný původ požadavku.');

  const size = Number(request.headers.get('Content-Length') || 0);
  if (size > MAX_TOTAL + 1024 * 1024) return fail(413, 'Přílohy jsou dohromady moc velké (max. 25 MB).');

  let form;
  try { form = await request.formData(); } catch { return fail(400, 'Formulář se nepodařilo načíst.'); }

  // anti-spam: skryté pole vyplní jen robot; příliš rychlé vyplnění taky. Robotovi tvrdíme, že prošlo.
  if (String(form.get('web') || '').trim()) return json({ ok: true });
  const fillMs = Number(form.get('ts_ms'));
  if (Number.isFinite(fillMs) && fillMs > 0 && fillMs < MIN_FILL_MS) return json({ ok: true });

  const data = {};
  for (const [name, , max] of FIELDS) {
    const v = String(form.get(name) ?? '').replace(/\r\n?/g, '\n').trim(); // formulář posílá konce řádků jako \r\n
    if ([...v].length > max) return fail(400, `Pole „${name}“ je moc dlouhé.`);
    data[name] = v;
  }
  if (!data.jmeno) return fail(400, 'Vyplňte prosím jméno.');
  if (!EMAIL_RE.test(data.email)) return fail(400, 'Zkontrolujte prosím e-mail.');
  if (data.pocet && !/^\d{1,6}$/.test(data.pocet)) return fail(400, 'Počet kusů musí být číslo.');
  if (!form.get('souhlas')) return fail(400, 'Potvrďte prosím informace o zpracování osobních údajů.');

  const files = form.getAll('prilohy').filter((f) => f && typeof f === 'object' && f.size > 0);
  if (files.length > MAX_FILES) return fail(400, `Najednou jde poslat max. ${MAX_FILES} souborů.`);
  let total = 0;
  const attachments = [];
  for (const f of files) {
    const ext = (String(f.name).split('.').pop() || '').toLowerCase();
    if (!ALLOWED_EXT.includes(ext)) return fail(400, `Soubor „${f.name}“ má nepodporovaný formát.`);
    if (f.size > MAX_FILE) return fail(413, `Soubor „${f.name}“ je větší než 10 MB.`);
    total += f.size;
    if (total > MAX_TOTAL) return fail(413, 'Přílohy jsou dohromady moc velké (max. 25 MB).');
    attachments.push({ filename: oneLine(f.name).slice(0, 150), content: base64(await f.arrayBuffer()) });
  }

  const rows = FIELDS.filter(([n]) => data[n]).map(([n, label]) => [label, n === 'vlastni_textil' ? 'ano, pošle ho' : data[n]]);
  if (attachments.length) rows.push(['Přílohy', attachments.map((a) => a.filename).join(', ')]);
  const what = [data.typ, data.pocet && `${data.pocet} ks`].filter(Boolean).join(', ');
  const subject = oneLine(`Nová poptávka${what ? `: ${what}` : ''} – ${data.jmeno}`).slice(0, 200);
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#3B2418">
<h2 style="margin:0 0 12px">Nová poptávka z webu topvysivka.cz</h2>
<table cellpadding="6" style="border-collapse:collapse">${rows.map(([k, v]) => `<tr><td style="vertical-align:top;color:#5A3B2E;white-space:nowrap"><b>${esc(k)}</b></td><td>${esc(v).replace(/\n/g, '<br>')}</td></tr>`).join('')}</table>
<p style="margin-top:16px;color:#5A3B2E">Na tento e-mail stačí odpovědět – odpověď půjde rovnou zákazníkovi.</p></div>`;
  const text = rows.map(([k, v]) => `${k}: ${v}`).join('\n') + '\n\nNa tento e-mail stačí odpovědět – odpověď půjde rovnou zákazníkovi.';

  try {
    await sendEmail(env, { from: env.FORM_FROM, to: [env.FORM_TO], reply_to: data.email, subject, html, text, attachments });
  } catch (e) {
    console.error('Poptávka se neodeslala:', e.message);
    return fail(502, 'Odeslání se nepovedlo.');
  }

  if (env.FORM_CONFIRM === '1') {
    const thanks = `Dobrý den,\n\nděkujeme za poptávku, je u nás. Mrkneme na ni a ozveme se Vám s kalkulací.\n\nTop výšivka\n${env.FORM_TO}`;
    await sendEmail(env, {
      from: env.FORM_FROM, to: [data.email], reply_to: env.FORM_TO,
      subject: 'Poptávka je u nás – Top výšivka', text: thanks,
      html: `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#3B2418">${esc(thanks).replace(/\n/g, '<br>')}</div>`,
    }).catch((e) => console.error('Potvrzení zákazníkovi se neodeslalo:', e.message)); // poptávka už odešla, tohle je jen bonus
  }
  return json({ ok: true });
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname === '/api/poptavka') return handleInquiry(request, env);
    if (pathname.startsWith('/api/')) return fail(404, 'Nenalezeno.');
    return env.ASSETS.fetch(request);
  },
};
