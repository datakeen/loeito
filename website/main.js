/* Loeito website. SPDX-License-Identifier: AGPL-3.0-or-later. Small, calm motion; everything still works without it. */
(() => {
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // the nav gets a hairline once you scroll
  const nav = $('.nav'); const onScroll = () => nav.classList.toggle('scrolled', scrollY > 8);
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

  // name the visitor's system in the download line
  const ua = navigator.userAgent, os = /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'macOS' : /Linux/.test(ua) && !/Android/.test(ua) ? 'Linux' : null;
  if (os) $$('[data-goatcounter-click^="download"]').forEach(a => { if (a.textContent.trim() === 'Download free') a.lastChild.textContent = ` Download for ${os}`; });

  // reveal on scroll, with a small stagger inside a group
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.15 });
  $$('.reveal').forEach(el => { const sib = [...el.parentElement.children].indexOf(el); el.style.setProperty('--d', (sib % 6) * 60 + 'ms'); io.observe(el); });

  if (!still) {
    // the hero light follows the pointer; the screenshot straightens and the floating pages merge as you scroll
    const hero = $('.hero'), shot = $('.hero-shot .window');
    hero.addEventListener('pointermove', e => { const r = hero.getBoundingClientRect(); hero.style.setProperty('--mx', (e.clientX - r.left) + 'px'); hero.style.setProperty('--my', (e.clientY - r.top) + 'px'); });
    const tilt = () => {
      const r = shot.getBoundingClientRect(), t = Math.min(1, Math.max(0, 1 - (r.top - innerHeight * 0.25) / (innerHeight * 0.6)));
      shot.style.setProperty('--tilt', (14 * (1 - t)).toFixed(2) + 'deg'); shot.style.setProperty('--sc', (0.94 + 0.06 * t).toFixed(3));
      hero.classList.toggle('merged', scrollY > innerHeight * 0.18);
    };
    addEventListener('scroll', tilt, { passive: true }); tilt();
  }

  // before and after
  const cmp = $('#compare'), range = $('#compare-range');
  if (cmp && range) {
    const set = v => cmp.style.setProperty('--pos', v + '%');
    range.addEventListener('input', () => set(range.value));
    const img = cmp.querySelector('img'); const ratio = () => img.naturalWidth && cmp.style.setProperty('--ratio', img.naturalWidth / img.naturalHeight);
    img.complete ? ratio() : img.addEventListener('load', ratio);
    // a gentle sweep the first time it comes into view, so people know it moves
    const seen = new IntersectionObserver(es => { if (!es[0].isIntersecting) return; seen.disconnect(); cmp.classList.add('hint');
      if (still) return; let t0 = null; const go = ts => { t0 ??= ts; const k = Math.min(1, (ts - t0) / 1600), v = 50 + 28 * Math.sin(k * Math.PI * 2) * (1 - k); set(v); range.value = v; if (k < 1) requestAnimationFrame(go); }; requestAnimationFrame(go); }, { threshold: 0.5 });
    seen.observe(cmp);
  }

  // gallery tabs (arrow keys move between them)
  const tabs = $$('.tabs [role=tab]'), gimg = $('#gallery-img');
  const pick = b => {
    tabs.forEach(t => t.setAttribute('aria-selected', String(t === b)));
    gimg.classList.add('fading');
    const next = new Image(); next.src = `img/${b.dataset.shot}-1600.webp`;
    next.onload = () => { gimg.src = next.src; gimg.alt = `Loeito: ${b.textContent}`; gimg.classList.remove('fading'); };
  };
  tabs.forEach((b, i) => {
    b.addEventListener('click', () => pick(b));
    b.addEventListener('keydown', e => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { const n = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length]; n.focus(); pick(n); } });
  });

  // the padlock closes when you reach it
  const lock = $('.lock'); if (lock) new IntersectionObserver((es, o) => { if (es[0].isIntersecting) { lock.classList.add('in'); o.disconnect(); } }, { threshold: 0.6 }).observe(lock);
})();
