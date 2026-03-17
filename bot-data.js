/* ── bot-data.js ──────────────────────────────────────────
   Bot population layer for testing.
   Toggle: localStorage.arts_bots_active === 'true'
   Purge clears the flag; seed data (AI training) is never touched.
   ───────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var active = localStorage.getItem('arts_bots_active') === 'true';

  var bots = {
    active: active,
    users: [],
    listings: [],
    ready: null          // Promise — resolved when data is loaded (or immediately if inactive)
  };

  if (!active) {
    bots.ready = Promise.resolve();
    window.ARTS_BOTS = bots;
    return;
  }

  bots.ready = Promise.all([
    fetch('data/bot-listings.json?v=' + Date.now()).then(function (r) { return r.json(); }),
    fetch('data/mock-users.json?v=' + Date.now()).then(function (r) { return r.json(); })
  ]).then(function (results) {
    bots.listings = results[0] || [];
    bots.users = results[1] || [];
  }).catch(function (err) {
    console.warn('[bot-data] failed to load:', err);
    bots.listings = [];
    bots.users = [];
  });

  window.ARTS_BOTS = bots;
})();
