/* ── [aRTS] i18n — German default, English switchable ──
   Reads localStorage('arts_lang'), defaults to 'de'.
   Loads lang/de.json or lang/en.json, applies to DOM via data-i18n attributes.
   Include via <script src="i18n.js"></script> after theme.js on any page. */

(function () {
  var KEY  = 'arts_lang';
  var DEF  = 'de';
  var _strings = {};
  var _lang = '';
  var _cbs  = [];

  /* ── Read lang early ── */
  function getLang() {
    try { return localStorage.getItem(KEY) || DEF; } catch (e) { return DEF; }
  }
  _lang = getLang();
  document.documentElement.lang = _lang;

  /* ── Load JSON ── */
  function load(lang, cb) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', (window._artsBase || '') + 'lang/' + lang + '.json?v=1', true);
    xhr.onload = function () {
      if (xhr.status === 200) {
        try { _strings = JSON.parse(xhr.responseText); } catch (e) { _strings = {}; }
        _lang = lang;
        cb();
      }
    };
    xhr.onerror = function () { cb(); };
    xhr.send();
  }

  /* ── Translate ── */
  function t(key) { return _strings[key] || key; }

  /* ── Brand caps helper: "Boutique" → "bOUTIQUE" ── */
  function caps(s) {
    if (!s || s.length < 2) return s;
    return s.charAt(0).toLowerCase() + s.slice(1).toUpperCase();
  }

  /* ── Apply translations to DOM ── */
  function applyDOM() {
    /* data-i18n → textContent */
    var els = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < els.length; i++) {
      var k = els[i].getAttribute('data-i18n');
      if (_strings[k]) els[i].textContent = _strings[k];
    }

    /* data-i18n-html → innerHTML */
    els = document.querySelectorAll('[data-i18n-html]');
    for (var j = 0; j < els.length; j++) {
      var k2 = els[j].getAttribute('data-i18n-html');
      if (_strings[k2]) els[j].innerHTML = _strings[k2];
    }

    /* Attribute translations */
    var attrs = ['placeholder', 'aria-label', 'alt', 'title'];
    for (var a = 0; a < attrs.length; a++) {
      var attr = attrs[a];
      var sel = '[data-i18n-' + attr + ']';
      var aEls = document.querySelectorAll(sel);
      for (var b = 0; b < aEls.length; b++) {
        var k3 = aEls[b].getAttribute('data-i18n-' + attr);
        if (_strings[k3]) aEls[b].setAttribute(attr, _strings[k3]);
      }
    }

    /* Update theme toggle label */
    var themeBtn = document.getElementById('corner-theme-item');
    if (themeBtn) {
      var isDay = document.documentElement.getAttribute('data-theme') === 'day';
      themeBtn.innerHTML = isDay
        ? '&#9789;&thinsp;' + t('theme.night')
        : '&#9788;&thinsp;' + t('theme.day');
    }

    /* Update language toggle label */
    var langBtn = document.getElementById('corner-lang');
    if (langBtn) {
      langBtn.textContent = _lang === 'de'
        ? '\uD83C\uDDEC\uD83C\uDDE7 ' + t('lang.toggle.en')
        : '\uD83C\uDDE9\uD83C\uDDEA ' + t('lang.toggle.de');
    }
  }

  /* ── Switch language ── */
  function setLang(lang) {
    try { localStorage.setItem(KEY, lang); } catch (e) {}
    load(lang, function () {
      document.documentElement.lang = lang;
      applyDOM();
      for (var i = 0; i < _cbs.length; i++) _cbs[i](lang);
    });
  }

  /* ── Callback registry for JS-rendered content ── */
  function onLangChange(fn) { _cbs.push(fn); }

  /* ── Public API ── */
  window.artsI18n = {
    t: t,
    lang: function () { return _lang; },
    setLang: setLang,
    applyDOM: applyDOM,
    onLangChange: onLangChange,
    caps: caps
  };

  /* ── Add language toggle to corner menu ── */
  if (window.artsCornerAdd) {
    window.artsCornerAdd({
      label: _lang === 'de'
        ? '\uD83C\uDDEC\uD83C\uDDE7 eNGLISH'
        : '\uD83C\uDDE9\uD83C\uDDEA dEUTSCH',
      id: 'corner-lang',
      action: function () {
        var next = artsI18n.lang() === 'de' ? 'en' : 'de';
        artsI18n.setLang(next);
      }
    });
  }

  /* ── Init ── */
  function init() {
    load(_lang, function () {
      applyDOM();
      /* Re-apply to catch any late-rendered DOM elements */
      setTimeout(applyDOM, 120);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* Final safety net: re-apply once the page is fully loaded (images, styles, etc.) */
  window.addEventListener('load', function () {
    if (_lang !== DEF) setTimeout(applyDOM, 50);
  });
})();
