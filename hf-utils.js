/* ═══════════════════════════════════════════════
   hf-utils.js — Hugging Face AI utilities for aRTS
   Shared helper for Inference API calls + rate limiting
   ═══════════════════════════════════════════════ */

(function(window){
  'use strict';

  var HF_API_BASE = 'https://api-inference.huggingface.co/models/';
  var DAILY_LIMIT = 50;
  var RATE_KEY    = 'arts_hf_daily';

  /* ── Rate limiter (per-day, client-side) ── */
  function _getRateState(){
    try {
      var raw = JSON.parse(localStorage.getItem(RATE_KEY) || '{}');
      var today = new Date().toISOString().slice(0, 10);
      if(raw.date !== today) return { date: today, count: 0 };
      return raw;
    } catch(e){ return { date: new Date().toISOString().slice(0, 10), count: 0 }; }
  }

  function _incRate(){
    var state = _getRateState();
    state.count++;
    try { localStorage.setItem(RATE_KEY, JSON.stringify(state)); } catch(e){}
  }

  function hfRateCheck(){
    return _getRateState().count < DAILY_LIMIT;
  }

  function hfRateRemaining(){
    return Math.max(0, DAILY_LIMIT - _getRateState().count);
  }

  /* ── Get optional HF token (set in admin/gears) ── */
  function _getToken(){
    try { return localStorage.getItem('arts_hf_token') || ''; } catch(e){ return ''; }
  }

  /* ── Check if AI features are enabled ── */
  function hfEnabled(){
    try { return localStorage.getItem('arts_ai_enabled') !== 'false'; } catch(e){ return true; }
  }

  /* ── Core API call ── */
  function hfQuery(model, payload, options){
    options = options || {};
    var timeout = options.timeout || 30000;

    if(!hfEnabled()) return Promise.reject(new Error('AI features disabled'));
    if(!hfRateCheck()) return Promise.reject(new Error('Daily AI rate limit reached'));

    var token = _getToken();
    var headers = { 'Content-Type': 'application/json' };
    if(token) headers['Authorization'] = 'Bearer ' + token;

    _incRate();

    return Promise.race([
      fetch(HF_API_BASE + model, {
        method: 'POST',
        headers: headers,
        body: typeof payload === 'string' ? payload : JSON.stringify(payload)
      }),
      new Promise(function(_, reject){
        setTimeout(function(){ reject(new Error('HF API timeout')); }, timeout);
      })
    ]).then(function(res){
      if(res.status === 503){
        /* Model loading — retry once after delay */
        var est = 20000;
        try { est = Math.min(res.json().estimated_time * 1000 || 20000, 60000); } catch(e){}
        return new Promise(function(resolve){
          setTimeout(resolve, est);
        }).then(function(){
          return fetch(HF_API_BASE + model, {
            method: 'POST',
            headers: headers,
            body: typeof payload === 'string' ? payload : JSON.stringify(payload)
          });
        }).then(function(r){
          if(!r.ok) throw new Error('HF API error: ' + r.status);
          return r.json();
        });
      }
      if(!res.ok) throw new Error('HF API error: ' + res.status);
      return res.json();
    });
  }

  /* ── Send image blob/dataURL to Inference API ── */
  function hfImage(model, imageData, options){
    options = options || {};
    var timeout = options.timeout || 45000;

    if(!hfEnabled()) return Promise.reject(new Error('AI features disabled'));
    if(!hfRateCheck()) return Promise.reject(new Error('Daily AI rate limit reached'));

    var token = _getToken();
    var headers = {};
    if(token) headers['Authorization'] = 'Bearer ' + token;

    _incRate();

    /* imageData can be a Blob or base64 data URL */
    var blobPromise;
    if(imageData instanceof Blob){
      blobPromise = Promise.resolve(imageData);
    } else if(typeof imageData === 'string' && imageData.startsWith('data:')){
      blobPromise = fetch(imageData).then(function(r){ return r.blob(); });
    } else {
      return Promise.reject(new Error('Invalid image data'));
    }

    return blobPromise.then(function(blob){
      return Promise.race([
        fetch(HF_API_BASE + model, {
          method: 'POST',
          headers: headers,
          body: blob
        }),
        new Promise(function(_, reject){
          setTimeout(function(){ reject(new Error('HF API timeout')); }, timeout);
        })
      ]);
    }).then(function(res){
      if(res.status === 503){
        return new Promise(function(resolve){ setTimeout(resolve, 20000); }).then(function(){
          return blobPromise;
        }).then(function(blob){
          return fetch(HF_API_BASE + model, {
            method: 'POST',
            headers: headers,
            body: blob
          });
        }).then(function(r){
          if(!r.ok) throw new Error('HF API error: ' + r.status);
          return r.json();
        });
      }
      if(!res.ok) throw new Error('HF API error: ' + res.status);
      return res.json();
    });
  }

  /* ── Public API ── */
  window.artsHF = {
    query:         hfQuery,
    image:         hfImage,
    rateCheck:     hfRateCheck,
    rateRemaining: hfRateRemaining,
    enabled:       hfEnabled
  };

})(window);
