/*!
 * Top výšivka – souhlas s cookies
 *
 * Měřicí a reklamní skripty (Google Analytics, Meta Pixel) se načtou AŽ PO souhlasu.
 * Dokud návštěvník nesouhlasí, web neukládá žádné cookies a nic neposílá Googlu ani Metě.
 *  - Lišta se ukáže jen tehdy, když je vyplněné aspoň jedno ID níže.
 *  - Odmítnutí je stejně snadné jako přijetí (tlačítka vedle sebe, stejně výrazná).
 *  - Volba platí CONSENT_DAYS dní, pak se lišta ukáže znovu.
 *  - Souhlas jde kdykoli změnit odkazem „Nastavení cookies“ v patičce (data-cookie-settings)
 *    nebo adresou …/#cookies. Po odvolání se smažou cookies měření a stránka se načte znovu.
 *  - Samotná volba se ukládá do localStorage (technicky nezbytné, nevyžaduje souhlas).
 * Při přidání nového nástroje zvyšte CONSENT_VERSION, aby se všech zeptala lišta znovu.
 */
(function () {
  'use strict';

  var GA4_ID = 'G-66PMP7TFYT';  // Google Analytics 4, např. 'G-ABC123XYZ'
  var META_PIXEL_ID = '';   // Meta (Facebook) Pixel, např. '1234567890'

  var CONSENT_VERSION = 1;
  var CONSENT_DAYS = 182;
  var KEY = 'tv-consent';

  var cats = { analytics: !!GA4_ID, marketing: !!META_PIXEL_ID };
  var needed = cats.analytics || cats.marketing;

  function read() {
    try {
      var c = JSON.parse(localStorage.getItem(KEY));
      if (!c || c.v !== CONSENT_VERSION) return null;
      if (Date.now() - c.t > CONSENT_DAYS * 864e5) return null;
      return c;
    } catch (e) { return null; }
  }

  function save(analytics, marketing) {
    var c = { v: CONSENT_VERSION, t: Date.now(), analytics: !!analytics, marketing: !!marketing };
    try { localStorage.setItem(KEY, JSON.stringify(c)); } catch (e) {}
    return c;
  }

  function addScript(src) {
    var s = document.createElement('script');
    s.async = true;
    s.src = src;
    document.head.appendChild(s);
  }

  var loaded = { analytics: false, marketing: false };

  /* Google Analytics 4 s Consent Mode v2 (základní režim: gtag se načte až po souhlasu) */
  function loadAnalytics(c) {
    if (loaded.analytics || !GA4_ID) return;
    loaded.analytics = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('consent', 'default', { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
    window.gtag('consent', 'update', {
      analytics_storage: 'granted',
      ad_storage: c.marketing ? 'granted' : 'denied',
      ad_user_data: c.marketing ? 'granted' : 'denied',
      ad_personalization: c.marketing ? 'granted' : 'denied'
    });
    window.gtag('js', new Date());
    window.gtag('config', GA4_ID);
    addScript('https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GA4_ID));
  }

  function loadMarketing() {
    if (loaded.marketing || !META_PIXEL_ID) return;
    loaded.marketing = true;
    var fbq = window.fbq = function () { fbq.callMethod ? fbq.callMethod.apply(fbq, arguments) : fbq.queue.push(arguments); };
    if (!window._fbq) window._fbq = fbq;
    fbq.push = fbq; fbq.loaded = true; fbq.version = '2.0'; fbq.queue = [];
    fbq('init', META_PIXEL_ID);
    fbq('track', 'PageView');
    addScript('https://connect.facebook.net/en_US/fbevents.js');
  }

  function apply(c) {
    if (c.analytics) loadAnalytics(c);
    if (c.marketing) loadMarketing();
  }

  var COOKIES = { analytics: /^(_ga|_gid|_gat)/, marketing: /^(_gcl|_fbp|_fbc)/ };

  // Smaže cookies dané kategorie (_ga…, _fbp…) na této doméně i nadřazených doménách
  function clearTracking(cat) {
    var host = location.hostname.split('.');
    document.cookie.split(';').forEach(function (pair) {
      var name = pair.split('=')[0].trim();
      if (!COOKIES[cat].test(name)) return;
      for (var i = 0; i < host.length - 1; i++) {
        var domain = host.slice(i).join('.');
        document.cookie = name + '=; Max-Age=0; path=/; domain=' + domain;
      }
      document.cookie = name + '=; Max-Age=0; path=/';
    });
  }

  function decide(analytics, marketing) {
    var prev = read();
    var c = save(analytics && cats.analytics, marketing && cats.marketing);
    hide();
    var revoked = (loaded.analytics && !c.analytics) || (loaded.marketing && !c.marketing) ||
      (prev && ((prev.analytics && !c.analytics) || (prev.marketing && !c.marketing)));
    if (revoked) {
      // nejdřív zastavit měření (jinak si GA cookies při odchodu ze stránky znovu zapíše), pak mazat
      if (window.gtag) window.gtag('consent', 'update', { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
      if (window.fbq) window.fbq('consent', 'revoke');
      if (!c.analytics) clearTracking('analytics');
      if (!c.marketing) clearTracking('marketing');
      location.reload();
      return;
    }
    apply(c);
  }

  /* --- lišta --- */
  var bar, details, lastFocus;

  function show(withDetails) {
    if (!bar) { location.href = './#cookies'; return; } // lišta je jen na hlavní stránce
    var c = read();
    bar.querySelectorAll('input[data-cat]').forEach(function (i) { i.checked = !!(c && c[i.getAttribute('data-cat')]); });
    details.hidden = !withDetails;
    bar.hidden = false;
    lastFocus = document.activeElement;
    requestAnimationFrame(function () { bar.classList.add('is-on'); });
    var first = bar.querySelector(withDetails ? 'input[data-cat]:not([disabled])' : 'button');
    if (first && withDetails) first.focus();
  }

  function hide() {
    if (!bar) return;
    bar.classList.remove('is-on');
    bar.hidden = true;
    if (lastFocus && lastFocus.focus && document.contains(lastFocus)) lastFocus.focus();
  }

  function init() {
    // Odkazy „Nastavení cookies“ jsou vidět jen tam, kde je co nastavovat
    document.querySelectorAll('[data-cookie-settings]').forEach(function (a) {
      if (!needed) { a.hidden = true; return; }
      a.hidden = false;
      a.addEventListener('click', function (e) { e.preventDefault(); show(true); });
    });
    if (!needed) return;

    bar = document.getElementById('tv-cc');
    if (bar) {
      details = bar.querySelector('.tv-cc__details');
      bar.querySelectorAll('[data-cc-cat]').forEach(function (row) {
        if (!cats[row.getAttribute('data-cc-cat')]) row.remove();
      });
      bar.addEventListener('click', function (e) {
        var b = e.target.closest('[data-cc]');
        if (!b) return;
        var act = b.getAttribute('data-cc');
        if (act === 'accept') decide(true, true);
        else if (act === 'reject') decide(false, false);
        else if (act === 'details') { details.hidden = !details.hidden; }
        else if (act === 'save') {
          var v = {};
          bar.querySelectorAll('input[data-cat]').forEach(function (i) { v[i.getAttribute('data-cat')] = i.checked; });
          decide(v.analytics, v.marketing);
        }
      });
    }

    var c = read();
    // pozůstatky po odvolaném nebo vypršelém souhlasu
    if (!c || !c.analytics) clearTracking('analytics');
    if (!c || !c.marketing) clearTracking('marketing');
    if (c) apply(c);
    if (location.hash === '#cookies') show(true);
    else if (!c) show(false);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
