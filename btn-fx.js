/* ── btn-fx.js  ·  entity button particle effects  ── */
(function () {
  'use strict';

  /* respect reduced-motion */
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  /* ── helpers ── */
  var rnd = function (min, max) { return Math.random() * (max - min) + min; };

  /* Read CSS custom property value from :root — auto day/night aware */
  var token = function (name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  };

  var spawn = function (btn, count, builder) {
    var rect = btn.getBoundingClientRect();
    var wrap = document.createElement('div');
    wrap.className = 'bfx-wrap';
    wrap.setAttribute('aria-hidden', 'true');
    Object.assign(wrap.style, {
      position: 'fixed',
      left: rect.left + 'px',
      top: rect.top + 'px',
      width: rect.width + 'px',
      height: rect.height + 'px',
      pointerEvents: 'none',
      zIndex: '99990',
      overflow: 'visible'
    });
    for (var i = 0; i < count; i++) {
      var p = document.createElement('span');
      p.className = 'bfx-p';
      Object.assign(p.style, {
        position: 'absolute',
        pointerEvents: 'none',
        display: 'block',
        willChange: 'transform, opacity'
      });
      builder(p, i, count, rect);
      wrap.appendChild(p);
      p.addEventListener('animationend', function () { this.remove(); });
    }
    document.body.appendChild(wrap);
    setTimeout(function () { if (wrap.parentNode) wrap.remove(); }, 2400);
  };

  /* ── CSS keyframes (injected once) ── */
  var style = document.createElement('style');
  style.textContent = [
    /* entity shatter — radial burst of angular fragments */
    '@keyframes bfx-shatter{0%{opacity:1;transform:translate(0,0) rotate(0deg) scale(0)}25%{opacity:1;transform:translate(calc(var(--bfx-dx)*0.5),calc(var(--bfx-dy)*0.5)) rotate(calc(var(--bfx-rot)*0.4)) scale(1)}100%{opacity:0;transform:translate(calc(var(--bfx-dx)*1.8),calc(var(--bfx-dy)*1.8 + 6px)) rotate(var(--bfx-rot)) scale(0.2)}}',
    /* entity drift — slow upward float with subtle rotation */
    '@keyframes bfx-drift{0%{opacity:0.8;transform:translateY(0) rotate(0deg) scale(0.5)}40%{opacity:0.9;transform:translateY(-12px) rotate(var(--bfx-rot)) scale(1)}100%{opacity:0;transform:translateY(-30px) rotate(calc(var(--bfx-rot)*1.5)) scale(0.3)}}',
    /* entity pulse — quick scale flash */
    '@keyframes bfx-pulse{0%{opacity:0.9;transform:scale(0.3)}30%{opacity:1;transform:scale(1.1)}100%{opacity:0;transform:scale(0.6)}}',
    /* legacy effects kept for non-CTA buttons */
    '@keyframes bfx-heart{0%{opacity:1;transform:translateY(0) scale(.6)}50%{opacity:1}100%{opacity:0;transform:translateY(-48px) scale(1.15)}}',
    '@keyframes bfx-crumble{0%{opacity:.9;transform:translateY(0) rotate(0deg)}100%{opacity:0;transform:translateY(22px) rotate(var(--bfx-rot,40deg))}}',
    '@keyframes bfx-smoke{0%{opacity:.5;transform:translate(0,0) scale(.5)}100%{opacity:0;transform:translate(var(--bfx-dx,6px),-28px) scale(1.4)}}',
    '@keyframes bfx-spin{0%{opacity:.8;transform:rotate(0deg) scale(.7)}60%{opacity:1;transform:rotate(270deg) scale(1)}100%{opacity:0;transform:rotate(360deg) scale(.5)}}'
  ].join('\n');
  document.head.appendChild(style);

  /* helper: build animation shorthand with "both" fill-mode for correct delay handling */
  function anim(name, dur, easing, delay) {
    return name + ' ' + dur + 's ' + easing + ' ' + delay + 's both';
  }

  /* ── entity fragment pool — angular, architectural ── */
  var entityGlyphs = ['▪', '▫', '▴', '▾', '◂', '▸', '◆', '◇', '▬', '┃'];

  /* ── effect builders ── */

  var effects = {

    /* ── ENTITY: unified shatter for main CTAs ── */
    shatter: function (btn) {
      var accent = token('--c-accent');
      var text = token('--c-text');
      var colors = [accent, accent, text, accent, accent, text];
      spawn(btn, 7, function (p, i, n, rect) {
        p.textContent = entityGlyphs[Math.floor(rnd(0, entityGlyphs.length))];
        var angle = (i / n) * Math.PI * 2 + rnd(-0.3, 0.3);
        var dist = rnd(16, 32);
        p.style.setProperty('--bfx-dx', (Math.cos(angle) * dist).toFixed(1) + 'px');
        p.style.setProperty('--bfx-dy', (Math.sin(angle) * dist * -1).toFixed(1) + 'px');
        p.style.setProperty('--bfx-rot', rnd(60, 280).toFixed(0) + 'deg');
        Object.assign(p.style, {
          fontSize: rnd(5, 9) + 'px',
          color: colors[i % colors.length],
          left: (rect.width / 2) + 'px',
          top: (rect.height / 2) + 'px',
          animation: anim('bfx-shatter', rnd(0.5, 0.85), 'cubic-bezier(.22,1,.36,1)', i * 0.025)
        });
      });
    },

    /* ── ENTITY: subtle drift for hover on CTAs ── */
    drift: function (btn) {
      var accent = token('--c-accent');
      spawn(btn, 4, function (p, i, n, rect) {
        p.textContent = entityGlyphs[Math.floor(rnd(0, entityGlyphs.length))];
        p.style.setProperty('--bfx-rot', rnd(20, 120).toFixed(0) + 'deg');
        Object.assign(p.style, {
          fontSize: rnd(5, 8) + 'px',
          color: accent,
          opacity: '0.7',
          left: rnd(8, rect.width - 8) + 'px',
          top: rnd(0, rect.height * 0.3) + 'px',
          animation: anim('bfx-drift', rnd(0.55, 0.85), 'ease-out', i * 0.06)
        });
      });
    },

    /* ── non-CTA effects (kept but refined) ── */

    hearts: function (btn) {
      spawn(btn, 6, function (p, i, n, rect) {
        p.textContent = '♥';
        Object.assign(p.style, {
          fontSize: rnd(10, 15) + 'px',
          color: token('--c-accent'),
          left: rnd(10, rect.width - 10) + 'px',
          top: rnd(-4, rect.height * 0.4) + 'px',
          animation: anim('bfx-heart', rnd(0.6, 1.0), 'cubic-bezier(.34,1.56,.64,1)', i * 0.06)
        });
      });
    },

    crumble: function (btn) {
      spawn(btn, 6, function (p, i, n, rect) {
        p.textContent = '×';
        p.style.setProperty('--bfx-rot', rnd(-60, 60) + 'deg');
        Object.assign(p.style, {
          fontSize: rnd(8, 12) + 'px',
          fontWeight: '300',
          color: 'rgba(255,60,60,' + rnd(0.45, 0.8).toFixed(2) + ')',
          left: rnd(4, rect.width - 4) + 'px',
          top: rnd(rect.height * 0.4, rect.height) + 'px',
          animation: anim('bfx-crumble', rnd(0.5, 0.9), 'ease-in', i * 0.05)
        });
      });
    },

    smoke: function (btn) {
      spawn(btn, 5, function (p, i, n, rect) {
        p.textContent = '~';
        p.style.setProperty('--bfx-dx', rnd(-14, 14) + 'px');
        Object.assign(p.style, {
          fontSize: rnd(10, 16) + 'px',
          fontWeight: '300',
          color: token('--c-text-tertiary'),
          left: rnd(6, rect.width - 6) + 'px',
          top: rnd(-2, rect.height * 0.3) + 'px',
          animation: anim('bfx-smoke', rnd(0.6, 1.1), 'ease-out', i * 0.09)
        });
      });
    },

    spin: function (btn) {
      spawn(btn, 5, function (p, i, n, rect) {
        p.textContent = '↻';
        Object.assign(p.style, {
          fontSize: rnd(9, 14) + 'px',
          color: token('--c-text-tertiary'),
          left: rnd(6, rect.width - 6) + 'px',
          top: rnd(2, rect.height * 0.6) + 'px',
          animation: anim('bfx-spin', rnd(0.6, 1.0), 'ease-out', i * 0.07)
        });
      });
    }
  };

  /* ── throttle helper ── */
  var cooldowns = new WeakMap();
  function throttled(btn, fx, cooldownMs) {
    var last = cooldowns.get(btn) || 0;
    if (Date.now() - last < (cooldownMs || 600)) return;
    cooldowns.set(btn, Date.now());
    fx(btn);
  }

  /* ── bind helpers ── */
  function bindHover(selector, fxName) {
    document.querySelectorAll(selector).forEach(function (btn) {
      btn.addEventListener('mouseenter', function () {
        throttled(btn, effects[fxName], 700);
      });
    });
  }

  function bindClick(selector, fxName, filterFn) {
    document.querySelectorAll(selector).forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (filterFn && !filterFn(btn)) return;
        throttled(btn, effects[fxName], 400);
      });
    });
  }

  function delegateClick(parentSel, childSel, fxName, filterFn) {
    var parent = document.querySelector(parentSel) || document.body;
    parent.addEventListener('click', function (e) {
      var btn = e.target.closest(childSel);
      if (!btn) return;
      if (filterFn && !filterFn(btn)) return;
      throttled(btn, effects[fxName], 400);
    });
  }

  function delegateHover(parentSel, childSel, fxName) {
    var parent = document.querySelector(parentSel) || document.body;
    parent.addEventListener('mouseover', function (e) {
      var btn = e.target.closest(childSel);
      if (!btn || btn._bfxHovered) return;
      btn._bfxHovered = true;
      throttled(btn, effects[fxName], 700);
      btn.addEventListener('mouseleave', function () { btn._bfxHovered = false; }, { once: true });
    });
  }

  /* ── auto-init ── */
  function init() {
    /* ── Main CTA buttons: entity shatter on click, drift on hover ── */
    delegateHover('body', '.btn-upgrade', 'drift');
    delegateHover('body', '.btn-inq-fill', 'drift');
    delegateHover('body', '.btn-access', 'drift');
    bindClick('.btn-join', 'shatter');
    bindClick('.btn-send', 'shatter');
    bindClick('.fb-submit', 'shatter');
    bindClick('.btn-access', 'shatter');
    bindClick('.btn-upgrade', 'shatter');
    delegateClick('body', '.btn-inq-fill', 'shatter');

    /* ── Semantic non-CTA buttons: keep distinct effects ── */
    delegateClick('body', '.btn-fav', 'hearts');
    bindHover('#btn-destroy, .btn-destroy', 'crumble');
    bindHover('#btn-signout, .btn-signout', 'smoke');
    bindHover('.btn-accept', 'drift');
    bindHover('.btn-restart', 'spin');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
