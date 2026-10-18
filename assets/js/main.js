/*!
 * Top výšivka – interakce a animace
 * Knihovny: GSAP 3.13 + ScrollTrigger, Three.js r158 (assets/js/vendor)
 */
(function () {
  'use strict';

  /* Kam se odesílá poptávka: Cloudflare Worker (src/worker.js) ji pošle e-mailem i s přílohami.
     Prázdné = formulář jen ukáže poděkování (ukázka bez odesílání). */
  var FORM_ENDPOINT = '/api/poptavka';

  class Base {
    constructor() { this.props = { motion: true, threeD: true }; this.state = {}; this.root = null; }
    setState(o) { Object.assign(this.state, o); if (o && o.js && this.root) this.root.classList.add('tv--js'); }
  }

class TopVysivka extends Base {
  /* ---------- životní cyklus ---------- */
  componentDidMount() {
    this._alive = true;
    this._clean = [];
    const ready = (test, cb, n) => {
      n = n || 0;
      if (!this._alive) return;
      if (test()) { cb(); return; }
      if (n > 160) return;
      const t = setTimeout(() => ready(test, cb, n + 1), 60);
      this._clean.push(() => clearTimeout(t));
    };
    ready(() => !!this.root, () => { this.fitTitle(); this.fitLines(); });
    ready(() => this.root && window.gsap && window.ScrollTrigger, () => this.initMotion());
    ready(() => this.root && window.gsap, () => this.loadThree());
  }

  componentWillUnmount() {
    this._alive = false;
    (this._clean || []).forEach((f) => { try { f(); } catch (e) {} });
  }

  componentDidUpdate(prevProps, prevState) {
    const was = prevState && prevState.sent;
    if (this.state && this.state.sent && !was) this.celebrate();
  }

  /* přepočítat rozměry, až se donačte písmo (diakritika se stahuje zvlášť, i po document.fonts.ready) */
  whenFontsChange(run) {
    if (document.fonts) {
      if (document.fonts.ready) document.fonts.ready.then(run);
      const f = () => requestAnimationFrame(run);
      document.fonts.addEventListener('loadingdone', f);
      this._clean.push(() => document.fonts.removeEventListener('loadingdone', f));
    }
    window.addEventListener('load', run, { once: true });
  }

  /* velké nadpisy sekcí: když se dlouhé slovo (třeba z administrace) nevejde na šířku, zmenší se písmo */
  fitLines() {
    const hs = Array.prototype.slice.call(this.root.querySelectorAll('[data-lines]:not([data-fit])'));
    if (!hs.length) return;
    const run = () => {
      if (!this._alive) return;
      hs.forEach((h) => {
        h.style.fontSize = '';
        for (let i = 0; i < 4; i++) {
          let k = 1;
          // přesah do ~4 % velikosti písma dělá tvar písmen (neviditelné); zmenšuje se až skutečně přetékající slovo
          const tol = parseFloat(getComputedStyle(h).fontSize) * 0.08;
          h.querySelectorAll('.tv-line').forEach((l) => {
            if (l.clientWidth && l.scrollWidth - l.clientWidth > tol) k = Math.min(k, l.clientWidth / l.scrollWidth);
          });
          if (k >= 1) break;
          h.style.fontSize = parseFloat(getComputedStyle(h).fontSize) * k * 0.96 + 'px';
        }
      });
    };
    run();
    this.whenFontsChange(run);
    let raf = 0;
    const onResize = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(run); };
    window.addEventListener('resize', onResize);
    this._clean.push(() => window.removeEventListener('resize', onResize));
  }

  /* nadpis v hero přes celou šířku */
  fitTitle() {
    const h1 = this.root && this.root.querySelector('[data-fit]');
    if (!h1) return;
    const lines = Array.prototype.slice.call(h1.querySelectorAll('.tv-line'));
    const run = () => {
      if (!this._alive) return;
      h1.style.fontSize = '';
      lines.forEach((l) => { l.style.fontSize = ''; });
      const avail = h1.clientWidth;
      if (!avail) return;
      const base = parseFloat(getComputedStyle(h1).fontSize);
      const ws = lines.map((l) => { const inn = l.querySelector('.tv-line__in'); return inn ? inn.getBoundingClientRect().width : 0; });
      if (!ws[0]) return;
      h1.style.fontSize = Math.max(48, base * (avail / ws[0]) * 0.985) + 'px';
      lines.forEach((l, i) => { if (i > 0 && ws[i]) l.style.fontSize = Math.min(1.3, ws[0] / ws[i]) + 'em'; });
      if (window.ScrollTrigger) window.ScrollTrigger.refresh();
    };
    run();
    this.whenFontsChange(run);
    if (window.ResizeObserver) {
      let last = 0;
      const ro = new ResizeObserver(() => { const w = h1.clientWidth; if (w !== last) { last = w; requestAnimationFrame(run); } });
      ro.observe(h1);
      this._clean.push(() => ro.disconnect());
    }
  }

  /* ---------- GSAP ---------- */
  initMotion() {
    const gsap = window.gsap, ST = window.ScrollTrigger, root = this.root;
    if (!root || this._motion) return;
    this._motion = true;
    gsap.registerPlugin(ST);
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (this.props.motion === false || reduce) { this.initThread(false, false); return; }
    this.setState({ js: true });

    const q = gsap.utils.selector(root);
    const live = document.documentElement.scrollHeight > window.innerHeight + 400;
    this._live = live;
    this.initThread(true, live);
    const st = (trigger, extra) => (live && trigger ? Object.assign({ trigger, start: 'top 85%', once: true }, extra || {}) : undefined);
    const fine = window.matchMedia && window.matchMedia('(pointer: fine)').matches;

    const ctx = gsap.context(() => {
      /* úvod */
      const tl = gsap.timeline({ defaults: { ease: 'expo.out' }, delay: 0.15 });
      tl.from(q('.tv-hero .tv-line__in'), { yPercent: 118, rotate: 4, duration: 1.25, stagger: 0.12 })
        .from(q('.tv-peek__body'), { yPercent: 85, duration: 1.1, ease: 'back.out(1.7)' }, 0.75)
        .from(q('.tv-peek__hands ellipse'), { scale: 0, transformOrigin: '50% 50%', duration: 0.55, stagger: 0.08, ease: 'back.out(3)' }, 1.35)
        .from(q('.tv-peek__hands path'), { opacity: 0, duration: 0.3 }, 1.5)
        .from(q('.tv-hero__top > *, .tv-hero__sub, .tv-hero__lead, .tv-hero__ctas > *, .tv-hero__micro'), { y: 34, opacity: 0, duration: 0.9, stagger: 0.07 }, 0.45)
        .fromTo(q('[data-draw="intro"]'), { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1.2, ease: 'power2.inOut' }, 1.1)
        .from(q('.tv-photo'), { rotate: -16, scale: 0.7, opacity: 0, duration: 1.4, ease: 'back.out(1.5)' }, 0.4)
        .from(q('.tv-photo__tag'), { scale: 0, rotate: -50, duration: 0.8, ease: 'back.out(2.6)' }, 1.15)
        .from(q('.tv-hero .tv-sticker'), { scale: 0, rotate: -140, duration: 1, stagger: 0.08, ease: 'back.out(2)' }, 0.7)
        .from(q('.tv-ribbon--back'), { xPercent: 25, opacity: 0, duration: 1.3 }, 0.4)
        .from(q('.tv-ribbon--front'), { xPercent: -25, opacity: 0, duration: 1.3 }, 0.5);

      /* maskot: mrkání, pohupování, vyšívání, mávání */
      q('.tv-eyes').forEach((e, i) => {
        gsap.timeline({ repeat: -1, repeatDelay: 2.4 + i * 0.9, delay: 2 + i * 0.5 })
          .to(e, { scaleY: 0.1, transformOrigin: '50% 50%', duration: 0.08, ease: 'power1.in' })
          .to(e, { scaleY: 1, duration: 0.14, ease: 'power1.out' });
      });
      q('[data-bob]').forEach((el, i) => gsap.to(el, { y: -10, rotate: i % 2 ? 2 : -2, duration: 1.4 + i * 0.2, ease: 'sine.inOut', yoyo: true, repeat: -1 }));
      gsap.to(q('.tv-needle'), { x: -7, y: 8, duration: 0.32, ease: 'power1.inOut', yoyo: true, repeat: -1, repeatDelay: 0.1 });
      gsap.to(q('.tv-wave-arm'), { rotate: -16, svgOrigin: '182 176', duration: 0.3, ease: 'sine.inOut', yoyo: true, repeat: -1, repeatDelay: 0.05 });
      q('.tv-float').forEach((el, i) => gsap.to(el, { y: i % 2 ? -14 : 14, rotate: i % 2 ? 12 : -12, duration: 2.2 + (i % 4) * 0.35, ease: 'sine.inOut', yoyo: true, repeat: -1 }));

      /* běžící pásy, zrychlují se podle rychlosti scrollu */
      const tweens = [];
      q('[data-marquee]').forEach((m) => {
        const tr = m.querySelector('.tv-marquee__track');
        if (!tr) return;
        const rev = m.getAttribute('data-marquee') === 'rev';
        const dur = parseFloat(m.getAttribute('data-duration')) || 40;
        /* široké pásy (loga) bez 3D vrstvy – obří GPU vrstvu některé prohlížeče nevykreslí */
        const wide = !!m.closest('.tv-logos');
        tweens.push(gsap.fromTo(tr, { xPercent: rev ? -50 : 0 }, { xPercent: rev ? 0 : -50, duration: dur, ease: 'none', repeat: -1, force3D: wide ? false : 'auto' }));
      });
      let boost = 1, target = 1;
      if (live) ST.create({ onUpdate: (self) => { target = 1 + Math.min(Math.abs(self.getVelocity()) / 300, 6); } });
      const tick = () => { target += (1 - target) * 0.04; boost += (target - boost) * 0.12; tweens.forEach((t) => t.timeScale(boost)); };
      gsap.ticker.add(tick);
      this._clean.push(() => gsap.ticker.remove(tick));

      /* nadpisy sekcí a obecné odhalení */
      q('[data-lines]').forEach((el) => gsap.from(el.querySelectorAll('.tv-line__in'), { yPercent: 118, rotate: 3, duration: 1.15, stagger: 0.1, ease: 'expo.out', scrollTrigger: st(el) }));
      q('[data-reveal]').forEach((el) => gsap.from(el, { y: 90, opacity: 0, duration: 1.2, ease: 'expo.out', scrollTrigger: st(el) }));

      /* záruky */
      const guar = q('.tv-guar')[0];
      gsap.from(q('.tv-guar__item'), { y: 50, opacity: 0, duration: 0.9, stagger: 0.1, ease: 'back.out(1.6)', scrollTrigger: st(guar) });
      gsap.from(q('.tv-badge'), { rotate: -200, scale: 0.3, duration: 1.2, stagger: 0.1, ease: 'back.out(2)', scrollTrigger: st(guar) });

      /* nášivky se „přišijí": spadnou, zhoupnou se a usadí */
      gsap.from(q('.tv-patch'), { y: -180, rotate: (i) => [-16, 12, -9][i % 3], opacity: 0, duration: 1.5, stagger: 0.15, ease: 'elastic.out(1, 0.6)', clearProps: 'transform,opacity', scrollTrigger: st(q('.tv-patches')[0], { start: 'top 80%' }) });
      gsap.from(q('.tv-head__aside .tv-svc__mascot'), { y: 120, rotate: 20, opacity: 0, duration: 1.2, ease: 'back.out(1.8)', scrollTrigger: st(q('.tv-head__aside')[0]) });

      /* kroky */
      const steps = q('.tv-steps')[0];
      gsap.from(q('.tv-step__num'), { scale: 0, rotate: -120, duration: 1, stagger: 0.18, ease: 'back.out(2.4)', scrollTrigger: st(steps) });
      gsap.from(q('.tv-step h3, .tv-step p'), { y: 26, opacity: 0, duration: 0.8, stagger: 0.06, ease: 'power3.out', scrollTrigger: st(steps) });
      gsap.from(q('.tv-mascot, .tv-bubble'), { y: 140, opacity: 0, duration: 1.2, stagger: 0.25, ease: 'back.out(1.6)', scrollTrigger: st(q('#jak')[0], { start: 'top 75%' }) });

      /* Instagram polaroidy vletí */
      gsap.from(q('.tv-polaroid'), { y: 220, rotate: (i) => (i % 2 ? 28 : -28), opacity: 0, duration: 1.2, stagger: { each: 0.08, from: 'random' }, ease: 'back.out(1.4)', clearProps: 'transform,opacity', scrollTrigger: st(q('.tv-ig__grid')[0], { start: 'top 88%' }) });

      /* technická karta */
      gsap.from(q('.tv-cone'), { yPercent: 115, opacity: 0, duration: 0.9, stagger: 0.05, ease: 'back.out(2.4)', scrollTrigger: st(q('.tv-cones')[0]) });
      q('[data-count]').forEach((el) => {
        const to = parseFloat(el.getAttribute('data-count')) || 0;
        const o = { v: 0 };
        gsap.to(o, { v: to, duration: 2, ease: 'power2.out', scrollTrigger: st(el), onUpdate: () => { el.textContent = String(Math.round(o.v)); } });
      });

      /* FAQ, kontakty */
      gsap.from(q('.tv-qa'), { x: 80, opacity: 0, duration: 0.9, stagger: 0.06, ease: 'expo.out', clearProps: 'transform,opacity', scrollTrigger: st(q('.tv-faq')[0]) });
      gsap.from(q('.tv-ccard'), { y: 60, rotate: (i) => (i % 2 ? 4 : -4), opacity: 0, duration: 1, stagger: 0.08, ease: 'back.out(1.7)', clearProps: 'transform,opacity', scrollTrigger: st(q('.tv-cgrid')[0]) });
      gsap.from(q('.tv-map__pin'), { y: -120, opacity: 0, duration: 1.2, ease: 'bounce.out', scrollTrigger: st(q('.tv-map')[0]) });

      /* nit, která se při scrollu prošívá */
      q('[data-draw]').forEach((p) => {
        if (p.getAttribute('data-draw') === 'intro') return;
        const scope = p.closest('[data-draw-scope]') || root;
        if (live) {
          gsap.fromTo(p, { strokeDashoffset: 1 }, { strokeDashoffset: 0, ease: 'none', scrollTrigger: { trigger: scope, start: p.getAttribute('data-start') || 'top 75%', end: p.getAttribute('data-end') || 'bottom 60%', scrub: 1 } });
        } else {
          gsap.fromTo(p, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 3, ease: 'power2.inOut', delay: 0.8 });
        }
      });

      /* parallax */
      if (live) {
        const hero = q('.tv-hero')[0];
        gsap.to(q('.tv-hero__media'), { y: -90, rotate: -5, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } });
        q('.tv-sticker[data-speed]').forEach((el) => gsap.to(el, { y: () => -parseFloat(el.getAttribute('data-speed')) * 220, ease: 'none', scrollTrigger: { trigger: el.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } }));
      }

      /* magnetická tlačítka, 3D náklon nášivek, kurzor, oči sledují myš */
      if (fine) {
        q('[data-magnetic]').forEach((el) => {
          const xT = gsap.quickTo(el, 'x', { duration: 0.7, ease: 'elastic.out(1, 0.4)' });
          const yT = gsap.quickTo(el, 'y', { duration: 0.7, ease: 'elastic.out(1, 0.4)' });
          const mv = (e) => { const r = el.getBoundingClientRect(); xT((e.clientX - r.left - r.width / 2) * 0.28); yT((e.clientY - r.top - r.height / 2) * 0.35); };
          const lv = () => { xT(0); yT(0); };
          el.addEventListener('pointermove', mv); el.addEventListener('pointerleave', lv);
          this._clean.push(() => { el.removeEventListener('pointermove', mv); el.removeEventListener('pointerleave', lv); });
        });
        q('[data-tilt]').forEach((card) => {
          const rx = gsap.quickTo(card, 'rotationX', { duration: 0.6, ease: 'power3' });
          const ry = gsap.quickTo(card, 'rotationY', { duration: 0.6, ease: 'power3' });
          gsap.set(card, { transformPerspective: 900 });
          const mv = (e) => { const r = card.getBoundingClientRect(); rx(-((e.clientY - r.top) / r.height - 0.5) * 16); ry(((e.clientX - r.left) / r.width - 0.5) * 18); };
          const lv = () => { rx(0); ry(0); };
          card.addEventListener('pointermove', mv); card.addEventListener('pointerleave', lv);
          this._clean.push(() => { card.removeEventListener('pointermove', mv); card.removeEventListener('pointerleave', lv); });
        });
        const pupils = q('.tv-pupils').map((p) => ({ el: p, x: gsap.quickTo(p, 'x', { duration: 0.4 }), y: gsap.quickTo(p, 'y', { duration: 0.4 }) }));
        const look = (e) => {
          pupils.forEach((p) => {
            const r = p.el.getBoundingClientRect();
            if (!r.width) return;
            const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
            const d = Math.hypot(dx, dy) || 1;
            p.x((dx / d) * 4); p.y((dy / d) * 4);
          });
        };
        window.addEventListener('pointermove', look);
        this._clean.push(() => window.removeEventListener('pointermove', look));
      }
    }, root);
    this._clean.push(() => ctx.revert());
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (this._alive) ST.refresh(); });
  }

  /* ---------- nit, která se prošívá stránkou ----------
     Trasa se počítá ze skutečných pozic sekcí: vede po okraji a na druhou stranu
     přechází jen v mezerách mezi sekcemi. Při scrollu konec nitě (s jehlou) jede
     ~62 % výšky okna, takže se stránka „prošívá" s pohybem. */
  initThread(animate, live) {
    if (this._threadInit) return;
    this._threadInit = true;
    const main = this.root && this.root.querySelector('.tv-main');
    const svg = main && main.querySelector('.tv-thread');
    if (!svg) return;
    const vis = svg.querySelector('.tv-thread__vis');
    const clip = svg.querySelector('.tv-thread__clip');
    const needle = svg.querySelector('.tv-thread__needle');
    const T = { total: 1, ys: [], step: 4, p: animate ? 0 : 1, H: 9000 };

    /* Nit se odkrývá shora dolů výřezem (clip-path), ne maskou: maska přes celou
       stránku je pro GPU obří obrázek a prohlížeč pak nevykreslí jiné vrstvy. */
    const draw = () => {
      const p = Math.max(0, Math.min(1, T.p));
      const L = p * T.total;
      const b = vis.getPointAtLength(Math.min(T.total, Math.max(L, 4)));
      clip.setAttribute('height', String(p >= 0.999 ? T.H + 80 : Math.max(0, b.y + 40 + 6)));
      if (!needle) return;
      if (!animate || T.total < 4) { needle.style.opacity = '0'; return; }
      const a = vis.getPointAtLength(Math.max(0, L - 4));
      const deg = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
      needle.setAttribute('transform', 'translate(' + b.x.toFixed(1) + ' ' + b.y.toFixed(1) + ') rotate(' + deg.toFixed(1) + ')');
      needle.style.opacity = p > 0.002 ? '1' : '0';
    };

    const lenAtY = (y) => {
      const ys = T.ys;
      if (!ys.length || y <= ys[0]) return 0;
      if (y >= ys[ys.length - 1]) return T.total;
      let lo = 0, hi = ys.length - 1;
      while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (ys[mid] < y) lo = mid; else hi = mid; }
      return hi * T.step;
    };

    const build = () => {
      if (!this._alive) return;
      const W = main.clientWidth, H = main.offsetHeight;
      if (!W || !H) return;
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
      T.H = H;
      clip.setAttribute('width', String(W + 80));
      const secs = Array.prototype.filter.call(main.children, (el) => el.tagName === 'SECTION');
      const wrap = main.querySelector('.tv-wrap');
      let gutter = 24;
      if (wrap) { const cs = getComputedStyle(wrap); gutter = (W - (wrap.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight))) / 2; }
      const off = Math.max(7, Math.min(110, gutter * 0.42));
      const X = [off, W - off];
      const amp = Math.min(9, off * 0.35);
      const run = (x, yA, yB) => {
        if (yB <= yA) return '';
        const n = Math.max(1, Math.round((yB - yA) / 320)), h = (yB - yA) / n;
        let s = '';
        for (let i = 0; i < n; i++) s += ' Q' + (x + (i % 2 ? -amp : amp)).toFixed(1) + ' ' + (yA + h * (i + 0.5)).toFixed(1) + ' ' + x.toFixed(1) + ' ' + (yA + h * (i + 1)).toFixed(1);
        return s;
      };
      let side = 0, y = 0, d = 'M' + X[0].toFixed(1) + ' 0';
      for (let i = 0; i < secs.length - 1; i++) {
        const next = secs[i + 1], yb = next.offsetTop;
        const padB = parseFloat(getComputedStyle(secs[i]).paddingBottom) || 80;
        const padT = parseFloat(getComputedStyle(next).paddingTop) || 80;
        const y0 = yb - padB * 0.5, y1 = yb + padT * 0.5;
        d += run(X[side], y, y0);
        const ns = 1 - side, k = y1 - y0;
        d += ' C' + X[side].toFixed(1) + ' ' + (y0 + k * 0.6).toFixed(1) + ' ' + X[ns].toFixed(1) + ' ' + (y1 - k * 0.6).toFixed(1) + ' ' + X[ns].toFixed(1) + ' ' + y1.toFixed(1);
        side = ns; y = y1;
      }
      d += run(X[side], y, H - 30);
      vis.setAttribute('d', d);
      T.total = vis.getTotalLength() || 1;
      T.ys = [];
      for (let l = 0; l <= T.total; l += T.step) T.ys.push(vis.getPointAtLength(l).y);
      draw();
    };
    build();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(build);
    if (window.ResizeObserver) {
      let raf = 0;
      const ro = new ResizeObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(build); });
      ro.observe(main);
      this._clean.push(() => { cancelAnimationFrame(raf); ro.disconnect(); });
    }

    const gsap = window.gsap;
    if (animate && live && gsap) {
      const upd = () => {
        const r = main.getBoundingClientRect();
        const tgt = lenAtY(window.innerHeight * 0.62 - r.top) / T.total;
        if (Math.abs(tgt - T.p) < 0.00003) return;
        T.p += (tgt - T.p) * 0.16;
        draw();
      };
      gsap.ticker.add(upd);
      this._clean.push(() => gsap.ticker.remove(upd));
    } else if (animate && gsap) {
      gsap.to(T, { p: 1, duration: 5, ease: 'power1.inOut', delay: 0.6, onUpdate: draw });
    }
  }

  celebrate() {
    const gsap = window.gsap;
    if (!gsap || !this.root || this.props.motion === false) return;
    requestAnimationFrame(() => {
      const q = gsap.utils.selector(this.root);
      gsap.from(q('.tv-sent__mascot'), { y: 90, scale: 0.4, rotate: -25, duration: 1.2, ease: 'elastic.out(1, 0.5)' });
      gsap.from(q('.tv-confetti > *'), { scale: 0, rotate: 200, transformOrigin: '50% 50%', duration: 0.9, stagger: 0.06, ease: 'back.out(3)', delay: 0.25 });
      gsap.to(q('.tv-sent__mascot svg'), { y: -18, duration: 0.3, yoyo: true, repeat: 7, ease: 'power1.inOut', delay: 0.7 });
      gsap.from(q('.tv-sent h3, .tv-sent p, .tv-sent .tv-btn'), { y: 34, opacity: 0, stagger: 0.09, duration: 0.8, ease: 'back.out(2)' });
    });
  }

  /* ---------- Three.js: 3D nášivka a cívky v cel-shading stylu ---------- */
  satin(ctx, S, draw, colors, angle, bump) {
    const mk = () => { const c = document.createElement('canvas'); c.width = c.height = S; return c; };
    const m = mk(), mc = m.getContext('2d');
    mc.fillStyle = '#000'; draw(mc);
    const f = mk(), fc = f.getContext('2d');
    fc.fillStyle = colors[0]; fc.fillRect(0, 0, S, S);
    fc.save(); fc.translate(S / 2, S / 2); fc.rotate(angle); fc.fillStyle = colors[1];
    for (let x = -S; x < S; x += 4.5) fc.fillRect(x, -S, 1.5, 2 * S);
    fc.restore();
    fc.globalCompositeOperation = 'destination-in'; fc.drawImage(m, 0, 0);
    const t = mk(), tc = t.getContext('2d');
    tc.drawImage(m, 0, 0); tc.globalCompositeOperation = 'source-in';
    tc.fillStyle = bump ? '#262626' : '#3B2418'; tc.fillRect(0, 0, S, S);
    const w = S * 0.008;
    for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; ctx.drawImage(t, Math.cos(a) * w, Math.sin(a) * w); }
    ctx.drawImage(f, 0, 0);
  }

  paintPatch(ctx, S, rPx, bump) {
    const c = S / 2;
    ctx.fillStyle = bump ? '#808080' : '#9CC3F3';
    ctx.fillRect(0, 0, S, S);
    ctx.save(); ctx.translate(c, c); ctx.rotate(-Math.PI / 4);
    for (let x = -S, k = 0; x < S; x += 5, k++) { ctx.fillStyle = k % 2 ? 'rgba(255,255,255,0.16)' : 'rgba(30,50,110,0.14)'; ctx.fillRect(x, -S, 2.2, 2 * S); }
    ctx.restore();
    ctx.save(); ctx.lineCap = 'round'; ctx.setLineDash([rPx * 0.07, rPx * 0.05]); ctx.lineWidth = rPx * 0.04;
    ctx.strokeStyle = bump ? '#ffffff' : '#3B2418'; ctx.beginPath(); ctx.arc(c, c, rPx * 0.83, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    const spark = (m, x, y, s) => { m.beginPath(); m.moveTo(x, y - s); m.bezierCurveTo(x + s * 0.12, y - s * 0.25, x + s * 0.25, y - s * 0.12, x + s, y); m.bezierCurveTo(x + s * 0.25, y + s * 0.12, x + s * 0.12, y + s * 0.25, x, y + s); m.bezierCurveTo(x - s * 0.12, y + s * 0.25, x - s * 0.25, y + s * 0.12, x - s, y); m.bezierCurveTo(x - s * 0.25, y - s * 0.12, x - s * 0.12, y - s * 0.25, x, y - s); m.closePath(); m.fill(); };
    this.satin(ctx, S, (m) => { m.textAlign = 'center'; m.textBaseline = 'alphabetic'; m.font = '400 ' + Math.round(rPx * 0.74) + 'px Anton, Impact, sans-serif'; m.fillText('TOP', c, c + rPx * 0.17); }, bump ? ['#ffffff', '#a8a8a8'] : ['#F9BEDD', '#DE7DB0'], 1.15, bump);
    this.satin(ctx, S, (m) => { m.textAlign = 'center'; m.textBaseline = 'alphabetic'; m.font = '700 ' + Math.round(rPx * 0.27) + 'px "Baloo 2", sans-serif'; m.fillText('výšivka', c, c + rPx * 0.5); }, bump ? ['#ffffff', '#b4b4b4'] : ['#FFF6E2', '#E8D3AE'], -1.1, bump);
    this.satin(ctx, S, (m) => { spark(m, c - rPx * 0.56, c - rPx * 0.4, rPx * 0.13); spark(m, c + rPx * 0.57, c - rPx * 0.36, rPx * 0.09); }, bump ? ['#ffffff', '#b8b8b8'] : ['#F8D547', '#D8B21C'], 0.6, bump);
  }

  /* 3D knihovna (636 kB) se stáhne až po zobrazení stránky, aby nezdržovala načtení */
  loadThree() {
    if (window.THREE) { this.initThree(); return; }
    const c = navigator.connection;
    if (c && (c.saveData || /2g/.test(c.effectiveType || ''))) return; // úsporný režim / pomalé připojení: bez 3D
    const start = () => {
      if (!this._alive) return;
      const s = document.createElement('script');
      s.src = 'assets/js/vendor/three.min.js';
      s.async = true;
      s.onload = () => { if (this._alive) this.initThree(); };
      document.head.appendChild(s);
    };
    const idle = () => (window.requestIdleCallback ? window.requestIdleCallback(start, { timeout: 1500 }) : setTimeout(start, 200));
    if (document.readyState === 'complete') idle();
    else window.addEventListener('load', idle, { once: true });
  }

  initThree() {
    if (this._three || this.props.threeD === false) return;
    this._three = true;
    const THREE = window.THREE, G = window.gsap, root = this.root;
    const canvas = root.querySelector('[data-three]');
    const host = root.querySelector('.tv-hero');
    if (!canvas || !host) return;
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' }); } catch (e) { return; }
    const reduce = (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) || this.props.motion === false;
    const weak = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, weak ? 1 : 1.5)); // plátno je přes celý úvod – plné 2× rozlišení zbytečně zatěžuje grafiku
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 200);
    camera.position.set(0, 0, 30);
    scene.add(new THREE.AmbientLight(0xffffff, 1.15));
    const key = new THREE.DirectionalLight(0xffffff, 2.6); key.position.set(6, 9, 12); scene.add(key);

    const grad = new THREE.DataTexture(new Uint8Array([115, 115, 115, 255, 195, 195, 195, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat);
    grad.minFilter = THREE.NearestFilter; grad.magFilter = THREE.NearestFilter; grad.needsUpdate = true;
    const toon = (o) => new THREE.MeshToonMaterial(Object.assign({ gradientMap: grad }, o));
    const outlineMat = new THREE.MeshBasicMaterial({ color: 0x3B2418, side: THREE.BackSide });
    const disposables = [grad, outlineMat];

    /* nášivka: vroubkovaný tvar, saténový nápis, obšitý okraj */
    const R = 2, N = 260;
    const scal = (a) => R * (1 + 0.045 * Math.cos(a * 12));
    const pts = [];
    for (let i = 0; i < N; i++) { const a = (i / N) * Math.PI * 2; const r = scal(a); pts.push(new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r)); }
    const depth = 0.24;
    const pGeo = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.05, bevelSegments: 4, curveSegments: 1 });
    pGeo.translate(0, 0, -depth / 2);
    const S = 1024, Rmax = R * 1.12, rPx = (R / (2 * Rmax)) * S;
    const colC = document.createElement('canvas'); colC.width = colC.height = S;
    const bumpC = document.createElement('canvas'); bumpC.width = bumpC.height = S;
    const map = new THREE.CanvasTexture(colC); map.colorSpace = THREE.SRGBColorSpace;
    const bmap = new THREE.CanvasTexture(bumpC);
    [map, bmap].forEach((t) => { t.repeat.set(1 / (2 * Rmax), 1 / (2 * Rmax)); t.offset.set(0.5, 0.5); t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); });
    const paint = () => { this.paintPatch(colC.getContext('2d'), S, rPx, false); this.paintPatch(bumpC.getContext('2d'), S, rPx, true); map.needsUpdate = true; bmap.needsUpdate = true; };
    paint();
    if (document.fonts && document.fonts.load) {
      Promise.all([document.fonts.load('400 100px Anton'), document.fonts.load('700 100px "Baloo 2"')]).then(() => { if (this._alive) paint(); }).catch(() => {});
    }
    const capMat = toon({ map, bumpMap: bmap, bumpScale: 1.4 });
    const sideMat = toon({ color: '#5E8FD6' });
    disposables.push(pGeo, map, bmap, capMat, sideMat);

    const eC = document.createElement('canvas'); eC.width = 64; eC.height = 64;
    const ex = eC.getContext('2d');
    ex.fillStyle = '#F5A8D3'; ex.fillRect(0, 0, 64, 64);
    ex.strokeStyle = '#D9709F'; ex.lineWidth = 7;
    for (let i = -64; i <= 128; i += 16) { ex.beginPath(); ex.moveTo(i, 64); ex.lineTo(i + 64, 0); ex.stroke(); }
    const eTex = new THREE.CanvasTexture(eC); eTex.colorSpace = THREE.SRGBColorSpace;
    eTex.wrapS = eTex.wrapT = THREE.RepeatWrapping; eTex.repeat.set(240, 1);
    const ePts = [];
    for (let i = 0; i < N; i += 2) { const a = (i / N) * Math.PI * 2; const r = scal(a) + 0.06; ePts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0)); }
    const eCurve = new THREE.CatmullRomCurve3(ePts, true);
    const eGeo = new THREE.TubeGeometry(eCurve, 720, 0.17, 12, true);
    const eoGeo = new THREE.TubeGeometry(eCurve, 360, 0.23, 10, true);
    const eMat = toon({ map: eTex, bumpMap: eTex, bumpScale: 1 });
    disposables.push(eTex, eGeo, eoGeo, eMat);

    const patchRoot = new THREE.Group();
    const spin = new THREE.Group();
    patchRoot.add(spin);
    spin.add(new THREE.Mesh(pGeo, [capMat, sideMat]));
    spin.add(new THREE.Mesh(eGeo, eMat));
    spin.add(new THREE.Mesh(eoGeo, outlineMat));
    scene.add(patchRoot);

    /* cívky */
    const thrC = document.createElement('canvas'); thrC.width = 8; thrC.height = 128;
    const tcx = thrC.getContext('2d');
    tcx.fillStyle = '#ffffff'; tcx.fillRect(0, 0, 8, 128);
    tcx.fillStyle = 'rgba(0,0,0,0.2)'; for (let y = 0; y < 128; y += 4) tcx.fillRect(0, y, 8, 1.4);
    const thrTex = new THREE.CanvasTexture(thrC); thrTex.colorSpace = THREE.SRGBColorSpace;
    thrTex.wrapS = thrTex.wrapT = THREE.RepeatWrapping; thrTex.repeat.set(1, 4);
    const bodyG = new THREE.CylinderGeometry(0.5, 0.5, 1.0, 40, 1, true);
    const flG = new THREE.CylinderGeometry(0.68, 0.68, 0.16, 40);
    const holeG = new THREE.CircleGeometry(0.16, 24);
    const woodMat = toon({ color: '#F2C28A' });
    const holeMat = new THREE.MeshBasicMaterial({ color: 0x3B2418 });
    disposables.push(thrTex, bodyG, flG, holeG, woodMat, holeMat);
    const mkSpool = (hex) => {
      const g = new THREE.Group();
      const bm = toon({ color: hex, map: thrTex, bumpMap: thrTex, bumpScale: 1 });
      disposables.push(bm);
      g.add(new THREE.Mesh(bodyG, bm));
      const bo = new THREE.Mesh(bodyG, outlineMat); bo.scale.set(1.1, 1, 1.1); g.add(bo);
      [0.58, -0.58].forEach((y) => {
        const fl = new THREE.Mesh(flG, woodMat); fl.position.y = y; g.add(fl);
        const fo = new THREE.Mesh(flG, outlineMat); fo.position.y = y; fo.scale.set(1.08, 1.45, 1.08); g.add(fo);
        const h = new THREE.Mesh(holeG, holeMat); h.rotation.x = y > 0 ? -Math.PI / 2 : Math.PI / 2; h.position.y = y + (y > 0 ? 0.082 : -0.082); g.add(h);
      });
      return g;
    };

    /* cívka u nášivky s nití, která se „dovyšije" */
    const buddy = mkSpool('#A6E6C9');
    buddy.position.set(3.0, -1.95, 0.9); buddy.rotation.set(0.5, 0, -0.35); buddy.scale.setScalar(0.95);
    spin.add(buddy);
    const tCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(2.55, -1.75, 1.05), new THREE.Vector3(1.95, -0.55, 1.6), new THREE.Vector3(2.75, 0.55, 1.75),
      new THREE.Vector3(3.35, -0.25, 1.25), new THREE.Vector3(2.6, -0.65, 0.95), new THREE.Vector3(1.8, -1.05, 0.5), new THREE.Vector3(1.45, -1.35, 0.22)
    ]);
    const tGeo = new THREE.TubeGeometry(tCurve, 160, 0.05, 8, false);
    const toGeo = new THREE.TubeGeometry(tCurve, 160, 0.085, 8, false);
    const tMat = toon({ color: '#A6E6C9' });
    disposables.push(tGeo, toGeo, tMat);
    spin.add(new THREE.Mesh(tGeo, tMat));
    spin.add(new THREE.Mesh(toGeo, outlineMat));
    const tCount = tGeo.index ? tGeo.index.count : 0;

    const COLORS = ['#F5A8D3', '#9CC3F3', '#A6E6C9', '#FFF6E2', '#F5A8D3'];
    const spools = COLORS.map((hex, i) => {
      const wrap = new THREE.Group();
      const inner = mkSpool(hex);
      wrap.add(inner); scene.add(wrap);
      return { wrap, inner, ph: i * 1.7, sp: 0.8 + (i % 3) * 0.25, rz: (i % 2 ? 0.5 : -0.4), depth: 1 };
    });
    const CFG_W = [{ fx: 0.94, fy: 0.07, s: 118, z: 1.5 }, { fx: 0.31, fy: 0.045, s: 72, z: -2 }, { fx: 0.5, fy: 0.5, s: 86, z: 0.5 }, { fx: 0.975, fy: 0.55, s: 96, z: 2 }, { fx: 0.43, fy: 0.8, s: 80, z: 1 }];
    const CFG_N = [{ fx: 0.88, fy: 0.035, s: 62, z: 1 }, { fx: 0.1, fy: 0.27, s: 46, z: -1 }, { fx: 0.92, fy: 0.5, s: 54, z: 1 }, { fx: 0.07, fy: 0.62, s: 56, z: 0.5 }, { fx: 0.9, fy: 0.87, s: 52, z: 1 }];

    const layout = () => {
      const hr = host.getBoundingClientRect();
      const w = hr.width, h = hr.height;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix();
      const visH = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
      const k = visH / h;
      const toW = (px, py) => [(px - w / 2) * k, -(py - h / 2) * k];
      const media = root.querySelector('.tv-hero__media');
      let px = w * 0.75, py = h * 0.62, rpx = 150;
      if (media) { const mr = media.getBoundingClientRect(); px = mr.left - hr.left + mr.width * 0.08; py = mr.top - hr.top + mr.height * 0.84; rpx = Math.max(76, Math.min(170, mr.width * 0.3)); }
      const P = toW(px, py);
      patchRoot.position.set(P[0], P[1], 1.5);
      patchRoot.scale.setScalar((rpx * k) / R);
      const cfg = w < 760 ? CFG_N : CFG_W;
      spools.forEach((s, i) => { const c = cfg[i]; const p = toW(c.fx * w, c.fy * h); s.wrap.position.set(p[0], p[1], c.z); s.wrap.scale.setScalar((c.s * k) / 1.3); s.depth = 1 + c.z * 0.3; });
    };
    layout();

    const st = { mx: 0, my: 0, tx: 0, ty: 0, p: 0, vis: true, intro: { s: 0, spin: -Math.PI * 1.6, thread: 0 } };
    const onMove = (e) => {
      const r = host.getBoundingClientRect();
      st.tx = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width - 0.5) * 2));
      st.ty = Math.max(-1, Math.min(1, ((e.clientY - r.top) / Math.min(r.height, window.innerHeight) - 0.5) * 2));
    };
    window.addEventListener('pointermove', onMove);

    if (G && !reduce) {
      G.to(st.intro, { s: 1, duration: 1.7, ease: 'elastic.out(1, 0.55)', delay: 0.55 });
      G.to(st.intro, { spin: 0, duration: 1.9, ease: 'power3.out', delay: 0.55 });
      G.to(st.intro, { thread: 1, duration: 2.4, ease: 'power2.inOut', delay: 1.4 });
      spools.forEach((s, i) => { s.inner.scale.setScalar(0.0001); G.to(s.inner.scale, { x: 1, y: 1, z: 1, duration: 1.2, ease: 'back.out(2.4)', delay: 0.8 + i * 0.12 }); });
    } else {
      st.intro.s = 1; st.intro.spin = 0; st.intro.thread = 1;
    }
    if (G && window.ScrollTrigger && this._live) {
      const trig = window.ScrollTrigger.create({ trigger: host, start: 'top top', end: 'bottom top', onUpdate: (self) => { st.p = self.progress; } });
      this._clean.push(() => trig.kill());
    }

    let io = null, ro = null;
    if (window.IntersectionObserver) { io = new IntersectionObserver((en) => { st.vis = en[0] ? en[0].isIntersecting : true; }); io.observe(host); }
    if (window.ResizeObserver) { ro = new ResizeObserver(() => layout()); ro.observe(host); }

    const clock = new THREE.Clock();
    const wob = reduce ? 0 : 1;
    const tick = () => {
      if (!this._alive) return;
      this._raf = requestAnimationFrame(tick);
      if (!st.vis) return;
      const t = clock.getElapsedTime();
      st.mx += (st.tx - st.mx) * 0.05; st.my += (st.ty - st.my) * 0.05;
      spin.scale.setScalar(Math.max(0.0001, st.intro.s));
      spin.rotation.y = st.intro.spin + st.mx * 0.6 + Math.sin(t * 0.7) * 0.16 * wob;
      spin.rotation.x = -st.my * 0.4 + Math.cos(t * 0.6) * 0.09 * wob;
      spin.rotation.z = Math.sin(t * 0.5) * 0.07 * wob - st.p * 0.9;
      spin.position.y = Math.sin(t * 1.3) * 0.12 * wob + st.p * 2.5;
      const n = Math.floor((st.intro.thread * tCount) / 48) * 48;
      tGeo.setDrawRange(0, n); toGeo.setDrawRange(0, n);
      spools.forEach((s) => {
        s.inner.position.x = st.mx * 0.7 * s.depth;
        s.inner.position.y = Math.sin(t * s.sp + s.ph) * 0.35 * wob - st.my * 0.45 * s.depth + st.p * (2.5 + s.depth * 2);
        s.inner.rotation.z = Math.sin(t * 0.8 + s.ph) * 0.45 * wob + s.rz;
        s.inner.rotation.x = 0.35 + Math.cos(t * 0.6 + s.ph) * 0.25 * wob;
        s.inner.rotation.y += 0.012 * wob;
      });
      renderer.render(scene, camera);
    };
    tick();

    this._clean.push(() => {
      cancelAnimationFrame(this._raf);
      window.removeEventListener('pointermove', onMove);
      if (io) io.disconnect();
      if (ro) ro.disconnect();
      disposables.forEach((d) => { try { d.dispose(); } catch (e) {} });
      renderer.dispose();
    });
  }
}

  function init() {
    var root = document.querySelector('.tv');
    if (!root) return;
    var app = new TopVysivka();
    app.root = root;
    app.componentDidMount();

    /* mobilní menu */
    var burger = root.querySelector('.tv-burger');
    var mnav = root.querySelector('#tv-mnav');
    if (burger && mnav) {
      var setMenu = function (open) { mnav.hidden = !open; burger.setAttribute('aria-expanded', String(open)); };
      burger.addEventListener('click', function () { setMenu(mnav.hidden); });
      mnav.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', function () { setMenu(false); }); });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setMenu(false); });
    }

    /* FAQ akordeon */
    root.querySelectorAll('.tv-qa__btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var qa = btn.closest('.tv-qa');
        var willOpen = !qa.classList.contains('tv-qa--open');
        root.querySelectorAll('.tv-qa').forEach(function (o) {
          o.classList.remove('tv-qa--open');
          o.querySelector('.tv-qa__btn').setAttribute('aria-expanded', 'false');
          o.querySelector('.tv-qa__a').hidden = true;
        });
        if (willOpen) {
          qa.classList.add('tv-qa--open');
          btn.setAttribute('aria-expanded', 'true');
          qa.querySelector('.tv-qa__a').hidden = false;
        }
      });
    });

    /* tlačítka u služeb předvyplní typ zakázky */
    root.querySelectorAll('[data-pick]').forEach(function (a) {
      a.addEventListener('click', function () {
        var r = root.querySelector('input[name="typ"][value="' + CSS.escape(a.getAttribute('data-pick')) + '"]');
        if (r) r.checked = true;
      });
    });

    /* formulář: přílohy (drag & drop, víc souborů, kontrola formátu a velikosti) */
    var form = root.querySelector('.tv-form');
    var sent = root.querySelector('.tv-sent');
    if (!form) return;
    var input = form.querySelector('#tv-f-files');
    var drop = form.querySelector('.tv-drop');
    var list = form.querySelector('.tv-files');
    var errEl = form.querySelector('.tv-form__error');
    var ALLOWED = ['ai', 'pdf', 'svg', 'png', 'jpg', 'jpeg'];
    var MAX = 10 * 1024 * 1024;
    var MAX_TOTAL = 25 * 1024 * 1024; /* stejné limity hlídá i src/worker.js */
    var MAX_FILES = 10;
    var started = Date.now();
    var telLink = root.querySelector('a[href^="tel:"]'); /* telefon z kontaktů (mění se v administraci) */
    var tel = telLink ? telLink.textContent.trim() : '';
    var files = [];
    var fmt = function (n) { var mb = n / 1048576; return mb >= 1 ? mb.toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round(n / 1024)) + ' kB'; };
    var problem = function (f) { var ext = (String(f.name).split('.').pop() || '').toLowerCase(); return f.size > MAX ? 'Víc než 10 MB' : (ALLOWED.indexOf(ext) < 0 ? 'Nepodporovaný formát' : ''); };
    var sync = function () { try { var dt = new DataTransfer(); files.forEach(function (f) { dt.items.add(f); }); input.files = dt.files; } catch (e) { /* starší prohlížeče */ } };
    var showError = function (msg) { errEl.textContent = msg; errEl.hidden = !msg; };
    var render = function () {
      list.innerHTML = '';
      files.forEach(function (f, i) {
        var bad = problem(f);
        var li = document.createElement('li'); li.className = 'tv-file' + (bad ? ' tv-file--bad' : '');
        var n = document.createElement('span'); n.className = 'tv-file__name'; n.textContent = f.name;
        var m = document.createElement('span'); m.className = 'tv-file__meta'; m.textContent = bad || fmt(f.size);
        var x = document.createElement('button'); x.type = 'button'; x.className = 'tv-file__x'; x.setAttribute('aria-label', 'Odebrat soubor ' + f.name);
        x.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"></path></svg>';
        x.addEventListener('click', function () { files.splice(i, 1); sync(); render(); });
        li.append(n, m, x); list.appendChild(li);
      });
      list.hidden = !files.length;
      showError('');
    };
    input.addEventListener('change', function () { files = files.concat(Array.prototype.slice.call(input.files || [])); sync(); render(); });
    ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('tv-drop--over'); }); });
    ['dragleave', 'dragend'].forEach(function (ev) { drop.addEventListener(ev, function () { drop.classList.remove('tv-drop--over'); }); });
    drop.addEventListener('drop', function (e) {
      e.preventDefault(); drop.classList.remove('tv-drop--over');
      files = files.concat(Array.prototype.slice.call((e.dataTransfer && e.dataTransfer.files) || [])); sync(); render();
    });

    /* odeslání */
    var done = function () { form.hidden = true; sent.hidden = false; app.celebrate(); };
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (form.elements.web && form.elements.web.value) return; /* anti-spam: bot vyplnil skryté pole */
      if (files.some(problem)) { showError('Některý soubor je moc velký nebo v nepodporovaném formátu. Odeberte ho prosím.'); return; }
      if (files.length > MAX_FILES) { showError('Najednou jde poslat max. ' + MAX_FILES + ' souborů.'); return; }
      if (files.reduce(function (s, f) { return s + f.size; }, 0) > MAX_TOTAL) { showError('Přílohy jsou dohromady moc velké (max. 25 MB). Větší soubory nám pošlete e-mailem.'); return; }
      if (!FORM_ENDPOINT) { done(); return; }
      var btn = form.querySelector('[type="submit"]');
      btn.disabled = true;
      /* přílohy bereme ze seznamu (drag & drop funguje i tam, kde nejde přepsat input.files) */
      var fd = new FormData(form);
      fd.delete(input.name);
      files.forEach(function (f) { fd.append(input.name, f, f.name); });
      fd.append('ts_ms', String(Date.now() - started));
      fetch(FORM_ENDPOINT, { method: 'POST', body: fd, headers: { Accept: 'application/json' } })
        .then(function (r) {
          return r.json().catch(function () { return {}; }).then(function (d) {
            if (!r.ok || !d.ok) { var err = new Error('HTTP ' + r.status); err.msg = d.error; throw err; }
            done();
          });
        })
        .catch(function (err) { showError((err && err.msg ? err.msg + ' ' : 'Odeslání se nepovedlo. ') + 'Zkuste to prosím znovu, nebo nám zavolejte' + (tel ? ' na ' + tel : '') + '.'); })
        .finally(function () { btn.disabled = false; });
    });
    var again = sent && sent.querySelector('[data-reset]');
    if (again) again.addEventListener('click', function () { form.reset(); files = []; sync(); render(); sent.hidden = true; form.hidden = false; });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
