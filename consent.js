/* ── [aRTS] Storage consent banner (TTDSG §25 / GDPR) ──
   Shows a consent banner on first visit for non-essential localStorage usage.
   Essential storage (session token, theme, captcha) proceeds without consent.
   Include via <script src="consent.js"></script> after theme.js on any page.

   Reads/writes: localStorage('arts_gdpr_consent')
   Values: 'accepted' | 'declined' | null (not yet decided)
*/

(function () {
  var CONSENT_KEY = 'arts_gdpr_consent';

  /* Check if consent already given */
  var consent = null;
  try { consent = localStorage.getItem(CONSENT_KEY); } catch (e) {}

  /* Expose globally so other scripts can check before writing non-essential data */
  window.artsStorageConsent = function () {
    try { return localStorage.getItem(CONSENT_KEY) === 'accepted'; } catch (e) { return false; }
  };

  /* If already decided, don't show banner */
  if (consent === 'accepted' || consent === 'declined') return;

  /* ── Build banner DOM ── */
  function inject() {
    var isDay = document.documentElement.getAttribute('data-theme') === 'day';

    var banner = document.createElement('div');
    banner.id = 'consent-banner';
    banner.style.cssText = [
      'position:fixed',
      'bottom:0',
      'left:0',
      'right:0',
      'z-index:99990',
      'padding:16px 20px',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'gap:16px',
      'flex-wrap:wrap',
      'font-family:"Space Grotesk",sans-serif',
      'font-size:0.72rem',
      'font-weight:300',
      'letter-spacing:0.04em',
      'line-height:1.5',
      'background:' + (isDay ? 'rgba(255,255,255,0.96)' : 'rgba(0,0,0,0.94)'),
      'color:' + (isDay ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.5)'),
      'border-top:1px solid ' + (isDay ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)'),
      'backdrop-filter:blur(12px)',
      '-webkit-backdrop-filter:blur(12px)',
      'transform:translateY(100%)',
      'transition:transform 0.3s ease',
    ].join(';');

    var text = document.createElement('span');
    text.innerHTML = 'wE uSE bROWSER sTORAGE fOR yOUR eXPERIENCE. <a href="privacy.html#4-device-storage-ttdsg-25" style="color:inherit;text-decoration:underline;text-underline-offset:2px;">lEARN mORE</a>';
    banner.appendChild(text);

    var btnWrap = document.createElement('span');
    btnWrap.style.cssText = 'display:flex;gap:8px;flex-shrink:0;';

    /* Common button base */
    function makeBtn(label, accent) {
      var btn = document.createElement('button');
      btn.textContent = label;
      btn.style.cssText = [
        'font-family:inherit',
        'font-size:0.68rem',
        'font-weight:600',
        'letter-spacing:0.12em',
        'padding:7px 18px',
        'border-radius:3px',
        'cursor:pointer',
        'transition:opacity 0.15s',
        'border:1px solid ' + (accent
          ? '#FF5C00'
          : (isDay ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.14)')),
        'background:' + (accent ? '#FF5C00' : 'transparent'),
        'color:' + (accent
          ? '#000'
          : (isDay ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.4)')),
      ].join(';');
      return btn;
    }

    var btnAccept = makeBtn('aCCEPT', true);
    var btnDecline = makeBtn('dECLINE', false);

    btnAccept.addEventListener('click', function () {
      try { localStorage.setItem(CONSENT_KEY, 'accepted'); } catch (e) {}
      dismiss();
    });

    btnDecline.addEventListener('click', function () {
      try { localStorage.setItem(CONSENT_KEY, 'declined'); } catch (e) {}
      dismiss();
    });

    btnWrap.appendChild(btnAccept);
    btnWrap.appendChild(btnDecline);
    banner.appendChild(btnWrap);
    document.body.appendChild(banner);

    /* Animate in */
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        banner.style.transform = 'translateY(0)';
      });
    });

    function dismiss() {
      banner.style.transform = 'translateY(100%)';
      setTimeout(function () {
        if (banner.parentNode) banner.parentNode.removeChild(banner);
      }, 350);
    }
  }

  /* Wait for DOM */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }
})();
