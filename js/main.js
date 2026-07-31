/* Urban Pure. Page behaviour.
   Everything here is an enhancement: with JS off the nav is real anchors, every
   phone/WhatsApp/Maps link works, and nothing is hidden. */

(function () {
  'use strict';

  var $  = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var clamp = function (n, lo, hi) { return n < lo ? lo : (n > hi ? hi : n); };

  var still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var canObserve = !still && 'IntersectionObserver' in window;
  var root = document.documentElement;

  /* ── Product art: never leave an empty box ─────────────────────────────── */

  $$('.tile__art').forEach(function (art) {
    var img = $('img', art);
    if (!img) { return; }
    var blank = function () { art.setAttribute('data-empty', 'true'); img.hidden = true; };
    if (!img.getAttribute('src')) { blank(); return; }
    img.addEventListener('error', blank);
    if (img.complete && img.naturalWidth === 0) { blank(); }
  });

  /* ── Drawer ────────────────────────────────────────────────────────────── */

  var bar = $('#bar');
  var drawer = $('#drawer'), openBtn = $('#drawer-open'), shutBtn = $('#drawer-close');

  if (drawer && openBtn && shutBtn) {
    var panel = $('.drawer__panel', drawer);

    var setDrawer = function (open) {
      drawer.setAttribute('data-open', open ? 'true' : 'false');
      openBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      document.body.style.overflow = open ? 'hidden' : '';
      (open ? shutBtn : openBtn).focus();
    };

    openBtn.addEventListener('click', function () { setDrawer(true); });
    shutBtn.addEventListener('click', function () { setDrawer(false); });
    $$('a', drawer).forEach(function (a) { a.addEventListener('click', function () { setDrawer(false); }); });

    document.addEventListener('keydown', function (e) {
      if (drawer.getAttribute('data-open') !== 'true') { return; }
      if (e.key === 'Escape') { setDrawer(false); return; }
      if (e.key !== 'Tab') { return; }

      var stops = $$('a[href], button', panel);
      if (!stops.length) { return; }
      var first = stops[0], last = stops[stops.length - 1];

      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
  }

  /* ── Scroll reveal ─────────────────────────────────────────────────────── */

  [$('#product-grid'), $('#reason-grid')].forEach(function (group) {
    if (!group || !canObserve) { return; }

    var kids = $$(':scope > *', group);
    kids.forEach(function (k) { k.classList.add('reveal'); });
    group.classList.add('armed');

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) { return; }
        e.target.style.transitionDelay = Math.min(6, kids.indexOf(e.target)) * 65 + 'ms';
        e.target.classList.add('in');
        io.unobserve(e.target);
      });
    }, { threshold: .08, rootMargin: '0px 0px -40px' });

    kids.forEach(function (k) { io.observe(k); });

    /* A stalled observer must never leave a section blank. */
    setTimeout(function () { kids.forEach(function (k) { k.classList.add('in'); }); }, 2500);
  });

  /* ── Scroll state ──────────────────────────────────────────────────────── */

  var visit = $('#visit');
  var stages = $$('.stack .stage[data-stage]');
  var queued = false;

  function measure() {
    var vh = window.innerHeight || 1;
    var y = window.pageYOffset || root.scrollTop || 0;
    var span = Math.max(1, root.scrollHeight - vh);
    var p = clamp(y / span, 0, 1);

    var warmth = 0;
    if (visit) {
      var top = visit.getBoundingClientRect().top + y;
      warmth = clamp((y + vh * 0.9 - top) / (vh * 0.7), 0, 1);
    }
    var depth = clamp(p / 0.55, 0, 1) * (1 - warmth * 0.6);

    root.style.setProperty('--depth', depth.toFixed(3));
    root.style.setProperty('--warmth', warmth.toFixed(3));
    if (window.UPCaustics) { window.UPCaustics.setLight(depth, warmth); }

    if (bar) { bar.setAttribute('data-stuck', y > 24 ? 'true' : 'false'); }

    /* The stack fills left to right as the panel comes into view. */
    if (stages.length) {
      var mid = vh * 0.62;
      var reached = -1;
      for (var i = 0; i < stages.length; i++) {
        if (stages[i].getBoundingClientRect().top <= mid) { reached = i; }
      }
      for (var j = 0; j < stages.length; j++) {
        stages[j].setAttribute('data-on', j <= reached ? 'true' : 'false');
      }
    }
  }

  function onScroll() {
    if (queued) { return; }
    queued = true;
    requestAnimationFrame(function () { queued = false; measure(); });
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', measure);
  measure();

  /* ── Hero shot ───────────────────────────────────────────────────────────
     The campaign image is supplied separately. Until the file is dropped into
     assets/img, hide the element rather than let the browser draw its broken
     image placeholder in the middle of the hero. */

  var shot = document.getElementById('hero-shot');
  var showcase = document.getElementById('hero-showcase');
  if (shot && showcase) {
    var drop = function () { showcase.style.visibility = 'hidden'; };
    var keep = function () { showcase.style.visibility = ''; };
    shot.addEventListener('error', drop);
    shot.addEventListener('load', keep);
    if (shot.complete) { (shot.naturalWidth === 0 ? drop : keep)(); }
  }

}());
