/* Thin bridge between the game and the art modules: portrait specs for characters,
   a shared vignette player, and plain fallbacks if an art module failed to load. */
(function (root) {
  'use strict';
  var BK = root.BK = root.BK || {};

  var ROLE = { hero: 'hero', villain: 'official', official: 'official', boss: 'boss', townsperson: 'townsperson' };

  function fallbackPortrait(c) {
    var cv = document.createElement('canvas');
    cv.width = 32; cv.height = 40;
    var g = cv.getContext('2d');
    var r = new BK.Rng(BK.hash(c.key || c.name));
    g.fillStyle = BK.PAL[27]; g.fillRect(0, 0, 32, 40);
    g.fillStyle = BK.PAL[r.pick([10, 15, 19, 21, 4])]; g.fillRect(4, 30, 24, 10);
    g.fillStyle = BK.PAL[6 + r.int(0, 3)]; g.fillRect(9, 10, 14, 18);
    g.fillStyle = BK.PAL[0]; g.fillRect(9, 6, 14, 6); g.fillRect(12, 17, 2, 2); g.fillRect(18, 17, 2, 2);
    return cv;
  }

  BK.Art = {
    spec: function (c) {
      if (c === 'emperor') return { id: 'Emperor Huizong', name: 'Emperor Huizong', role: 'emperor', look: { hair: 'crown', beard: 'mustache', mood: 'calm' } };
      return {
        id: c.role === 'hero' || c.role === 'villain' || c.role === 'boss' || c.role === 'official' && c.key.indexOf('gen') !== 0 ? c.key : 'gen:' + c.name,
        name: c.name, role: ROLE[c.role] || 'townsperson', look: c.look || {}
      };
    },
    portrait: function (c) {
      try {
        if (BK.Portrait && BK.Portrait.render) return BK.Portrait.render(BK.Art.spec(c));
      } catch (e) { if (root.console) console.warn('portrait failed', e); }
      return fallbackPortrait(c);
    },
    // Draw a portrait into a display canvas (64×80 by default).
    paint: function (canvas, c) {
      var g = canvas.getContext('2d');
      g.imageSmoothingEnabled = false;
      g.clearRect(0, 0, canvas.width, canvas.height);
      if (!c) { g.fillStyle = '#111'; g.fillRect(0, 0, canvas.width, canvas.height); return; }
      g.drawImage(BK.Art.portrait(c), 0, 0, canvas.width, canvas.height);
    },
    portraitCanvas: function (c, w, h) {
      var cv = document.createElement('canvas');
      cv.width = w || 64; cv.height = h || 80;
      BK.Art.paint(cv, c);
      return cv;
    },

    vignette: null,
    lastScene: null,
    initVignette: function (canvas) {
      if (BK.Vignette && BK.Vignette.create) {
        try { BK.Art.vignette = BK.Vignette.create(canvas); return; } catch (e) { if (root.console) console.warn(e); }
      }
      var g = canvas.getContext('2d');
      BK.Art.vignette = {
        play: function (scene) {
          g.fillStyle = '#10202a'; g.fillRect(0, 0, 136, 52);
          g.fillStyle = BK.PAL[29]; g.fillRect(0, 38, 136, 14);
          g.fillStyle = BK.PAL[13]; g.font = '8px monospace'; g.fillText(scene || '', 4, 12);
        },
        stop: function () {}
      };
    },
    scene: function (name, season) {
      if (!BK.Art.vignette) return;
      var key = name + ':' + season;
      if (key === BK.Art.lastScene) return;
      BK.Art.lastScene = key;
      try {
        BK.Art.vignette.play(name || 'idle', { season: season || 'Spring' });
        // With animation switched off, keep the first frame as a still picture.
        if (BK.UI && BK.UI.settings.animation === false) {
          var v = BK.Art.vignette;
          setTimeout(function () { if (BK.Art.lastScene === key) v.stop(); }, 120);
        }
      } catch (e) { if (root.console) console.warn(e); }
    },

    music: function (name, opts) {
      if (!BK.Music || !BK.Music.play) return;
      try { BK.Music.play(name, opts); } catch (e) { if (root.console) console.warn(e); }
    },
    sfx: function (name) {
      if (!BK.Music || !BK.Music.sfx) return;
      try { BK.Music.sfx(name); } catch (e) { /* audio is optional */ }
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
