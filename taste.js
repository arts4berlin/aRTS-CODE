/* ── [aRTS] taste.js — Personalised Style Test (swipe engine) ── */

(function () {
  'use strict';

  var TOTAL = 10;
  var HISTORY_KEY  = 'arts_taste_history';
  var PROFILE_KEY  = 'arts_taste_profile';
  var WEEK_KEY     = 'arts_taste_last_week';
  var SWIPE_THRESHOLD = 0.28;   // fraction of card width
  var UP_THRESHOLD    = 0.22;   // fraction of card height

  var stack   = document.getElementById('taste-stack');
  var wrap    = document.getElementById('taste-wrap');
  var resultsEl = document.getElementById('taste-results');
  if (!stack) return;

  var pieces = [];
  var current = 0;
  var results = [];
  var dragging = false;
  var startX = 0, startY = 0, dx = 0, dy = 0;

  /* ── ISO week helper ── */
  function isoWeek(d) {
    var dt = new Date(d.getTime());
    dt.setHours(0, 0, 0, 0);
    dt.setDate(dt.getDate() + 3 - (dt.getDay() + 6) % 7);
    var week1 = new Date(dt.getFullYear(), 0, 4);
    var num = 1 + Math.round(((dt - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
    return dt.getFullYear() + '-W' + String(num).padStart(2, '0');
  }

  /* ── Load & select pieces ── */
  function loadPieces() {
    return fetch('data/seed-pieces.json')
      .then(function (r) { return r.json(); })
      .then(function (all) {
        // Get recently seen IDs (last 4 weeks)
        var history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
        var recentIds = {};
        var cutoff = history.length > 4 ? history.length - 4 : 0;
        for (var i = cutoff; i < history.length; i++) {
          if (history[i] && history[i].results) {
            history[i].results.forEach(function (r) { recentIds[r.id] = true; });
          }
        }

        // Filter out recently seen, must have image + ai_style
        var pool = all.filter(function (p) {
          return p.seed && p.image && p.ai_style && !recentIds[p.id];
        });

        // If pool too small, allow all
        if (pool.length < TOTAL) {
          pool = all.filter(function (p) { return p.seed && p.image && p.ai_style; });
        }

        // Shuffle
        for (var j = pool.length - 1; j > 0; j--) {
          var k = Math.floor(Math.random() * (j + 1));
          var tmp = pool[j]; pool[j] = pool[k]; pool[k] = tmp;
        }

        // Enforce variety: max 3 per ai_style
        var styleCounts = {};
        var selected = [];
        for (var s = 0; s < pool.length && selected.length < TOTAL; s++) {
          var style = pool[s].ai_style;
          if (!styleCounts[style]) styleCounts[style] = 0;
          if (styleCounts[style] < 3) {
            selected.push(pool[s]);
            styleCounts[style]++;
          }
        }

        pieces = selected;
      });
  }

  /* ── Build progress dots ── */
  function buildProgress() {
    var el = document.getElementById('taste-progress');
    el.innerHTML = '';
    for (var i = 0; i < TOTAL; i++) {
      var dot = document.createElement('span');
      dot.className = 'taste-dot' + (i === 0 ? ' current' : '');
      el.appendChild(dot);
    }
  }

  function updateProgress(idx, action) {
    var dots = document.querySelectorAll('.taste-dot');
    if (dots[idx]) {
      dots[idx].classList.remove('current');
      dots[idx].classList.add('done-' + action);
    }
    if (dots[idx + 1]) {
      dots[idx + 1].classList.add('current');
    }
  }

  /* ── Render cards ── */
  function renderCards() {
    stack.innerHTML = '';
    if (pieces.length === 0) return;

    // Show top 2 cards (current + next behind)
    var end = Math.min(current + 2, pieces.length);
    for (var i = end - 1; i >= current; i--) {
      var p = pieces[i];
      var card = document.createElement('div');
      card.className = 'taste-card' + (i === current ? ' active' : ' behind');
      card.dataset.idx = i;

      card.innerHTML =
        '<div class="taste-card-img">' +
          '<img src="' + p.image + '" alt="' + (p.title || '') + '" loading="eager">' +
        '</div>' +
        '<div class="taste-card-meta">' +
          '<div class="taste-card-title">' + (p.title || '') + '</div>' +
          '<div class="taste-card-artist">' + (p.artist || '') + ' · ' + (p.year || '') + '</div>' +
          '<div class="taste-card-detail">' + (p.media || '') + (p.ai_period ? ' · ' + p.ai_period : '') + '</div>' +
        '</div>' +
        '<div class="taste-overlay taste-overlay-like">lIKE</div>' +
        '<div class="taste-overlay taste-overlay-nope">nOPE</div>' +
        '<div class="taste-overlay taste-overlay-love">♥ lOVE</div>';

      stack.appendChild(card);
    }

    initDrag();
  }

  /* ── Drag / Swipe ── */
  function initDrag() {
    var card = stack.querySelector('.taste-card.active');
    if (!card) return;

    var overlayLike = card.querySelector('.taste-overlay-like');
    var overlayNope = card.querySelector('.taste-overlay-nope');
    var overlayLove = card.querySelector('.taste-overlay-love');

    function onStart(e) {
      if (dragging) return;
      dragging = true;
      var pt = e.touches ? e.touches[0] : e;
      startX = pt.clientX;
      startY = pt.clientY;
      dx = 0; dy = 0;
      card.style.transition = 'none';
    }

    function onMove(e) {
      if (!dragging) return;
      var pt = e.touches ? e.touches[0] : e;
      dx = pt.clientX - startX;
      dy = pt.clientY - startY;

      var rotate = dx * 0.08;
      card.style.transform = 'translate(' + dx + 'px, ' + dy + 'px) rotate(' + rotate + 'deg)';

      var w = card.offsetWidth;
      var h = card.offsetHeight;
      var rx = Math.abs(dx) / w;
      var ry = -dy / h;  // negative because up is negative

      overlayLike.style.opacity = dx > 0 ? Math.min(rx / SWIPE_THRESHOLD, 1) : 0;
      overlayNope.style.opacity = dx < 0 ? Math.min(rx / SWIPE_THRESHOLD, 1) : 0;
      overlayLove.style.opacity = dy < 0 ? Math.min(ry / UP_THRESHOLD, 1) : 0;
    }

    function onEnd() {
      if (!dragging) return;
      dragging = false;

      var w = card.offsetWidth;
      var h = card.offsetHeight;
      var rx = Math.abs(dx) / w;
      var ry = -dy / h;

      card.style.transition = '';
      overlayLike.style.opacity = '';
      overlayNope.style.opacity = '';
      overlayLove.style.opacity = '';

      if (ry > UP_THRESHOLD && ry > rx) {
        doAction('love');
      } else if (rx > SWIPE_THRESHOLD && dx > 0) {
        doAction('like');
      } else if (rx > SWIPE_THRESHOLD && dx < 0) {
        doAction('dislike');
      } else {
        // Spring back
        card.style.transform = '';
      }
    }

    card.addEventListener('mousedown', onStart);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onEnd);

    card.addEventListener('touchstart', onStart, { passive: true });
    card.addEventListener('touchmove', onMove, { passive: true });
    card.addEventListener('touchend', onEnd);

    // Store cleanup
    card._cleanup = function () {
      card.removeEventListener('mousedown', onStart);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onEnd);
      card.removeEventListener('touchstart', onStart);
      card.removeEventListener('touchmove', onMove);
      card.removeEventListener('touchend', onEnd);
    };
  }

  /* ── Actions ── */
  function doAction(action) {
    var card = stack.querySelector('.taste-card.active');
    if (!card) return;
    if (card._cleanup) card._cleanup();

    // Record
    results.push({ id: pieces[current].id, action: action });
    updateProgress(current, action);

    // Animate out
    var exitClass = action === 'like' ? 'exit-right' : action === 'dislike' ? 'exit-left' : 'exit-up';
    card.classList.remove('active');
    card.classList.add(exitClass);

    current++;

    if (current >= pieces.length) {
      setTimeout(finishTest, 500);
      return;
    }

    // Reveal next
    setTimeout(function () {
      renderCards();
    }, 300);
  }

  /* ── Keyboard ── */
  document.addEventListener('keydown', function (e) {
    if (current >= pieces.length) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); doAction('like'); }
    if (e.key === 'ArrowLeft')  { e.preventDefault(); doAction('dislike'); }
    if (e.key === 'ArrowUp')    { e.preventDefault(); doAction('love'); }
  });

  /* ── Buttons ── */
  var btnNope = document.getElementById('taste-nope');
  var btnLike = document.getElementById('taste-like');
  var btnLove = document.getElementById('taste-love');
  if (btnNope) btnNope.addEventListener('click', function () { doAction('dislike'); });
  if (btnLike) btnLike.addEventListener('click', function () { doAction('like'); });
  if (btnLove) btnLove.addEventListener('click', function () { doAction('love'); });

  /* ── Finish & Save ── */
  function finishTest() {
    var week = isoWeek(new Date());

    // Save to history
    var history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    history.push({
      week: week,
      date: new Date().toISOString(),
      results: results
    });
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    localStorage.setItem(WEEK_KEY, week);

    // Build aggregated profile
    buildProfile(history);

    // Show results
    wrap.style.display = 'none';
    resultsEl.classList.add('visible');
    showResults();
  }

  function buildProfile(history) {
    var styles = {}, moods = {}, periods = {};
    var liked = [], loved = [], disliked = [];

    history.forEach(function (entry) {
      entry.results.forEach(function (r) {
        var piece = findPiece(r.id);
        if (!piece) return;

        if (r.action === 'like' || r.action === 'love') {
          var weight = r.action === 'love' ? 2 : 1;
          if (piece.ai_style)  styles[piece.ai_style]   = (styles[piece.ai_style] || 0) + weight;
          if (piece.ai_mood)   moods[piece.ai_mood]     = (moods[piece.ai_mood] || 0) + weight;
          if (piece.ai_period) periods[piece.ai_period]  = (periods[piece.ai_period] || 0) + weight;
        }

        if (r.action === 'love') loved.push(r.id);
        else if (r.action === 'like') liked.push(r.id);
        else disliked.push(r.id);
      });
    });

    var profile = {
      updated: new Date().toISOString(),
      styles: styles,
      moods: moods,
      periods: periods,
      loved_ids: loved,
      liked_ids: liked,
      disliked_ids: disliked
    };

    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    return profile;
  }

  function findPiece(id) {
    for (var i = 0; i < pieces.length; i++) {
      if (pieces[i].id === id) return pieces[i];
    }
    return null;
  }

  /* ── Render results ── */
  function showResults() {
    var profile = JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}');

    // Styles pills
    renderPills('taste-pills-styles', profile.styles || {});

    // Mood bars
    renderBars('taste-bars-moods', profile.moods || {});

    // Period bars
    renderBars('taste-bars-periods', profile.periods || {});

    // Loved thumbnails
    var lovedIds = (profile.loved_ids || []);
    // Only show from this session
    var sessionLoved = results.filter(function (r) { return r.action === 'love'; });
    if (sessionLoved.length > 0) {
      document.getElementById('taste-r-loved').style.display = '';
      var strip = document.getElementById('taste-loved-strip');
      strip.innerHTML = '';
      sessionLoved.forEach(function (r) {
        var p = findPiece(r.id);
        if (!p) return;
        var thumb = document.createElement('a');
        thumb.href = 'art.html';
        thumb.className = 'taste-loved-thumb';
        thumb.innerHTML = '<img src="' + p.image + '" alt="' + (p.title || '') + '">';
        strip.appendChild(thumb);
      });
    }
  }

  function renderPills(containerId, data) {
    var el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = '';

    var sorted = Object.keys(data).sort(function (a, b) { return data[b] - data[a]; });
    sorted.slice(0, 6).forEach(function (key, i) {
      var pill = document.createElement('span');
      pill.className = 'taste-pill' + (i < 2 ? ' top' : '');
      pill.textContent = key;
      el.appendChild(pill);
    });
  }

  function renderBars(containerId, data) {
    var el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = '';

    var sorted = Object.keys(data).sort(function (a, b) { return data[b] - data[a]; });
    var max = sorted.length > 0 ? data[sorted[0]] : 1;

    sorted.slice(0, 5).forEach(function (key) {
      var pct = Math.round((data[key] / max) * 100);
      var row = document.createElement('div');
      row.className = 'taste-bar-row';
      row.innerHTML =
        '<span class="taste-bar-label">' + key + '</span>' +
        '<div class="taste-bar-track"><div class="taste-bar-fill" style="width:0%"></div></div>' +
        '<span class="taste-bar-pct">' + pct + '%</span>';
      el.appendChild(row);

      // Animate bar fill
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          row.querySelector('.taste-bar-fill').style.width = pct + '%';
        });
      });
    });
  }

  /* ── Init ── */
  loadPieces().then(function () {
    if (pieces.length === 0) {
      stack.innerHTML = '<p style="text-align:center;color:var(--c-text-tertiary);font-size:0.82rem;padding:var(--s-8);">nO pIECES aVAILABLE — tRY aGAIN lATER</p>';
      return;
    }
    buildProgress();
    renderCards();
  });

})();
