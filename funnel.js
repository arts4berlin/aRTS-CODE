/* ──────────────────────────────────────────────────
   funnel.js — Persistent onboarding bar for card holders
   Injected on join.html, verify.html, add.html
   Only shows if arts_card_funnel flag is set (from list.html)
   ────────────────────────────────────────────────── */
(function () {
  if (!localStorage.getItem('arts_card_funnel')) return;

  /* ── Route map ── */
  var page = location.pathname.replace(/^.*\//, '').replace('.html', '') || 'index';
  var _t = window.artsI18n ? window.artsI18n.t : function (k) { return k; };
  var steps = [
    { id: 'join',   label: _t('funnel.join')   || 'jOIN',   page: 'join',   href: 'join.html' },
    { id: 'verify', label: _t('funnel.verify') || 'vERIFY', page: 'verify', href: 'verify.html' },
    { id: 'add',    label: _t('funnel.list')   || 'lIST',   page: 'add',    href: 'add.html' }
  ];

  var currentIdx = -1;
  for (var i = 0; i < steps.length; i++) {
    if (steps[i].page === page) { currentIdx = i; break; }
  }
  if (currentIdx === -1) return; /* Not a funnel page */

  var nextStep = currentIdx < steps.length - 1 ? steps[currentIdx + 1] : null;
  var isLast = !nextStep;

  /* ── Detect completion states ── */
  var hasAccount = !!localStorage.getItem('arts_id_hash');
  var isVerified = !!localStorage.getItem('arts_verified');

  /* ── Build bar ── */
  var bar = document.createElement('div');
  bar.className = 'funnel-bar';
  bar.setAttribute('data-theme-aware', '');

  /* Progress dots */
  var dotsHTML = '<div class="funnel-dots">';
  for (var j = 0; j < steps.length; j++) {
    var state = j < currentIdx ? 'done' : j === currentIdx ? 'active' : '';
    dotsHTML += '<span class="funnel-dot ' + state + '"></span>';
  }
  dotsHTML += '</div>';

  /* Step counter */
  var counterHTML = '<span class="funnel-counter">' +
    (currentIdx + 1) + ' / ' + steps.length +
    '</span>';

  /* CTA */
  var ctaHTML = '';
  if (isLast) {
    ctaHTML = '<span class="funnel-cta-label">' + (_t('funnel.final') || 'fINaL sTEP') + '</span>';
  } else {
    ctaHTML = '<a href="' + nextStep.href + '" class="funnel-cta">' +
      (_t('funnel.next') || 'nEXT: ') + nextStep.label +
      ' <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>' +
      '</a>';
  }

  /* Dismiss button */
  var dismissHTML = '<button class="funnel-dismiss" aria-label="dismiss">&times;</button>';

  bar.innerHTML =
    '<div class="funnel-inner">' +
      dotsHTML + counterHTML + '<div class="funnel-spacer"></div>' + ctaHTML + dismissHTML +
    '</div>';

  /* ── Inject styles (once) ── */
  if (!document.getElementById('funnel-css')) {
    var style = document.createElement('style');
    style.id = 'funnel-css';
    style.textContent =
      '.funnel-bar{' +
        'position:fixed;bottom:0;left:0;right:0;z-index:9999;' +
        'background:rgba(10,10,10,0.92);' +
        'backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);' +
        'border-top:1px solid rgba(255,255,255,0.06);' +
        'padding:0 max(16px,env(safe-area-inset-left)) max(12px,env(safe-area-inset-bottom));' +
        'font-family:"Space Grotesk",sans-serif;' +
        'transition:transform 0.35s cubic-bezier(0.16,1,0.3,1),opacity 0.25s;' +
      '}' +
      '.funnel-bar.hidden{transform:translateY(100%);opacity:0;pointer-events:none;}' +
      '.funnel-inner{' +
        'max-width:680px;margin:0 auto;' +
        'display:flex;align-items:center;gap:12px;' +
        'padding:12px 0;' +
      '}' +

      /* Dots */
      '.funnel-dots{display:flex;gap:6px;align-items:center;}' +
      '.funnel-dot{' +
        'width:8px;height:8px;border-radius:50%;' +
        'background:rgba(255,255,255,0.12);' +
        'transition:background 0.2s,transform 0.2s;' +
      '}' +
      '.funnel-dot.done{background:#FF5C00;}' +
      '.funnel-dot.active{background:#fff;transform:scale(1.25);}' +

      /* Counter */
      '.funnel-counter{' +
        'font-size:0.56rem;font-weight:600;letter-spacing:0.18em;' +
        'color:rgba(255,255,255,0.35);' +
      '}' +

      /* Spacer */
      '.funnel-spacer{flex:1;}' +

      /* CTA */
      '.funnel-cta{' +
        'display:inline-flex;align-items:center;gap:5px;' +
        'font-size:0.68rem;font-weight:700;letter-spacing:0.12em;' +
        'color:#FF5C00;text-decoration:none;' +
        'padding:8px 16px;' +
        'border:1px solid rgba(255,92,0,0.3);border-radius:4px;' +
        'transition:background 0.15s,border-color 0.15s;' +
        'cursor:crosshair;white-space:nowrap;' +
      '}' +
      '.funnel-cta:hover{background:rgba(255,92,0,0.08);border-color:rgba(255,92,0,0.5);}' +
      '.funnel-cta svg{flex-shrink:0;}' +

      /* Final step label */
      '.funnel-cta-label{' +
        'font-size:0.56rem;font-weight:600;letter-spacing:0.16em;' +
        'color:rgba(255,92,0,0.7);white-space:nowrap;' +
      '}' +

      /* Dismiss */
      '.funnel-dismiss{' +
        'background:none;border:none;' +
        'color:rgba(255,255,255,0.2);' +
        'font-size:1rem;font-weight:300;cursor:pointer;' +
        'padding:4px 6px;margin-left:4px;' +
        'transition:color 0.15s;' +
      '}' +
      '.funnel-dismiss:hover{color:rgba(255,255,255,0.6);}' +

      /* Day mode */
      'html[data-theme="day"] .funnel-bar{' +
        'background:rgba(255,255,255,0.92);' +
        'border-top-color:rgba(0,0,0,0.06);' +
      '}' +
      'html[data-theme="day"] .funnel-dot{background:rgba(0,0,0,0.1);}' +
      'html[data-theme="day"] .funnel-dot.active{background:#000;}' +
      'html[data-theme="day"] .funnel-counter{color:rgba(0,0,0,0.35);}' +
      'html[data-theme="day"] .funnel-dismiss{color:rgba(0,0,0,0.2);}' +
      'html[data-theme="day"] .funnel-dismiss:hover{color:rgba(0,0,0,0.6);}' +

      /* Push page content above the bar */
      'body.has-funnel{padding-bottom:60px;}';

    document.head.appendChild(style);
  }

  /* ── Mount ── */
  document.body.appendChild(bar);
  document.body.classList.add('has-funnel');

  /* Dismiss handler */
  bar.querySelector('.funnel-dismiss').addEventListener('click', function () {
    bar.classList.add('hidden');
    document.body.classList.remove('has-funnel');
    /* Don't remove the flag — just hide for this page view */
  });

  /* ── Auto-advance: if user completed this step, nudge to next ── */
  if (page === 'join' && hasAccount && nextStep) {
    /* They just signed up — pulse the next CTA */
    var cta = bar.querySelector('.funnel-cta');
    if (cta) cta.style.animation = 'funnel-pulse 1.5s ease-in-out 3';
  }
  if (page === 'verify' && isVerified && nextStep) {
    var cta2 = bar.querySelector('.funnel-cta');
    if (cta2) cta2.style.animation = 'funnel-pulse 1.5s ease-in-out 3';
  }

  /* Pulse keyframe */
  var kf = document.createElement('style');
  kf.textContent =
    '@keyframes funnel-pulse{' +
      '0%,100%{border-color:rgba(255,92,0,0.3);}' +
      '50%{border-color:rgba(255,92,0,0.8);background:rgba(255,92,0,0.12);}' +
    '}';
  document.head.appendChild(kf);
})();
