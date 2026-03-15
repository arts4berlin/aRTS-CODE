/**
 * [aRTS] Shared auth module — include on every page after theme.js.
 *
 * Provides session token management, authenticated fetch wrapper,
 * and profile/favorites/points helpers.
 */
window.artsAuth = {
  TOKEN_KEY: 'arts_session_token',
  PROXY_BASE: location.hostname === 'localhost' || location.hostname === '127.0.0.1'
    ? 'http://localhost:8099'
    : 'https://4-arts.com',

  /* ── Token helpers ── */

  getToken() {
    return localStorage.getItem(this.TOKEN_KEY);
  },

  isLoggedIn() {
    return !!this.getToken();
  },

  /** Store session token after login/register. */
  login(sessionToken) {
    localStorage.setItem(this.TOKEN_KEY, sessionToken);
  },

  /** Revoke session on server, clear local state, redirect. */
  async logout() {
    const token = this.getToken();
    if (token) {
      try {
        await fetch(this.PROXY_BASE + '/api/auth/logout', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + token },
        });
      } catch (_) { /* ignore network errors during logout */ }
    }
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem('arts_user');
    localStorage.removeItem('arts_alias');
    localStorage.removeItem('arts_tier');
    window.location.href = '/join.html';
  },

  /* ── Authenticated fetch wrapper ── */

  /**
   * Wrapper around fetch() that adds the Authorization header.
   * Automatically calls logout() on 401 responses.
   * Returns the Response object, or null on auth failure.
   */
  async fetch(url, opts) {
    opts = opts || {};
    opts.headers = opts.headers || {};
    const token = this.getToken();
    if (token) {
      opts.headers['Authorization'] = 'Bearer ' + token;
    }
    const res = await fetch(url, opts);
    if (res.status === 401) {
      this.logout();
      return null;
    }
    return res;
  },

  /* ── Profile ── */

  /** GET /api/auth/me — returns user profile + points + favorites. */
  async getProfile() {
    const res = await this.fetch(this.PROXY_BASE + '/api/auth/me');
    if (!res || !res.ok) return null;
    return res.json();
  },

  /* ── Favorites ── */

  async getFavorites() {
    const res = await this.fetch(this.PROXY_BASE + '/api/favorites');
    if (!res || !res.ok) return [];
    const data = await res.json();
    return data.favorites || [];
  },

  async addFavorite(pieceId) {
    return this.fetch(this.PROXY_BASE + '/api/favorites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ piece_id: pieceId }),
    });
  },

  async removeFavorite(pieceId) {
    return this.fetch(this.PROXY_BASE + '/api/favorites/remove', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ piece_id: pieceId }),
    });
  },

  /* ── Feedback ── */

  async submitFeedback(rating, text, page) {
    return fetch(this.PROXY_BASE + '/api/feedback', {
      method: 'POST',
      headers: Object.assign(
        { 'Content-Type': 'application/json' },
        this.getToken() ? { 'Authorization': 'Bearer ' + this.getToken() } : {}
      ),
      body: JSON.stringify({ rating, text, page }),
    });
  },

  /* ── Points ── */

  async addPoints(delta) {
    const res = await this.fetch(this.PROXY_BASE + '/api/points/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ delta }),
    });
    if (!res || !res.ok) return null;
    return res.json();
  },

  /* ── Newsletter ── */

  async subscribeNewsletter(email, name, source) {
    return fetch(this.PROXY_BASE + '/api/newsletter/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name, source }),
    });
  },

  /* ── Settings sync ── */

  /**
   * Fetch all settings from server, write into localStorage cache.
   * Call once on page load. Returns settings dict or null.
   */
  async syncSettings() {
    if (!this.isLoggedIn() || window.stealthMode) return null;
    try {
      var res = await this.fetch(this.PROXY_BASE + '/api/settings');
      if (!res || !res.ok) return null;
      var data = await res.json();
      var s = data.settings || {};
      for (var k in s) {
        if (s[k] === null || s[k] === '') {
          localStorage.removeItem(k);
        } else {
          localStorage.setItem(k, s[k]);
        }
      }
      return s;
    } catch (_) { return null; }
  },

  /**
   * Write a setting — localStorage first (optimistic), then server.
   * Falls back to localStorage-only if not logged in.
   */
  async setSetting(key, value) {
    localStorage.setItem(key, value);
    if (!this.isLoggedIn() || window.stealthMode) return;
    try {
      await this.fetch(this.PROXY_BASE + '/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value }),
      });
    } catch (_) { /* silent — localStorage is the fallback */ }
  },

  /** Read a setting from localStorage (synchronous, populated by syncSettings). */
  getSetting(key) {
    return localStorage.getItem(key);
  },

  /* ── Redemptions sync ── */

  /** Fetch redemptions from server, cache locally. Falls back to localStorage. */
  async getRedemptions() {
    if (!this.isLoggedIn() || window.stealthMode) {
      try { return JSON.parse(localStorage.getItem('arts_redemptions') || '[]'); }
      catch (_) { return []; }
    }
    try {
      var res = await this.fetch(this.PROXY_BASE + '/api/redemptions');
      if (!res || !res.ok) {
        return JSON.parse(localStorage.getItem('arts_redemptions') || '[]');
      }
      var data = await res.json();
      var list = data.redemptions || [];
      localStorage.setItem('arts_redemptions', JSON.stringify(list));
      return list;
    } catch (_) {
      try { return JSON.parse(localStorage.getItem('arts_redemptions') || '[]'); }
      catch (_) { return []; }
    }
  },

  /** Record a redemption — localStorage first, then server. */
  async addRedemption(entry) {
    var existing = [];
    try { existing = JSON.parse(localStorage.getItem('arts_redemptions') || '[]'); }
    catch (_) { /* ignore */ }
    existing.push(entry);
    localStorage.setItem('arts_redemptions', JSON.stringify(existing));
    if (!this.isLoggedIn() || window.stealthMode) return;
    try {
      await this.fetch(this.PROXY_BASE + '/api/redemptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      });
    } catch (_) { /* silent */ }
  },
};
