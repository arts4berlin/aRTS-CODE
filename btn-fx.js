/* ── btn-fx.js  ·  thematic button particle effects  ── */
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
    '@keyframes bfx-heart{0%{opacity:1;transform:translateY(0) scale(.6)}50%{opacity:1}100%{opacity:0;transform:translateY(-48px) scale(1.15)}}',
    '@keyframes bfx-bubble{0%{opacity:1;transform:translateY(0) scale(.6)}50%{opacity:.85}100%{opacity:0;transform:translateY(-44px) scale(1.1)}}',
    '@keyframes bfx-plane{0%{opacity:1;transform:translate(0,0) rotate(-20deg) scale(.7)}100%{opacity:0;transform:translate(28px,-34px) rotate(10deg) scale(.5)}}',
    '@keyframes bfx-crumble{0%{opacity:.9;transform:translateY(0) rotate(0deg)}100%{opacity:0;transform:translateY(22px) rotate(var(--bfx-rot,40deg))}}',
    '@keyframes bfx-smoke{0%{opacity:.5;transform:translate(0,0) scale(.5)}100%{opacity:0;transform:translate(var(--bfx-dx,6px),-28px) scale(1.4)}}',
    '@keyframes bfx-sparkle{0%{opacity:1;transform:translateY(0) scale(.5) rotate(0deg)}50%{opacity:1;transform:translateY(-16px) scale(1) rotate(90deg)}100%{opacity:0;transform:translateY(-32px) scale(.3) rotate(180deg)}}',
    '@keyframes bfx-confetti{0%{opacity:1;transform:translate(0,0) rotate(0deg) scale(0)}30%{opacity:1;transform:translate(var(--bfx-dx,10px),var(--bfx-dy,-10px)) rotate(var(--bfx-rot,90deg)) scale(1)}100%{opacity:0;transform:translate(calc(var(--bfx-dx,10px)*2.2),calc(var(--bfx-dy,-10px)*2.2 + 12px)) rotate(calc(var(--bfx-rot,90deg)*2)) scale(.4)}}',
    '@keyframes bfx-star{0%{opacity:1;transform:translateY(0) scale(.4) rotate(0deg)}40%{opacity:1}100%{opacity:0;transform:translateY(-36px) scale(.9) rotate(120deg)}}',
    '@keyframes bfx-zap{0%{opacity:1;transform:scaleY(.3) translateY(0)}20%{opacity:1;transform:scaleY(1) translateY(-4px)}60%{opacity:.7;transform:scaleY(.6) translateY(-8px)}100%{opacity:0;transform:scaleY(.2) translateY(-16px)}}',
    '@keyframes bfx-spin{0%{opacity:.8;transform:rotate(0deg) scale(.7)}60%{opacity:1;transform:rotate(270deg) scale(1)}100%{opacity:0;transform:rotate(360deg) scale(.5)}}'
  ].join('\n');
  document.head.appendChild(style);

  /* helper: build animation shorthand with "both" fill-mode for correct delay handling */
  function anim(name, dur, easing, delay) {
    return name + ' ' + dur + 's ' + easing + ' ' + delay + 's both';
  }

  /* ── effect builders ── */

  var effects = {

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

    bubbles: function (btn) {
      spawn(btn, 6, function (p, i, n, rect) {
        p.textContent = ['·','··','·'][i % 3];
        Object.assign(p.style, {
          fontSize: rnd(16, 24) + 'px',
          fontWeight: '700',
          color: token('--c-text-secondary'),
          left: rnd(8, rect.width - 8) + 'px',
          top: rnd(-6, rect.height * 0.2) + 'px',
          animation: anim('bfx-bubble', rnd(0.6, 1.0), 'ease-out', i * 0.07)
        });
      });
    },

    planes: function (btn) {
      spawn(btn, 5, function (p, i, n, rect) {
        p.textContent = '▸';
        Object.assign(p.style, {
          fontSize: rnd(9, 13) + 'px',
          color: token('--c-accent'),
          left: rnd(rect.width * 0.3, rect.width * 0.8) + 'px',
          top: rnd(rect.height * 0.1, rect.height * 0.6) + 'px',
          animation: anim('bfx-plane', rnd(0.55, 0.9), 'ease-out', i * 0.08)
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

    sparkle: function (btn) {
      var chars = ['✦', '◇', '✧'];
      spawn(btn, 6, function (p, i, n, rect) {
        p.textContent = chars[i % chars.length];
        Object.assign(p.style, {
          fontSize: rnd(8, 13) + 'px',
          color: token('--c-accent'),
          left: rnd(4, rect.width - 4) + 'px',
          top: rnd(-2, rect.height * 0.5) + 'px',
          animation: anim('bfx-sparkle', rnd(0.6, 1.0), 'ease-out', i * 0.07)
        });
      });
    },

    confetti: function (btn) {
      var accent = token('--c-accent');
      var text = token('--c-text');
      var colors = [accent, text, accent, text, accent];
      spawn(btn, 8, function (p, i, n, rect) {
        p.textContent = ['■', '●', '▲', '◆'][i % 4];
        var angle = (i / n) * Math.PI * 2;
        var dist = rnd(14, 28);
        p.style.setProperty('--bfx-dx', (Math.cos(angle) * dist).toFixed(1) + 'px');
        p.style.setProperty('--bfx-dy', (Math.sin(angle) * dist * -1).toFixed(1) + 'px');
        p.style.setProperty('--bfx-rot', rnd(40, 200).toFixed(0) + 'deg');
        Object.assign(p.style, {
          fontSize: rnd(6, 10) + 'px',
          color: colors[i % colors.length],
          left: (rect.width / 2) + 'px',
          top: (rect.height / 2) + 'px',
          animation: anim('bfx-confetti', rnd(0.55, 0.9), 'cubic-bezier(.34,1.56,.64,1)', i * 0.03)
        });
      });
    },

    stars: function (btn) {
      spawn(btn, 6, function (p, i, n, rect) {
        p.textContent = '★';
        Object.assign(p.style, {
          fontSize: rnd(8, 13) + 'px',
          color: token('--c-accent'),
          left: rnd(6, rect.width - 6) + 'px',
          top: rnd(-2, rect.height * 0.4) + 'px',
          animation: anim('bfx-star', rnd(0.5, 0.9), 'ease-out', i * 0.06)
        });
      });
    },

    zap: function (btn) {
      spawn(btn, 6, function (p, i, n, rect) {
        p.textContent = '⚡';
        Object.assign(p.style, {
          fontSize: rnd(9, 14) + 'px',
          color: token('--c-accent'),
          left: rnd(4, rect.width - 4) + 'px',
          top: rnd(0, rect.height * 0.5) + 'px',
          animation: anim('bfx-zap', rnd(0.3, 0.6), 'ease-out', i * 0.04)
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
    delegateClick('body', '.btn-fav', 'hearts');
    delegateHover('body', '.btn-inq-fill', 'bubbles');
    bindClick('.btn-send', 'planes');
    bindHover('#btn-destroy, .btn-destroy', 'crumble');
    bindHover('#btn-signout, .btn-signout', 'smoke');
    bindHover('.btn-upgrade', 'sparkle');
    bindClick('.btn-join', 'confetti');
    bindClick('.fb-submit', 'stars');
    bindHover('.btn-accept', 'zap');
    bindHover('.btn-restart', 'spin');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
