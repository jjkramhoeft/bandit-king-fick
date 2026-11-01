/* Bandit King of Ancient China - animated title backdrop (320x200, BK.PAL only).
   A marsh fortress among reeds and water, karst mountains in the mist behind, and a red
   banner on a tall pole. The upper middle is kept to a plain sky for the DOM title. */
(function (root) {
  'use strict';
  var BK = root.BK = root.BK || {};

  var W = 320, H = 200, WL = 152, FPS = 12, NONE = 255;
  var SHADE = [0, 24, 3, 4, 5, 27, 7, 8, 9, 5, 11, 5, 8, 12, 15, 16, 27, 16, 19, 20, 27, 20, 21, 22, 25, 26, 27, 0, 29, 15, 31, 25];
  var BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

  function rnd(n) {
    n = (n ^ 61) ^ (n >>> 16);
    n = (n + (n << 3)) | 0;
    n ^= n >>> 4;
    n = Math.imul(n, 0x27d4eb2d);
    n ^= n >>> 15;
    return (n >>> 0) / 4294967296;
  }
  function wrap(v, m) { return ((v % m) + m) % m; }
  function bay(x, y) { return BAYER[(y & 3) * 4 + (x & 3)]; }

  // ---- pixel buffer (NONE = transparent) ----
  function Pix(fill) { this.d = new Uint8Array(W * H); if (fill != null) this.d.fill(fill); }
  Pix.prototype.set = function (x, y, c) {
    if (c == null || c < 0) return;
    x = Math.floor(x); y = Math.floor(y);
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    this.d[y * W + x] = c;
  };
  Pix.prototype.get = function (x, y) {
    x = Math.floor(x); y = Math.floor(y);
    if (x < 0 || y < 0 || x >= W || y >= H) return NONE;
    return this.d[y * W + x];
  };
  Pix.prototype.rect = function (x, y, w, h, c) {
    x = Math.floor(x); y = Math.floor(y);
    for (var j = 0; j < h; j++) for (var i = 0; i < w; i++) this.set(x + i, y + j, c);
  };
  Pix.prototype.line = function (x0, y0, x1, y1, c) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    var dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, e = dx + dy;
    for (var n = 0; n < 1000; n++) {
      this.set(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      var e2 = 2 * e;
      if (e2 >= dy) { e += dy; x0 += sx; }
      if (e2 <= dx) { e += dx; y0 += sy; }
    }
  };
  Pix.prototype.ell = function (cx, cy, rx, ry, c, lv) {
    for (var y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (var x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        var dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1 && (lv == null || bay(x, y) < lv)) this.set(x, y, c);
      }
    }
  };
  Pix.prototype.vgrad = function (y0, y1, a, b) {
    for (var y = y0; y < y1; y++) {
      var lv = Math.floor((y - y0 + 0.5) / (y1 - y0) * 17);
      for (var x = 0; x < W; x++) this.set(x, y, bay(x, y) < lv ? b : a);
    }
  };
  Pix.prototype.over = function (src) {
    var a = src.d, d = this.d;
    for (var i = 0; i < d.length; i++) if (a[i] !== NONE) d[i] = a[i];
  };

  // ---- static layers ----
  function skyLayer() {
    var s = new Pix(20);
    s.vgrad(56, 70, 20, 19);
    s.rect(0, 70, W, 22, 19);
    s.vgrad(92, 104, 19, 31);
    s.rect(0, 104, W, 14, 31);
    s.vgrad(118, WL, 31, 2);
    // low sun between the far peaks, with a soft halo
    s.ell(84, 106, 20, 14, 30, 6);
    s.ell(84, 106, 13, 10, 30, 12);
    s.ell(84, 106, 8, 8, 2);
    s.ell(84, 106, 6, 6, 1);
    return s;
  }

  // Karst peaks: each [x, top, left half-width, right half-width]. Steep, slightly ragged
  // sides, a lit left flank, a shaded right flank and vertical rock streaks.
  function peaks(s, list, base, c, cs, ct, mistC, seed) {
    for (var x = 0; x < W; x++) {
      var best = base + 6, side = 0, idx = -1, wid = 1;
      for (var i = 0; i < list.length; i++) {
        var p = list[i], dx = x + 0.5 - p[0], w = dx < 0 ? p[2] : p[3], d = Math.abs(dx) / w;
        if (d >= 1) continue;
        var y = p[1] + (base - p[1]) * Math.pow(d, 2.2);
        y += (Math.sin(x * 0.9 + i * 3 + seed) * 0.7 + Math.sin(x * 2.3 + seed) * 0.5) * Math.min(1, d * 3);
        if (y < best) { best = y; side = dx / w; idx = i; wid = w; }
      }
      if (idx < 0) continue;
      var top = Math.round(best);
      var streak = ((x * 7 + idx * 13 + seed) % 6 === 0) ? top + 2 + Math.floor(rnd(x + seed * 31) * (base - top) * 0.7) : -1;
      for (var y2 = top; y2 < base + 6; y2++) {
        var cc = c;
        if (side > 0.35 || (side > 0.1 && bay(x, y2) < 8)) cc = cs;
        if (y2 > top + 1 && y2 < streak) cc = cs;
        if (y2 === top && side < 0.35) cc = ct;
        if (mistC != null && y2 > base - 10 && bay(x, y2) < (y2 - (base - 10)) * 1.6) cc = mistC;
        s.set(x, y2, cc);
      }
    }
  }

  function roof(s, x0, x1, y, rh, c) {
    var cs = SHADE[c];
    for (var i = 0; i < rh; i++) {
      var inset = Math.round(i * 1.5) + (i > 0 ? 1 : 0);
      for (var x = x0 + inset; x <= x1 - inset; x++) s.set(x, y - i, i === 0 ? cs : (((x & 1) && i < rh - 1) ? c : 25));
    }
    s.set(x0 - 1, y - 1, cs); s.set(x1 + 1, y - 1, cs); s.set(x0 - 2, y - 2, cs); s.set(x1 + 2, y - 2, cs); s.set(x0 - 3, y - 3, cs); s.set(x1 + 3, y - 3, cs);
    var ti = Math.round((rh - 1) * 1.5) + 1, top = y - rh;
    s.rect(x0 + ti - 2, top, x1 - x0 - ti * 2 + 5, 1, 27);
    s.set(x0 + ti - 3, top - 1, 27); s.set(x1 - ti + 3, top - 1, 27);
  }

  function building(s, x, y, w, h, wall, post, lit) {
    s.rect(x, y - h, w, h, wall);
    s.rect(x + w - 3, y - h, 3, h, SHADE[wall]);
    for (var px = x; px < x + w; px += 8) s.rect(px, y - h, 1, h, post);
    s.rect(x + w - 1, y - h, 1, h, post);
    if (lit) for (var wx = x + 3; wx < x + w - 4; wx += 6) { s.rect(wx, y - h + 2, 2, 2, 13); s.set(wx, y - h + 2, 12); }
  }

  // Far and middle ranges with mist pooled at their feet.
  function farLayer() {
    var s = new Pix(NONE);
    peaks(s, [[14, 94, 18, 24], [50, 76, 14, 18], [110, 100, 22, 14], [150, 108, 20, 26], [196, 88, 16, 22], [236, 72, 14, 20], [274, 92, 20, 16], [308, 80, 14, 18]], 126, 31, 24, 30, 30, 1);
    peaks(s, [[6, 108, 16, 18], [38, 98, 14, 16], [74, 114, 18, 20], [128, 122, 24, 20], [262, 106, 16, 18], [294, 98, 14, 16], [320, 112, 14, 14]], 140, 25, 26, 24, 31, 5);
    return s;
  }

  function nearLayer() {
    var s = new Pix(NONE), x, y, i;
    // near hills and the fortress island
    for (x = 0; x < W; x++) {
      var hl = 136 + Math.sin(x * 0.05) * 3 + Math.sin(x * 0.13) * 1.5 + (x > 120 ? 6 : 0) - (x > 150 ? 8 : 0) - Math.max(0, 1 - Math.abs(x - 228) / 90) * 6;
      if (x < 120) hl += Math.max(0, (x - 70) * 0.25);
      for (y = Math.round(hl); y < WL; y++) {
        var c = 16;
        if (y === Math.round(hl)) c = 15;
        else if ((x * 3 + y * 5) % 13 === 0) c = 15;
        else if (y > WL - 4 || ((x + y) % 7 === 0 && x > 228)) c = 27;
        if (y > WL - 3 && bay(x, y) < 8) c = 5;
        s.set(x, y, c);
      }
    }
    // halls behind the palisade
    building(s, 176, 128, 30, 8, 3, 11, true); roof(s, 173, 208, 119, 5, 26);
    building(s, 254, 128, 32, 9, 3, 11, true); roof(s, 251, 289, 118, 5, 26);
    // watchtowers on stilts
    var towers = [168, 292];
    for (i = 0; i < 2; i++) {
      x = towers[i];
      s.line(x - 4, 140, x - 3, 112, 5); s.line(x + 4, 140, x + 3, 112, 5); s.line(x - 3, 130, x + 3, 120, 4); s.line(x + 3, 130, x - 3, 120, 4);
      s.rect(x - 5, 110, 11, 2, 4); s.rect(x - 4, 104, 9, 6, 3); s.rect(x - 4, 106, 9, 2, 27); s.rect(x + 2, 104, 2, 6, 4);
      roof(s, x - 6, x + 6, 103, 3, 26);
    }
    // palisade of pointed stakes
    for (x = 160; x < 300; x += 2) {
      var tip = 127 + ((x >> 1) & 1);
      for (y = tip; y < 141; y++) s.set(x, y, y === tip ? 3 : 4);
      for (y = tip + 1; y < 141; y++) s.set(x + 1, y, 5);
    }
    s.rect(160, 132, 140, 1, 27); s.rect(160, 137, 140, 1, 27);
    // the gate tower
    building(s, 214, 140, 32, 22, 3, 11, false);
    s.rect(212, 131, 36, 9, 26); s.rect(212, 131, 36, 1, 25);
    for (y = 133; y < 140; y += 3) for (x = 212 + (y % 2) * 3; x < 248; x += 6) s.set(x, y, 27);
    s.rect(224, 125, 12, 15, 27); s.rect(225, 124, 10, 1, 27); s.rect(229, 126, 1, 14, 5); s.set(227, 133, 13); s.set(232, 133, 13);
    s.rect(217, 122, 4, 3, 27); s.rect(239, 122, 4, 3, 27);
    roof(s, 210, 249, 117, 5, 26);
    building(s, 219, 112, 22, 9, 2, 11, true);
    roof(s, 214, 245, 102, 5, 26);
    s.rect(229, 94, 2, 3, 13);
    // jetty
    s.rect(176, WL - 2, 26, 1, 4); s.rect(176, WL - 1, 26, 1, 5);
    for (x = 177; x < 202; x += 6) s.rect(x, WL - 1, 1, 4, 5);
    return s;
  }

  var cache = null;
  function layers() {
    if (!cache) cache = { sky: skyLayer(), far: farLayer(), near: nearLayer() };
    return cache;
  }

  // ---- animated parts ----
  function banner(s, t) {
    var px = 258, top = 50;
    s.line(px, top, px, 128, 27); s.line(px + 1, top, px + 1, 128, 5);
    s.rect(px - 1, top - 2, 4, 2, 13); s.set(px, top - 3, 12);
    s.rect(px - 3, top + 1, 9, 1, 5);
    for (var i = 0; i < 30; i++) {
      var w = Math.sin(t * 0.28 - i * 0.32), off = Math.round(w * i / 30 * 3);
      var len = 15 - (i > 24 ? (i - 24) * ((i & 1) + 1) : 0);
      for (var j = 0; j < len; j++) {
        var c = w > 0.45 ? 11 : 10;
        if (j === 0 || j === len - 1) c = 13;
        if (i < 3) c = 13;
        if (w < -0.6 && j > 1 && j < len - 2 && (j & 1)) c = 12;
        s.set(px + 2 + i, top + 2 + j + off, c);
      }
    }
  }

  function towerFlags(s, t) {
    var xs = [168, 292];
    for (var k = 0; k < 2; k++) {
      var x = xs[k];
      s.line(x, 92, x, 101, 27);
      for (var i = 1; i <= 6; i++) {
        var off = Math.round(Math.sin(t * 0.4 - i * 0.7 + k) * 1);
        s.set(x + i, 92 + off, 10); s.set(x + i, 93 + off, i > 4 ? 11 : 10);
      }
    }
  }

  function clouds(s, t) {
    var i;
    for (i = 0; i < 3; i++) {
      var cx = wrap(i * 131 + t * (0.08 + i * 0.03), W + 160) - 80, cy = 14 + i * 9;
      s.ell(cx, cy, 34 + i * 6, 2.2, 19, 6);
      s.ell(cx + 12, cy - 1.5, 18, 1.5, 19, 4);
    }
    for (i = 0; i < 3; i++) {
      var lx = wrap(i * 119 + 40 + t * 0.15, W + 140) - 70, ly = 92 + i * 7;
      s.ell(lx, ly, 30, 2.5, 30, 9);
      s.ell(lx - 8, ly - 2, 14, 2, 30, 6);
    }
  }

  // Slow banks of mist drifting between the ranges.
  function mist(s, t) {
    for (var i = 0; i < 4; i++) {
      var cx = wrap(i * 97 + t * 0.2, W + 120) - 60;
      s.ell(cx, 128 + (i & 1) * 5, 50, 3.5, 30, 5);
      s.ell(cx + 10, 128 + (i & 1) * 5, 30, 2, 30, 9);
    }
  }

  // Reflected colour of everything above the water line: darker and bluer.
  var REFL = SHADE.slice();
  REFL[1] = 31; REFL[2] = 31; REFL[30] = 31; REFL[31] = 19; REFL[19] = 20; REFL[20] = 20;
  REFL[13] = 12; REFL[10] = 11; REFL[3] = 4; REFL[24] = 25; REFL[16] = 20; REFL[15] = 16;
  REFL[27] = 20; REFL[5] = 20; REFL[0] = 27; REFL[25] = 19; REFL[26] = 20;

  function waterRows(s, t) {
    var d = s.d, x, y;
    for (y = WL; y < H; y++) {
      var k = y - WL, src = WL - 1 - k;
      var ripple = Math.round(Math.sin(y * 0.7 + t * 0.3) * (0.6 + k * 0.05));
      var fade = Math.min(16, Math.floor(k * 0.42));
      var base = k < 42 ? 20 : 27;
      for (x = 0; x < W; x++) {
        var c = base;
        if (k >= 34 && k < 42 && bay(x, y) < (k - 34) * 2) c = 27;
        if (src >= 0 && bay(x + 1, y) >= fade) {
          var sx = x + ripple;
          c = REFL[d[src * W + (sx < 0 ? 0 : (sx >= W ? W - 1 : sx))]];
        }
        d[y * W + x] = c;
      }
    }
    for (var i = 0; i < 46; i++) {
      var yy = WL + 2 + Math.floor(rnd(i * 3 + 1) * (H - WL - 3));
      var xx = wrap(rnd(i * 3 + 2) * W + t * (0.2 + (yy - WL) * 0.01), W);
      if (((t >> 2) + i) % 4 === 0) continue;
      var len = 2 + (i % 4);
      for (var j = 0; j < len; j++) s.set(xx + j, yy, yy < WL + 20 ? 31 : 19);
    }
    // glitter under the sun
    for (i = 0; i < 16; i++) {
      var gy = WL + 2 + Math.floor(rnd(i + 300) * 24), gx = 84 + (rnd(i + 400) - 0.5) * (12 + (gy - WL) * 0.8);
      if (((t >> 1) + i) % 3) { s.set(gx, gy, 1); s.set(gx + 1, gy, 30); }
    }
  }

  function boat(s, t) {
    var x = Math.round(118 + Math.sin(t * 0.012) * 12), y = 172 + Math.round(Math.sin(t * 0.25));
    s.ell(x, y + 2, 16, 1.5, 31, 5);
    for (var i = -11; i <= 11; i++) {
      var up = i < -8 ? -8 - i : (i > 8 ? i - 8 : 0);
      s.set(x + i, y - up, 4); s.set(x + i, y + 1 - up, 5); s.set(x + i, y + 2, 27);
    }
    // fisherman under a straw hat, pushing a pole
    s.rect(x - 2, y - 7, 3, 6, 20); s.set(x, y - 7, 27); s.rect(x - 1, y - 9, 2, 2, 7);
    s.rect(x - 3, y - 10, 6, 1, 3); s.rect(x - 2, y - 11, 4, 1, 3); s.set(x - 1, y - 12, 4);
    s.line(x + 2, y - 6, x + 3, y - 5, 7);
    var lean = Math.round(Math.sin(t * 0.05) * 2);
    s.line(x + 8 + lean, y - 16, x - 6 - lean, y + 8, 4);
    s.rect(x + 5, y - 3, 4, 2, 3); s.set(x + 6, y - 4, 2);
  }

  // Foreground clumps of reeds and bulrushes swaying in the wind.
  var CLUMPS = [[6, 52, 9], [22, 40, 7], [40, 30, 6], [58, 22, 5], [-4, 34, 5], [74, 14, 4], [292, 46, 8], [312, 54, 7], [276, 26, 5]];
  function reeds(s, t) {
    for (var c = 0; c < CLUMPS.length; c++) {
      var cl = CLUMPS[c], n = cl[2];
      for (var i = 0; i < n; i++) {
        var r = rnd(c * 37 + i * 5 + 1), r2 = rnd(c * 37 + i * 5 + 2);
        var h = cl[1] * (0.55 + r * 0.45), lean = (i - n / 2) * 0.9 + (r2 - 0.5) * 2;
        var sw = Math.sin(t * 0.12 + c * 1.7 + i * 0.4) * (1 + h / 22);
        var x0 = cl[0] + (i - n / 2) * 1.6, base = H + 2;
        var col = r2 < 0.33 ? 14 : (r2 < 0.66 ? 15 : 16), px = x0, py = base;
        for (var j = 0; j < h; j++) {
          var q = j / h;
          px = x0 + lean * q * 4 + sw * q * q; py = base - j;
          s.set(px, py, q < 0.3 ? 16 : col);
          if (r > 0.55 && q < 0.7) s.set(px + 1, py, 16);
        }
        if (r2 > 0.5) {
          // bulrush head
          s.rect(px - 0.5, py - 1, 2, 5, 5); s.set(px - 0.5, py - 1, 4); s.set(px, py - 3, 27); s.set(px, py - 2, 4);
        } else if (r > 0.3) {
          // feathery plume
          for (var k = 0; k < 5; k++) { s.set(px + sw * 0.2 + (k & 1), py - k, k < 2 ? 3 : 2); s.set(px - 1 + (k > 2 ? 1 : 0), py - k + 1, 3); }
        }
        if (r < 0.35) {
          var bx = x0 + lean * 1.2, by = base - h * 0.35;
          s.line(bx, by, bx + (lean >= 0 ? 7 : -7) + sw, by - h * 0.3, 15);
          s.line(bx + (lean >= 0 ? 7 : -7) + sw, by - h * 0.3, bx + (lean >= 0 ? 10 : -10) + sw, by - h * 0.28, 14);
        }
      }
    }
  }

  function frame(t) {
    var L = layers(), s = new Pix();
    s.d.set(L.sky.d);
    clouds(s, t);
    s.over(L.far);
    mist(s, t);
    s.over(L.near);
    towerFlags(s, t);
    waterRows(s, t);
    boat(s, t);
    banner(s, t);
    reeds(s, t);
    return s;
  }

  var rgb = null;
  function palRGB() {
    if (rgb) return rgb;
    rgb = BK.PAL.map(function (h) { var n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; });
    return rgb;
  }

  function reducedMotion() {
    try { return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; }
  }

  BK.TitleArt = {
    W: W,
    H: H,
    // Palette indices of one frame, no DOM: { w, h, data: Uint8Array }.
    frame: function (t) { return { w: W, h: H, data: frame(t | 0).d }; },
    render: function (canvas) {
      if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
      var ctx = canvas.getContext('2d'), img = ctx.createImageData(W, H), raf = 0, n = 0, last = 0, seen = false;
      function blit(s) {
        var p = palRGB(), d = img.data;
        for (var i = 0; i < s.d.length; i++) {
          var q = p[s.d[i]], j = i * 4;
          d[j] = q[0]; d[j + 1] = q[1]; d[j + 2] = q[2]; d[j + 3] = 255;
        }
        ctx.putImageData(img, 0, 0);
      }
      function tick(now) {
        raf = 0;
        if (canvas.isConnected) seen = true;
        else if (seen) return;
        if (!last || now - last > 1000) last = now;
        var step = 1000 / FPS, drew = false;
        while (now - last >= step) { last += step; n++; drew = true; }
        if (drew) blit(frame(n));
        raf = root.requestAnimationFrame(tick);
      }
      blit(frame(0));
      if (!reducedMotion() && root.requestAnimationFrame) raf = root.requestAnimationFrame(tick);
      return {
        stop: function () {
          if (raf && root.cancelAnimationFrame) root.cancelAnimationFrame(raf);
          raf = 0;
        }
      };
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
