/* ── [aRTS] Day/Night theme toggle ──
   Toggles `data-theme="day"` on <html>.
   All CSS overrides live in styles.css via custom properties.
   Persists choice in localStorage('arts_theme').
   Include via <script src="theme.js"></script> on any page. */

(function () {
  var KEY = 'arts_theme';
  var DAY = 'day';

  function isDayMode() {
    return localStorage.getItem(KEY) === DAY;
  }

  /* ── Apply theme: sets attribute + forces inline bg ── */
  function applyTheme(day) {
    var html = document.documentElement;
    if (day) {
      html.setAttribute('data-theme', DAY);
      html.style.setProperty('background', '#fff', 'important');
      if (document.body) document.body.style.setProperty('background', '#fff', 'important');
    } else {
      html.removeAttribute('data-theme');
      html.style.setProperty('background', '#000', 'important');
      if (document.body) document.body.style.setProperty('background', '#000', 'important');
    }
    /* Update toggle icon */
    var btn = document.getElementById('corner-theme-item');
    if (btn) btn.innerHTML = day ? '&#9789;&thinsp;nIGHT' : '&#9788;&thinsp;dAY';
  }

  /* ── Apply immediately (before DOM ready) ── */
  applyTheme(isDayMode());

  /* ── Corner menu ── */
  var _cornerQueue = [];
  var _panel = null;

  function _closePanel() {
    if (_panel) _panel.classList.remove('open');
    var t = document.getElementById('corner-trigger');
    if (t) t.classList.remove('open');
  }

  function _makeItem(cfg) {
    var el = cfg.href ? document.createElement('a') : document.createElement('button');
    el.className = 'corner-item';
    if (cfg.id) el.id = cfg.id;
    if (cfg.href) el.href = cfg.href;
    el.innerHTML = cfg.label;
    el.addEventListener('click', function (e) {
      e.stopPropagation();
      _closePanel();
      if (cfg.action) cfg.action();
    });
    return el;
  }

  /* Public API — usable before or after DOM ready */
  window.artsCornerAdd = function (cfg) {
    if (_panel) {
      _panel.appendChild(_makeItem(cfg));
    } else {
      _cornerQueue.push(cfg);
    }
  };

  /* ── Inject corner menu after DOM ready ── */
  function init() {
    applyTheme(isDayMode());

    /* Panel */
    _panel = document.createElement('div');
    _panel.id = 'corner-panel';

    /* Theme item — always first */
    var themeItem = document.createElement('button');
    themeItem.className = 'corner-item';
    themeItem.id = 'corner-theme-item';
    themeItem.innerHTML = isDayMode() ? '&#9789;&thinsp;nIGHT' : '&#9788;&thinsp;dAY';
    themeItem.addEventListener('click', function (e) {
      e.stopPropagation();
      var next = !isDayMode();
      localStorage.setItem(KEY, next ? DAY : '');
      applyTheme(next);
    });
    _panel.appendChild(themeItem);

    /* Flush any queued items from other scripts */
    _cornerQueue.forEach(function (cfg) { _panel.appendChild(_makeItem(cfg)); });
    _cornerQueue = [];

    /* Trigger button */
    var trigger = document.createElement('button');
    trigger.id = 'corner-trigger';
    trigger.setAttribute('aria-label', 'Menu');
    trigger.innerHTML = '&middot;&thinsp;&middot;&thinsp;&middot;';
    trigger.addEventListener('click', function (e) {
      e.stopPropagation();
      var isOpen = _panel.classList.toggle('open');
      trigger.classList.toggle('open', isOpen);
    });

    /* Close on outside click */
    document.addEventListener('click', _closePanel);

    document.body.appendChild(_panel);
    document.body.appendChild(trigger);

    /* ── Logo wink on click ── */
    document.querySelectorAll('a.logo, a.home-mark, a.site-logo').forEach(function (el) {
      el.addEventListener('click', function (e) {
        if (el.dataset.winking) return;
        e.preventDefault();
        el.dataset.winking = '1';
        var href = el.href;
        var orig = el.textContent;
        var seq = ['[◉]', '[–]', '[◉]'];
        var i = 0;
        function step() {
          if (i < seq.length) {
            el.textContent = seq[i++];
            setTimeout(step, i === 2 ? 120 : 180);
          } else {
            el.textContent = orig;
            delete el.dataset.winking;
            window.location.href = href;
          }
        }
        step();
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
