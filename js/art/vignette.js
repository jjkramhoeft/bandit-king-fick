/* Bandit King of Ancient China - small animated event scenes (136x52, BK.PAL only).
   Every scene is a pure function of the frame number, painted into a palette-index buffer
   and blitted at 12 fps. Scenes loop, or play once and hold their last frame. */
(function (root) {
  'use strict';
  var BK = root.BK = root.BK || {};

  var W = 136, H = 52, FPS = 12;
  var SHADE = [0, 24, 3, 4, 5, 27, 7, 8, 9, 5, 11, 5, 8, 12, 15, 16, 27, 16, 19, 20, 27, 20, 21, 22, 25, 26, 27, 0, 29, 15, 31, 25];
  var LIGHT = [27, 1, 1, 2, 3, 4, 2, 6, 7, 8, 12, 10, 13, 2, 28, 14, 15, 18, 30, 31, 19, 22, 23, 1, 1, 24, 25, 26, 30, 28, 1, 30];
  var BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  // Firelit version of every colour.
  var WARM = [5, 1, 1, 2, 3, 4, 2, 6, 7, 8, 12, 10, 13, 2, 13, 14, 15, 14, 2, 17, 21, 11, 23, 2, 2, 3, 4, 5, 2, 14, 2, 2];

  // Stateless pseudo-random number in [0,1) for frame-stable particles.
  function rnd(n) {
    n = (n ^ 61) ^ (n >>> 16);
    n = (n + (n << 3)) | 0;
    n ^= n >>> 4;
    n = Math.imul(n, 0x27d4eb2d);
    n ^= n >>> 15;
    return (n >>> 0) / 4294967296;
  }
  function wrap(v, m) { return ((v % m) + m) % m; }

  // ---- pixel buffer ----
  function Pix(w, h) { this.w = w; this.h = h; this.d = new Uint8Array(w * h); }
  Pix.prototype.set = function (x, y, c) {
    if (c == null || c < 0) return;
    x = Math.floor(x); y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.d[y * this.w + x] = c;
  };
  Pix.prototype.get = function (x, y) {
    x = Math.floor(x); y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return -1;
    return this.d[y * this.w + x];
  };
  Pix.prototype.rect = function (x, y, w, h, c) {
    x = Math.floor(x); y = Math.floor(y);
    for (var j = 0; j < h; j++) for (var i = 0; i < w; i++) this.set(x + i, y + j, c);
  };
  // Ordered-dither fill: colour c where the Bayer threshold is below lv (0..16).
  Pix.prototype.dith = function (x, y, w, h, c, lv) {
    x = Math.floor(x); y = Math.floor(y);
    for (var j = 0; j < h; j++) {
      for (var i = 0; i < w; i++) {
        var X = x + i, Y = y + j;
        if (BAYER[(Y & 3) * 4 + (X & 3)] < lv) this.set(X, Y, c);
      }
    }
  };
  Pix.prototype.line = function (x0, y0, x1, y1, c) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    var dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, e = dx + dy;
    for (var n = 0; n < 400; n++) {
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
        if (dx * dx + dy * dy <= 1 && (lv == null || BAYER[(y & 3) * 4 + (x & 3)] < lv)) this.set(x, y, c);
      }
    }
  };
  // Vertical two-colour dithered gradient.
  Pix.prototype.vgrad = function (y0, y1, a, b) {
    for (var y = y0; y < y1; y++) {
      var lv = Math.floor((y - y0 + 0.5) / (y1 - y0) * 17);
      for (var x = 0; x < this.w; x++) this.set(x, y, BAYER[(y & 3) * 4 + (x & 3)] < lv ? b : a);
    }
  };
  // Warm light pool: lift colours inside an ellipse towards firelight, dithered at the rim.
  Pix.prototype.warm = function (cx, cy, rx, ry, lv) {
    for (var y = Math.floor(cy - ry); y <= cy + ry; y++) {
      for (var x = Math.floor(cx - rx); x <= cx + rx; x++) {
        var dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry, d = dx * dx + dy * dy;
        if (d > 1) continue;
        var l = d < 0.6 ? 16 : (lv || 8);
        if (BAYER[(y & 3) * 4 + (x & 3)] >= l) continue;
        var c = this.get(x, y);
        if (c >= 0) this.set(x, y, WARM[c]);
      }
    }
  };
  // Darken a share of all pixels (night, gloom).
  Pix.prototype.dim = function (lv, x0, y0, x1, y1) {
    x0 = x0 || 0; y0 = y0 || 0; x1 = x1 == null ? this.w : x1; y1 = y1 == null ? this.h : y1;
    for (var y = y0; y < y1; y++) {
      for (var x = x0; x < x1; x++) {
        if (BAYER[(y & 3) * 4 + (x & 3)] < lv) { var i = y * this.w + x; this.d[i] = SHADE[this.d[i]]; }
      }
    }
  };
  // Draw a string-art sprite. map: char -> colour; '.' and unknown chars are transparent.
  Pix.prototype.spr = function (rows, map, x, y, flip) {
    for (var j = 0; j < rows.length; j++) {
      var r = rows[j];
      for (var i = 0; i < r.length; i++) {
        var c = map[r[i]];
        if (c != null) this.set(flip ? x + r.length - 1 - i : x + i, y + j, c);
      }
    }
  };

  // ---- seasons ----
  var SEASONS = {
    Spring: { name: 'Spring', sky: [19, 31], far: 31, farTop: 30, hill: 29, hill2: 15, g: 15, g2: 14, gd: 16, leaf: 15, leaf2: 14, leafD: 16, bloom: 23, cloud: 1, road: 3, water: 19, waterD: 20, waterHi: 18 },
    Summer: { name: 'Summer', sky: [19, 18], far: 31, farTop: 30, hill: 16, hill2: 15, g: 15, g2: 16, gd: 16, leaf: 16, leaf2: 15, leafD: 27, bloom: null, cloud: 1, road: 3, water: 19, waterD: 20, waterHi: 18 },
    Autumn: { name: 'Autumn', sky: [31, 2], far: 25, farTop: 24, hill: 8, hill2: 3, g: 3, g2: 14, gd: 4, leaf: 12, leaf2: 10, leafD: 11, bloom: 13, cloud: 30, road: 4, water: 20, waterD: 27, waterHi: 31 },
    Winter: { name: 'Winter', sky: [25, 24], far: 31, farTop: 30, hill: 31, hill2: 30, g: 30, g2: 31, gd: 24, leaf: null, leaf2: null, leafD: null, bloom: null, cloud: 30, road: 24, water: 31, waterD: 25, waterHi: 1 }
  };
  function seasonOf(o) { return SEASONS[o && o.season] || SEASONS.Spring; }

  // ---- landscape pieces ----
  function cloud(s, x, y, w, c, sh) {
    s.ell(x, y, w / 2, 2, c);
    s.ell(x - w / 5, y - 1.5, w / 4, 2, c);
    s.ell(x + w / 6, y - 1, w / 5, 1.8, c);
    for (var i = Math.floor(x - w / 2) + 1; i < x + w / 2 - 1; i++) s.set(i, Math.floor(y + 1.5), sh);
  }

  function ridge(s, off, base, amp, seed, c, top, bottom, peaky) {
    for (var x = 0; x < W; x++) {
      var u = x + off, v;
      if (peaky) v = 1 - Math.abs(Math.sin(u * 0.045 + seed)) * 1.3 + Math.sin(u * 0.19 + seed * 3) * 0.18;
      else v = Math.sin(u * 0.06 + seed) * 0.5 + Math.sin(u * 0.15 + seed * 2.3) * 0.25 + Math.sin(u * 0.023 + seed * 0.7) * 0.5;
      var y0 = Math.round(base - v * amp);
      for (var y = y0; y < bottom; y++) s.set(x, y, c);
      if (top != null) { s.set(x, y0, top); if (peaky && v > 0.55) s.set(x, y0 + 1, top); }
    }
  }

  // Sky, clouds, far range, hills and ground. Returns nothing; gy is the horizon row.
  function land(s, S, t, gy, opt) {
    opt = opt || {};
    var off = opt.scroll || 0;
    s.rect(0, 0, W, gy - 13, S.sky[0]);
    s.vgrad(gy - 13, gy, S.sky[0], S.sky[1]);
    if (S.name === 'Summer') { s.ell(112, 7, 3.5, 3.5, 13); s.ell(112, 7, 2, 2, 1); }
    if (!opt.noClouds) {
      for (var i = 0; i < 3; i++) {
        var cx = wrap(i * 53 + 10 + t * (0.12 + i * 0.04) - off * 0.1, W + 40) - 20;
        cloud(s, cx, 5 + i * 4, 14 + i * 4, S.cloud, S.name === 'Winter' ? 24 : 31);
      }
    }
    ridge(s, off * 0.15, gy - 6, 7, 1.3, S.far, S.farTop, gy, true);
    s.dith(0, gy - 3, W, 3, S.sky[1], 6);
    ridge(s, off * 0.35, gy - 1, 3, 4.1, S.hill, LIGHT[S.hill], gy + 2, false);
    for (var y = gy; y < H; y++) {
      for (var x = 0; x < W; x++) {
        var u = x + off;
        var c = S.g;
        if (((y - gy) % 5 === 2) && ((u + y * 3) % 7 < 3)) c = S.g2;
        if (((u * 7 + y * 13) % 23) === 0) c = S.gd;
        s.set(x, y, c);
      }
    }
    s.dith(0, gy, W, 2, S.hill, 8);
  }

  // Flat ground with sparse horizontal texture dashes (calmer than a dither).
  function groundTex(s, y0, c, tc, step) {
    step = step || 9;
    s.rect(0, y0, W, H - y0, c);
    for (var y = y0 + 1; y < H; y += 3) for (var x = (y * 7) % step; x < W; x += step) s.rect(x, y, 3 + (y & 1), 1, tc);
  }

  function seasonFx(s, S, t, n, wind) {
    wind = wind == null ? 0.3 : wind;
    for (var i = 0; i < n; i++) {
      var sp = 0.35 + rnd(i * 7 + 1) * 0.5;
      var y = wrap(rnd(i * 7 + 2) * (H + 10) + t * sp, H + 10) - 5;
      var x = wrap(rnd(i * 7 + 3) * (W + 20) + t * wind + Math.sin(t * 0.15 + i) * 3, W + 20) - 10;
      var flip = ((t >> 1) + i) & 1;
      if (S.name === 'Winter') { s.set(x, y, i % 3 ? 30 : 1); }
      else if (S.name === 'Spring') { s.set(x, y, i % 2 ? 23 : 1); if (flip) s.set(x + 1, y, 23); }
      else if (S.name === 'Autumn') { var c = [10, 12, 13, 11][i % 4]; s.set(x, y, c); s.set(x + (flip ? 1 : 0), y + (flip ? 0 : 1), SHADE[c]); }
      else if (i < n / 3) { s.set(x, y, 1); if (flip) { s.set(x - 1, y - 1, 1); s.set(x + 1, y - 1, 1); } }
    }
  }

  function tree(s, x, y, S, t, size, kind) {
    var h = size || 10, sway = Math.round(Math.sin(t * 0.25 + x * 0.3) * 0.6);
    var trunk = 5, i;
    if (kind === 'pine') {
      s.rect(x, y - 3, 1, 3, trunk);
      for (i = 0; i < 4; i++) {
        var w = 1 + (4 - i) * h / 10, yy = y - 3 - i * (h / 5);
        for (var j = 0; j < 3; j++) s.rect(x - w + j * 0.6 + sway * (i > 1 ? 1 : 0), yy - j, (w - j * 0.6) * 2 + 1, 1, j === 0 ? 16 : (j === 1 ? 16 : 15));
        if (S.name === 'Winter') s.rect(x - w + 1 + sway, yy - 2, w * 2 - 1, 1, 30);
      }
      s.set(x + sway, y - 3 - 4 * (h / 5) - 1, S.name === 'Winter' ? 30 : 16);
      return;
    }
    s.line(x, y, x, y - h * 0.5, trunk);
    s.line(x + 1, y, x + 1, y - h * 0.4, 27);
    s.line(x, y - h * 0.45, x - h * 0.3, y - h * 0.75, trunk);
    s.line(x + 1, y - h * 0.4, x + h * 0.35 + sway, y - h * 0.8, trunk);
    if (!S.leaf) {
      s.line(x, y - h * 0.5, x + sway, y - h, trunk);
      s.line(x - h * 0.3, y - h * 0.75, x - h * 0.45, y - h * 0.9, trunk);
      s.set(x - h * 0.3, y - h * 0.75 - 1, 30); s.set(x + h * 0.35 + sway, y - h * 0.8 - 1, 30); s.set(x + sway, y - h - 1, 30);
      return;
    }
    var cx = x + 0.5 + sway, cy = y - h * 0.72, r = h * 0.42;
    var blossom = kind === 'blossom' && S.bloom != null;
    var spring = S.name === 'Spring';
    var c0 = blossom ? S.bloom : S.leaf, c1 = blossom ? (spring ? 22 : 12) : S.leafD, c2 = blossom ? (spring ? 1 : 2) : S.leaf2;
    s.ell(cx, cy, r * 1.15, r * 0.85, c1);
    s.ell(cx - r * 0.25, cy - r * 0.2, r, r * 0.7, c0);
    s.ell(cx - r * 0.35, cy - r * 0.35, r * 0.55, r * 0.4, c2, 9);
    if (S.name === 'Autumn') s.ell(cx + r * 0.3, cy + r * 0.1, r * 0.5, r * 0.4, 10, 8);
    if (S.name === 'Spring' && !blossom) {
      for (i = 0; i < 5; i++) s.set(cx - r + rnd(x * 9 + i) * r * 2, cy - r * 0.6 + rnd(x * 5 + i) * r, 23);
    }
  }

  function roof(s, x0, x1, y, rh, c, snow) {
    var cs = SHADE[c], cl = LIGHT[c];
    for (var i = 0; i < rh; i++) {
      var inset = Math.round(i * 1.4) + (i > 0 ? 1 : 0);
      for (var x = x0 + inset; x <= x1 - inset; x++) s.set(x, y - i, i === 0 ? cs : ((x & 1) && i < rh - 1 ? c : cl));
    }
    s.set(x0 - 1, y - 1, cs); s.set(x1 + 1, y - 1, cs); s.set(x0 - 2, y - 2, cs); s.set(x1 + 2, y - 2, cs);
    var top = y - rh + 1, ti = Math.round((rh - 1) * 1.4) + 1;
    s.rect(x0 + ti - 1, top - 1, x1 - x0 - ti * 2 + 3, 1, cs);
    s.set(x0 + ti - 2, top - 2, cs); s.set(x1 - ti + 2, top - 2, cs);
    if (snow) for (var xx = x0 + ti - 1; xx <= x1 - ti + 1; xx++) { s.set(xx, top - 1, 30); s.set(xx, top - 2, (xx & 3) ? 30 : -1); }
  }

  // A house standing on y (ground row), left edge x.
  function house(s, x, y, w, h, o) {
    o = o || {};
    var wall = o.wall != null ? o.wall : 2, post = o.post != null ? o.post : 11, rc = o.roof != null ? o.roof : 26;
    s.rect(x, y - h, w, h, wall);
    s.rect(x + w - 2, y - h, 2, h, SHADE[wall]);
    s.rect(x, y - h, 1, h, post); s.rect(x + w - 1, y - h, 1, h, post);
    if (w > 10) { var mid = x + (w >> 1); s.rect(mid - 2, y - h + 2, 4, h - 2, o.door != null ? o.door : 5); s.set(mid, y - 3, 13); }
    if (o.window !== false) {
      var wc = o.lit ? 13 : 27;
      s.rect(x + 2, y - h + 2, 3, 2, wc); s.set(x + 3, y - h + 2, o.lit ? 12 : 4);
      if (w > 14) { s.rect(x + w - 6, y - h + 2, 3, 2, wc); s.set(x + w - 5, y - h + 2, o.lit ? 12 : 4); }
    }
    roof(s, x - 2, x + w + 1, y - h - 1, o.rh || 4, rc, o.snow);
  }

  // Water rows y0..y1 with drifting highlight dashes; mask(x, y) limits it to a shape.
  function water(s, y0, y1, t, c, cd, hi, speed, mask) {
    var put = function (x, y, cc) { if (!mask || mask(Math.floor(x), y)) s.set(x, y, cc); };
    for (var y = y0; y < y1; y++) {
      var lv = Math.floor((y - y0) / Math.max(1, y1 - y0) * 12);
      for (var x = 0; x < W; x++) put(x, y, BAYER[(y & 3) * 4 + (x & 3)] < lv ? cd : c);
    }
    var n = Math.floor((y1 - y0) * W / 60);
    for (var i = 0; i < n; i++) {
      var yy = y0 + Math.floor(rnd(i * 3 + 5) * (y1 - y0));
      var xx = wrap(rnd(i * 3 + 6) * W + t * (speed || 0.4) * (0.5 + (yy - y0) / (y1 - y0)), W + 8) - 4;
      var on = ((t >> 2) + i) % 3 !== 0;
      if (on) { put(xx, yy, hi); put(xx + 1, yy, hi); if (i & 1) put(xx + 2, yy, LIGHT[hi]); }
    }
  }

  function fire(s, x, y, t, size) {
    size = size || 1;
    var w = Math.round(3 * size), i;
    for (i = -w; i <= w; i++) {
      var hgt = (w + 1 - Math.abs(i)) * 1.6 * size + rnd(t * 13 + i * 7) * 3 * size;
      for (var j = 0; j < hgt; j++) {
        var q = j / hgt, c = q < 0.3 ? 13 : (q < 0.6 ? 12 : (q < 0.85 ? 10 : 11));
        if (Math.abs(i) === w && q > 0.4) c = 11;
        s.set(x + i + (j > hgt * 0.6 ? Math.round(rnd(t * 5 + i) - 0.5) : 0), y - j, c);
      }
    }
    for (i = 0; i < 4 * size; i++) {
      var age = wrap(t + i * 5, 14);
      s.set(x + Math.sin(i * 2 + age * 0.4) * 2, y - 4 * size - age * 1.2, age < 6 ? 13 : (age < 10 ? 12 : 11));
    }
  }

  function smoke(s, x, y, t, n, c, wind, life) {
    life = life || 40;
    for (var i = 0; i < n; i++) {
      var age = wrap(t + i * Math.floor(life / n), life);
      var r = 1 + age / 9, lv = Math.max(2, 12 - Math.floor(age * 10 / life));
      s.ell(x + age * (wind == null ? 0.25 : wind) + Math.sin(age * 0.2 + i) * 1.5, y - age * 0.7, r, r * 0.8, c, lv);
    }
  }

  function flag(s, x, y, w, h, t, c, d, mark) {
    d = d || 1;
    for (var i = 1; i <= w; i++) {
      var off = Math.round(Math.sin(t * 0.5 - i * 0.7) * (i / w) * 1.5);
      for (var j = 0; j < h; j++) {
        var cc = (Math.sin(t * 0.5 - i * 0.7) > 0.3) ? SHADE[c] : c;
        s.set(x + i * d, y + j + off, cc);
      }
      if (mark != null && i === Math.ceil(w / 2)) s.set(x + i * d, y + (h >> 1) + off, mark);
    }
  }

  function lantern(s, x, y, c) {
    c = c == null ? 10 : c;
    s.set(x, y - 1, 27);
    s.rect(x - 1, y, 3, 1, 13); s.rect(x - 1, y + 1, 3, 2, c); s.set(x + 1, y + 1, SHADE[c]); s.set(x - 1, y + 1, LIGHT[c]);
    s.rect(x - 1, y + 3, 3, 1, 13); s.set(x, y + 4, 12);
  }

  function bird(s, x, y, t, c) {
    var up = (t >> 1) & 1;
    s.set(x, y, c); s.set(x - 1, y - up, c); s.set(x + 1, y - up, c); s.set(x - 2, y - up * 2 + 1 - up, c); s.set(x + 2, y - up * 2 + 1 - up, c);
  }

  // ---- figures ----
  // A small figure with feet at (x, y), about 11 px tall.
  // o: c robe, l legs, k skin, h hat, hc hat/hair colour, d facing (1, -1, 0), p pose, f frame, w held item
  function man(s, x, y, o) {
    var c = o.c != null ? o.c : 19, cs = SHADE[c], l = o.l != null ? o.l : 27, k = o.k != null ? o.k : 7;
    var d = o.d == null ? 1 : o.d, dd = d || 1, f = o.f | 0, p = o.p || 'stand', hc = o.hc != null ? o.hc : 27;
    var hip, lean = o.lean || 0, a = o.a || 'down';
    x = Math.round(x); y = Math.round(y);
    if (p === 'jump' && (f & 1)) y -= 2;
    if (p === 'sit') {
      hip = y - 1;
      s.set(x - 1, y, l); s.set(x, y, l); s.set(x + dd, y, l); s.set(x + 2 * dd, y, l); s.set(x + 3 * dd, y, 27);
    } else if (p === 'ride') {
      hip = y;
      s.set(x, y + 1, l); s.set(x, y + 2, l); s.set(x + dd, y + 3, 27);
    } else if (p === 'kneel') {
      hip = y - 2;
      s.set(x - dd, y, l); s.set(x - 2 * dd, y, 27); s.set(x + dd, y - 1, l); s.set(x + dd, y, l); s.set(x, y - 1, l);
    } else {
      hip = y - 2;
      if ((p === 'walk' || p === 'run') && (f & 1)) {
        s.set(x - 1, y - 2, l); s.set(x + 1, y - 2, l); s.set(x - 2, y - 1, l); s.set(x + 2, y - 1, l); s.set(x - 2, y, 27); s.set(x + 2, y, 27);
      } else {
        s.set(x - 1, y - 2, l); s.set(x + 1, y - 2, l); s.set(x - 1, y - 1, l); s.set(x + 1, y - 1, l); s.set(x - 1, y, 27); s.set(x + 1, y, 27);
      }
      if (p === 'walk' || p === 'run') s.set(x, y - 2, l);
    }
    // torso
    for (var r = 0; r < 5; r++) {
      var ox = Math.round(lean * (5 - r) / 5) * dd, yy = hip - 5 + r;
      s.set(x - 1 + ox, yy, c); s.set(x + ox, yy, c); s.set(x + 1 + ox, yy, cs);
      if (r === 3 && o.belt != null) { s.set(x - 1 + ox, yy, o.belt); s.set(x + ox, yy, o.belt); s.set(x + 1 + ox, yy, SHADE[o.belt]); }
    }
    // head
    var hx = x + lean * dd, hy = hip - 8 + (lean > 1 ? 1 : 0);
    s.set(hx - 1, hy + 1, d ? (d > 0 ? hc : k) : k); s.set(hx, hy + 1, k); s.set(hx + 1, hy + 1, d < 0 ? hc : k);
    if (d > 0) s.set(hx - 1, hy + 1, hc);
    s.set(hx - (d < 0 ? 1 : 0), hy + 2, k); s.set(hx + (d < 0 ? 0 : 1), hy + 2, SHADE[k]);
    if (!d) { s.set(hx - 1, hy + 2, k); s.set(hx + 1, hy + 2, SHADE[k]); }
    hat(s, hx, hy, o.h, hc, dd, k, o);
    // arms
    var fx = x + 2 * dd + lean * dd, bx = x - 2 * dd + Math.round(lean / 2) * dd, ay = hip - 5 + (lean > 1 ? 1 : 0);
    var hand = { x: fx, y: ay + 3 };
    if (a === 'up' || (a === 'cheer' && (f & 1))) {
      s.set(fx, ay, c); s.set(fx, ay - 1, c); s.set(fx, ay - 2, k);
      s.set(bx, ay, cs); s.set(bx, ay - 1, cs); s.set(bx, ay - 2, k);
      hand = { x: fx, y: ay - 2 };
    } else if (a === 'raise' || a === 'cheer') {
      s.set(fx, ay, c); s.set(fx, ay - 1, c); s.set(fx, ay - 2, k);
      s.set(bx, ay, cs); s.set(bx, ay + 1, cs); s.set(bx, ay + 2, k);
      hand = { x: fx, y: ay - 2 };
    } else if (a === 'fwd') {
      s.set(fx, ay, c); s.set(fx + dd, ay, c); s.set(fx + 2 * dd, ay, k);
      s.set(bx, ay, cs); s.set(bx, ay + 1, cs); s.set(bx, ay + 2, k);
      hand = { x: fx + 2 * dd, y: ay };
    } else if (a === 'mouth') {
      s.set(fx, ay, c); s.set(fx, ay - 1, k);
      s.set(bx, ay, cs); s.set(bx, ay + 1, cs); s.set(bx, ay + 2, k);
      hand = { x: fx, y: ay - 1 };
    } else if (a === 'hold') {
      s.set(fx, ay, c); s.set(fx, ay + 1, k);
      s.set(bx, ay, cs); s.set(bx, ay + 1, cs); s.set(bx, ay + 2, k);
      hand = { x: fx, y: ay + 1 };
    } else if (a !== 'none') {
      var sw = (p === 'walk' || p === 'run') ? ((f & 1) ? 1 : -1) : 0;
      s.set(fx, ay, c); s.set(fx + (sw > 0 ? dd : 0), ay + 1, c); s.set(fx + (sw > 0 ? dd : 0), ay + 2, k);
      s.set(bx, ay, cs); s.set(bx - (sw < 0 ? dd : 0), ay + 1, cs); s.set(bx - (sw < 0 ? dd : 0), ay + 2, k);
      hand = { x: fx + (sw > 0 ? dd : 0), y: ay + 2 };
    }
    item(s, hand, o.w, dd, f, o, hip, y);
    return hand;
  }

  function hat(s, x, y, h, hc, d, k, o) {
    switch (h) {
      case 'straw':
        s.rect(x - 2, y + 1, 5, 1, 3); s.set(x + 2, y + 1, 4); s.rect(x - 1, y, 3, 1, 3); s.set(x + 1, y, 4); s.set(x, y - 1, 4);
        break;
      case 'helmet':
        s.rect(x - 1, y, 3, 1, 25); s.set(x - 1, y, 24); s.rect(x - 1, y - 1, 3, 1, 25); s.set(x + 1, y - 1, 26);
        s.set(x, y - 2, o.plume != null ? o.plume : 10);
        break;
      case 'official':
        s.rect(x - 1, y, 3, 1, 0); s.rect(x - 1, y - 1, 3, 1, 0); s.set(x - 2, y, 26); s.set(x - 3, y, 26); s.set(x + 2, y, 26); s.set(x + 3, y, 26);
        break;
      case 'cap':
        s.rect(x - 1, y, 3, 1, hc); s.set(x, y - 1, hc); s.set(x - d * 2, y + 1, SHADE[hc] === 0 ? 26 : SHADE[hc]);
        break;
      case 'crown':
        s.rect(x - 1, y, 3, 1, 0); s.rect(x - 2, y - 1, 5, 1, 13); s.set(x - 2, y, 12); s.set(x + 2, y, 12);
        break;
      case 'bun':
        s.rect(x - 1, y, 3, 1, hc); s.set(x - d, y - 1, hc); s.set(x - d * 2, y - 1, 13);
        break;
      case 'bald':
        s.rect(x - 1, y, 3, 1, k); s.set(x + 1, y, SHADE[k]);
        break;
      case 'band':
        s.rect(x - 1, y, 3, 1, hc); s.set(x, y - 1, hc); s.set(x - 1, y + 1, o.band != null ? o.band : 10);
        if (d > 0) s.set(x - 2, y + 1, o.band != null ? o.band : 10); else s.set(x + 2, y + 1, o.band != null ? o.band : 10);
        break;
      default:
        s.rect(x - 1, y, 3, 1, hc); s.set(x, y - 1, hc);
    }
  }

  function item(s, hd, w, d, f, o, hip, foot) {
    var x = hd.x, y = hd.y, i;
    switch (w) {
      case 'spear':
        if (o.a === 'fwd') {
          s.line(x - 4 * d, y, x + 8 * d, y, 4); s.set(x + 9 * d, y, 24); s.set(x + 10 * d, y, 1);
        } else {
          s.line(x, foot, x, y - 9, 4); s.set(x, y - 10, 24); s.set(x, y - 11, 1);
        }
        break;
      case 'banner':
        s.line(x, foot, x, y - 13, 5); s.set(x, y - 14, 13);
        flag(s, x, y - 13, 6, 4, f + x, o.fc != null ? o.fc : 10, -d, o.fm);
        break;
      case 'torch':
        s.set(x, y - 1, 5); s.set(x, y - 2, 4);
        s.set(x, y - 3, 12); s.set(x + (rnd(f * 3 + x) < 0.5 ? -1 : 0), y - 4, 13); s.set(x + (rnd(f * 5 + x) < 0.5 ? 0 : 1), y - 4, 12);
        s.set(x, y - 5 + (f & 1), 10); s.set(x + (f & 1 ? 1 : -1), y - 3, 10);
        break;
      case 'cup':
        s.set(x, y - 1, 2); s.set(x + d, y - 1, 2);
        break;
      case 'sword':
        if (o.a === 'raise' || o.a === 'up' || o.a === 'cheer') { for (i = 1; i <= 4; i++) s.set(x, y - i, i === 4 ? 1 : 24); s.set(x - 1, y, 13); s.set(x + 1, y, 13); }
        else { for (i = 1; i <= 4; i++) s.set(x + i * d, y + 1 - (i > 2 ? 1 : 0), 24); }
        break;
      case 'bow':
        for (i = -3; i <= 3; i++) s.set(x + d * (Math.abs(i) < 2 ? 1 : 0), y + i, 4);
        s.line(x, y - 3, x, y + 3, 24);
        break;
      case 'hammer':
        if (o.a === 'raise' || o.a === 'up') { s.set(x, y - 1, 4); s.set(x, y - 2, 4); s.rect(x - 1, y - 4, 3, 2, 26); }
        else { s.set(x + d, y, 4); s.set(x + 2 * d, y, 4); s.rect(x + 3 * d - (d < 0 ? 1 : 0), y - 1, 2, 3, 26); }
        break;
      case 'pole':
        s.line(x - 7 * d, hip - 6, x + 6 * d, hip - 6, 4);
        s.line(x - 7 * d, hip - 6, x - 7 * d, hip - 3, 3); s.line(x + 6 * d, hip - 6, x + 6 * d, hip - 3, 3);
        s.rect(x - 7 * d - 1, hip - 2, 3, 3, o.load != null ? o.load : 4); s.rect(x + 6 * d - 1, hip - 2, 3, 3, o.load != null ? o.load : 4);
        s.set(x - 7 * d - 1, hip - 2, 3); s.set(x + 6 * d - 1, hip - 2, 3);
        break;
      case 'plank':
        s.line(x - 9 * d, hip - 8, x + 5 * d, hip - 7, 3); s.line(x - 9 * d, hip - 7, x + 5 * d, hip - 6, 4);
        break;
      case 'sack':
        s.rect(x - (d > 0 ? 3 : 1), hip - 9, 5, 3, 3); s.set(x - (d > 0 ? 3 : 1), hip - 9, 2); s.rect(x - (d > 0 ? 3 : 1), hip - 7, 5, 1, 4);
        break;
      case 'staff':
        s.line(x + d, y - 3, x + d, foot, 4);
        break;
      case 'scroll':
        s.rect(x - 1, y - 1, 3, 2, 2); s.set(x - 1, y - 1, 13); s.set(x + 1, y - 1, 13);
        break;
    }
  }

  // Tiny crowd figure, 2 px wide and 7 tall.
  function tiny(s, x, y, c, k, f, arm, hc) {
    x = Math.round(x); y = Math.round(y);
    var l = SHADE[c] === c ? 27 : SHADE[c];
    s.set(x, y, 27); s.set(x + 1, y, 27);
    s.set(x + (f & 1), y - 1, l); s.set(x + 1 - (f & 1), y - 1, l);
    s.rect(x, y - 4, 2, 3, c); s.set(x + 1, y - 3, SHADE[c]);
    s.set(x, y - 5, k); s.set(x + 1, y - 5, SHADE[k]); s.set(x, y - 6, hc == null ? 27 : hc); s.set(x + 1, y - 6, hc == null ? 27 : hc);
    if (arm) { s.set(x + 2, y - 5, c); s.set(x + 2, y - 6, k); }
  }

  // ---- animals ----
  function M(s, ox, d) { return function (lx, y, c) { s.set(ox + lx * d, y, c); }; }
  function ML(s, ox, d) { return function (x0, y0, x1, y1, c) { s.line(ox + x0 * d, y0, ox + x1 * d, y1, c); }; }

  // Horse facing d, centre x, hooves on y; f is the gait frame (0..3).
  function horse(s, x, y, d, f, c, mane) {
    var p = M(s, x, d), L = ML(s, x, d), cs = SHADE[c], m = mane != null ? mane : 27, i, j;
    f = wrap(f, 4);
    var legs = [
      [[4, 5], [3, 2], [-4, -3], [-3, -5]],
      [[4, 7], [3, 5], [-4, -7], [-3, -5]],
      [[4, 2], [3, 3], [-4, -2], [-3, -3]],
      [[4, 3], [3, 5], [-4, -5], [-3, -3]]
    ][f];
    var lift = f === 1 ? 1 : 0;
    for (i = 0; i < 4; i++) {
      var lc = i % 2 ? cs : c;
      L(legs[i][0], y - 4, legs[i][1], y - (f === 1 && i % 2 === 0 ? 1 : 0), lc);
      p(legs[i][1], y - (f === 1 && i % 2 === 0 ? 1 : 0), 27);
    }
    for (j = 0; j < 4; j++) for (i = -5; i <= 5; i++) {
      if ((j === 0 || j === 3) && (i === -5 || i === 5)) continue;
      p(i, y - 8 + j - lift, j === 3 ? cs : c);
    }
    for (i = -4; i <= 4; i++) p(i, y - 5 - lift, cs);
    L(4, y - 8 - lift, 6, y - 11 - lift, c); L(5, y - 8 - lift, 7, y - 11 - lift, c);
    for (i = 6; i <= 8; i++) p(i, y - 12 - lift, c);
    p(9, y - 11 - lift, c); p(9, y - 10 - lift, cs); p(8, y - 11 - lift, c); p(8, y - 10 - lift, cs);
    p(6, y - 13 - lift, c); p(7, y - 11 - lift, 27);
    L(4, y - 9 - lift, 6, y - 12 - lift, m);
    var tw = Math.round(Math.sin(f * 1.6));
    L(-6, y - 8 - lift, -7, y - 6 + tw - lift, m); p(-8, y - 5 + tw - lift, m);
  }

  function deer(s, x, y, d, f) {
    var p = M(s, x, d), L = ML(s, x, d), c = 8, cs = 9, i;
    f = wrap(f, 2);
    var lift = f ? 1 : 0;
    for (i = -4; i <= 3; i++) { p(i, y - 6 - lift, c); p(i, y - 5 - lift, i < 2 ? c : cs); p(i, y - 4 - lift, cs); }
    p(-4, y - 6 - lift, 1); p(-5, y - 6 - lift, 1);
    if (f) { L(3, y - 4 - lift, 6, y - 3, cs); L(2, y - 4 - lift, 5, y - 2, c); L(-3, y - 4 - lift, -6, y - 3, cs); L(-4, y - 4 - lift, -7, y - 2, c); }
    else { L(3, y - 4, 3, y, cs); L(2, y - 4, 1, y, c); L(-3, y - 4, -3, y, cs); L(-4, y - 4, -2, y, c); }
    L(3, y - 7 - lift, 4, y - 9 - lift, c);
    p(4, y - 10 - lift, c); p(5, y - 10 - lift, c); p(6, y - 9 - lift, cs); p(5, y - 9 - lift, c);
    p(4, y - 11 - lift, 5); p(3, y - 12 - lift, 5); p(5, y - 12 - lift, 5); p(3, y - 13 - lift, 5); p(6, y - 13 - lift, 5);
    p(5, y - 10 - lift, 27);
  }

  function boar(s, x, y, d, f) {
    var p = M(s, x, d), L = ML(s, x, d), c = 26, cs = 27, i;
    f = wrap(f, 2);
    var lift = f ? 1 : 0;
    for (i = -4; i <= 4; i++) {
      p(i, y - 6 - lift, i % 2 ? cs : c); p(i, y - 5 - lift, c); p(i, y - 4 - lift, c); p(i, y - 3 - lift, cs);
    }
    p(-3, y - 7 - lift, cs); p(-1, y - 7 - lift, cs); p(1, y - 7 - lift, cs);
    for (i = 5; i <= 6; i++) { p(i, y - 5 - lift, c); p(i, y - 4 - lift, c); }
    p(7, y - 4 - lift, 9); p(6, y - 3 - lift, 1); p(5, y - 6 - lift, cs); p(6, y - 5 - lift, 0);
    p(-5, y - 5 - lift, cs); p(-6, y - 6 - lift, cs);
    if (f) { L(3, y - 3, 5, y, cs); L(-3, y - 3, -5, y, cs); }
    else { L(3, y - 3, 2, y, cs); L(-3, y - 3, -2, y, cs); L(2, y - 3, 3, y, c); L(-2, y - 3, -3, y, c); }
  }

  function tiger(s, x, y, d, f, t) {
    var p = M(s, x, d), L = ML(s, x, d), c = 12, cs = 8, i, j;
    f = wrap(f, 4);
    var step = [[2, -2], [1, -1], [-1, 1], [-2, 2]][f];
    L(5, y - 4, 5 + step[0], y, cs); L(4, y - 4, 4 + step[1], y, c);
    L(-5, y - 4, -5 + step[1], y, cs); L(-6, y - 4, -6 + step[0], y, c);
    p(5 + step[0], y, 1); p(4 + step[1], y, 1); p(-5 + step[1], y, 1); p(-6 + step[0], y, 1);
    for (j = 0; j < 4; j++) for (i = -7; i <= 6; i++) {
      if (j === 0 && (i === -7 || i === 6)) continue;
      var cc = j === 3 ? 2 : (j === 0 ? 13 : c);
      if (((i + 9) % 3 === 0) && j < 3) cc = 27;
      p(i, y - 8 + j, cc);
    }
    for (j = 0; j < 4; j++) for (i = 7; i <= 10; i++) p(i, y - 10 + j, j === 3 ? 2 : c);
    p(7, y - 11, 27); p(10, y - 11, 27); p(11, y - 8, 2); p(11, y - 7, 27);
    p(9, y - 9, 14); p(8, y - 10, 27); p(10, y - 10, 27);
    var sw = Math.sin(t * 0.3);
    for (i = 0; i < 7; i++) p(-8 - i, y - 8 - Math.round(Math.sin(i * 0.5 + sw) * 2 + i * 0.3), i % 2 ? 27 : c);
  }

  function ox(s, x, y, d, f) {
    var p = M(s, x, d), L = ML(s, x, d), c = 4, cs = 5, i, j;
    f = wrap(f, 2);
    for (j = 0; j < 5; j++) for (i = -6; i <= 5; i++) {
      if (j === 0 && (i === -6 || i === 5)) continue;
      p(i, y - 9 + j, j === 4 ? cs : (j === 0 ? 3 : c));
    }
    var a = f ? 1 : 0;
    L(4, y - 4, 4 + a, y, cs); L(3, y - 4, 3 - a, y, c); L(-5, y - 4, -5 - a, y, cs); L(-4, y - 4, -4 + a, y, c);
    for (j = 0; j < 4; j++) for (i = 6; i <= 8; i++) p(i, y - 8 + j, j === 3 ? 3 : c);
    p(9, y - 6, 3); p(9, y - 5, 3); p(7, y - 9, 2); p(8, y - 10, 2); p(6, y - 9, 2); p(5, y - 10, 2);
    p(8, y - 7, 27); p(-7, y - 8, cs); p(-7, y - 7, cs); p(-7, y - 6 + a, 27);
  }

  // ---- buildings and props ----
  function wall(s, x, y, w, h, c) {
    var cs = SHADE[c];
    s.rect(x, y, w, h, c);
    for (var j = 0; j < h; j += 3) {
      for (var i = 0; i < w; i++) s.set(x + i, y + j, cs);
      for (var i2 = (j / 3) % 2 ? 2 : 5; i2 < w; i2 += 6) s.rect(x + i2, y + j, 1, 3, cs);
    }
  }

  function boat(s, x, y, d, big, t, sail) {
    var p = M(s, x, d), i, j;
    var L = big ? 13 : 8;
    for (i = -L; i <= L; i++) {
      var depth = big ? 3 : 2, up = (i > L - 3 ? 1 : 0) + (i < -L + 3 ? 2 : 0);
      for (j = 0; j < depth + 1; j++) p(i, y - j - up, j === 0 ? 27 : (j === depth ? 4 : 5));
    }
    if (!big) return;
    for (i = -L + 1; i <= -L + 4; i++) p(i, y - 6, 5);
    p(-L + 1, y - 5, 5); p(-L + 4, y - 5, 5);
    var mx = -1, top = y - 22;
    for (j = top; j < y - 3; j++) p(mx, j, 5);
    for (j = top + 2; j < y - 6; j++) {
      var ww = Math.min(9, 3 + Math.floor((j - top) * 0.6));
      for (i = 0; i < ww; i++) p(mx + 1 + i, j, ((j - top) % 3 === 0) ? 4 : (sail != null ? sail : 3));
    }
    p(mx, top - 1, 10); p(mx - 1, top, 10); p(mx - 2, top + (t >> 2 & 1), 10);
  }

  function reeds(s, x0, x1, y, t, c) {
    for (var x = x0; x < x1; x += 2) {
      var h = 6 + Math.floor(rnd(x * 3) * 7), sw = Math.sin(t * 0.2 + x * 0.4) * 1.2;
      for (var j = 0; j < h; j++) s.set(x + Math.round(sw * j / h), y - j, j > h - 3 ? 4 : (c == null ? 16 : c));
      if (x % 6 === 0) { s.set(x + Math.round(sw), y - h, 3); s.set(x + Math.round(sw), y - h - 1, 3); }
    }
  }

  function grass(s, x0, x1, y, t, c, c2) {
    for (var x = x0; x < x1; x++) {
      if (rnd(x * 7 + 1) < 0.5) continue;
      var h = 1 + Math.floor(rnd(x * 7 + 2) * 3), sw = Math.round(Math.sin(t * 0.2 + x * 0.3) * 0.6);
      for (var j = 0; j < h; j++) s.set(x + (j === h - 1 ? sw : 0), y - j, j === h - 1 ? c2 : c);
    }
  }

  function stars(s, t, y1, n) {
    for (var i = 0; i < n; i++) {
      var x = Math.floor(rnd(i * 11 + 1) * W), y = Math.floor(rnd(i * 11 + 2) * y1);
      var tw = ((t >> 2) + i) % 7;
      s.set(x, y, tw === 0 ? 25 : (i % 4 ? 24 : 1));
    }
  }

  function dust(s, x, y, t, n, c) {
    for (var i = 0; i < n; i++) {
      var age = wrap(t + i * 5, 18);
      s.ell(x - age * 0.6 + Math.sin(i) * 3, y - age * 0.3, 1.5 + age / 6, 1 + age / 10, c, Math.max(2, 10 - (age >> 1)));
    }
  }

  // ======================= scenes =======================
  var SC = {};

  SC.idle = function (s, t, o) {
    var S = seasonOf(o), gy = 30, y, x;
    land(s, S, t, gy);
    var river = function (x, y) {
      var cx = 92 + (y - gy) * 1.6 + Math.sin(y * 0.35) * 2, hw = 1.5 + (y - gy) * 0.5;
      return Math.abs(x + 0.5 - cx) <= hw;
    };
    water(s, gy + 1, H, t, S.water, S.waterD, S.waterHi, 0.3, river);
    for (y = gy + 1; y < H; y++) for (x = 0; x < W; x++) if (river(x, y) && !river(x - 1, y)) s.set(x, y, S.gd);
    house(s, 12, 44, 20, 7, { roof: 26, snow: S.name === 'Winter' });
    s.rect(34, 43, 12, 1, 4); for (x = 34; x < 46; x += 3) s.rect(x, 41, 1, 3, 4);
    tree(s, 52, 46, S, t, 16, 'blossom');
    tree(s, 70, 40, S, t, 10, 'round');
    tree(s, 124, 38, S, t, 12, 'pine');
    tree(s, 6, 42, S, t, 9, 'round');
    grass(s, 0, W, H - 1, t, S.gd, S.g2);
    if (S.name === 'Summer') for (var i = 0; i < 3; i++) bird(s, wrap(t * 0.6 + i * 9, W + 20) - 10, 10 + i * 3 + Math.sin(t * 0.1 + i) * 2, t + i, 27);
    seasonFx(s, S, t, S.name === 'Winter' ? 40 : 14);
  };

  SC.hunt = function (s, t, o) {
    var S = seasonOf(o), gy = 26, i;
    land(s, S, t, gy);
    for (i = 0; i < 9; i++) tree(s, 4 + i * 16 + (i % 2) * 5, gy + 6 + (i % 2), S, t, 9 + (i % 3) * 2, i % 3 === 0 ? 'pine' : 'round');
    var cyc = 200, u = wrap(t + 50, cyc), lap = Math.floor((t + 50) / cyc);
    var px = -16 + u * 1.25;
    if (lap % 2) boar(s, px, 46, 1, t >> 1); else deer(s, px, 46, 1, t >> 1);
    horse(s, px - 30, 49, 1, t, 4, 27);
    man(s, px - 30, 41, { p: 'ride', c: 20, h: 'band', d: 1, a: 'fwd', w: 'bow', f: t });
    horse(s, px - 52, 47, 1, t + 2, 24, 25);
    man(s, px - 52, 39, { p: 'ride', c: 16, h: 'knot', d: 1, a: 'raise', w: 'spear', f: t });
    var ap = wrap(t, 24);
    if (ap < 12) { var ax = px - 24 + ap * 2; s.line(ax, 36, ax + 3, 36, 4); s.set(ax + 4, 36, 24); }
    dust(s, px - 36, 49, t, 3, S.g2);
    grass(s, 0, W, H - 1, t, S.gd, S.g2);
    seasonFx(s, S, t, 8);
  };

  SC.beast = function (s, t, o) {
    var S = seasonOf(o), gy = 30, x, y, i;
    s.vgrad(0, 14, 20, 21); s.vgrad(14, gy, 21, 12);
    s.ell(30, 20, 5, 5, 13); s.ell(30, 20, 3.5, 3.5, 2);
    ridge(s, 0, gy - 4, 6, 2.1, 27, 26, gy + 2, true);
    groundTex(s, gy, S.name === 'Winter' ? 24 : 16, S.name === 'Winter' ? 25 : 27, 7);
    for (i = 0; i < 6; i++) {
      var bx = 110 + i * 4, h = 18 + (i % 3) * 5;
      for (y = 0; y < h; y++) s.set(bx + Math.round(Math.sin(t * 0.1 + i) * y / h), H - 4 - y, y % 5 === 0 ? 16 : 15);
      for (y = 4; y < h; y += 5) { s.set(bx + 1, H - 4 - y, 15); s.set(bx + 2, H - 5 - y, 14); }
    }
    s.ell(16, 46, 9, 5, 26); s.ell(14, 44, 6, 3, 25); s.ell(13, 43, 3, 1.5, 24);
    var u = wrap(t, 260), tx = -20 + u * 0.7, pause = u > 100 && u < 140;
    if (pause) tx = -20 + 100 * 0.7;
    else if (u >= 140) tx = -20 + (u - 40) * 0.7;
    tiger(s, tx, 46, 1, pause ? 0 : (t >> 1), t);
    if (pause && (t & 8)) { s.set(tx + 9, 37, 13); }
    grass(s, 0, W, H - 1, t, S.name === 'Winter' ? 30 : 15, S.name === 'Autumn' ? 13 : 14);
    grass(s, 0, W, H - 3, t + 5, 16, S.name === 'Winter' ? 24 : 15);
  };

  SC.march = function (s, t, o) {
    var S = seasonOf(o), gy = 28, i;
    land(s, S, t, gy);
    s.rect(0, 36, W, 10, S.road); s.dith(0, 36, W, 1, SHADE[S.road], 8); s.dith(0, 45, W, 1, SHADE[S.road], 8);
    for (i = 0; i < W; i += 7) s.set(wrap(i - t, W), 41, SHADE[S.road]);
    var span = W + 44;
    for (i = 0; i < 12; i++) {
      var x = wrap(i * 11 + t * 0.8, span) - 22, back = i % 2;
      var flagger = i % 4 === 1;
      man(s, x, back ? 40 : 45, { c: back ? 11 : 10, h: 'helmet', d: 1, p: 'walk', f: (t >> 1) + i, a: 'hold', w: flagger ? 'banner' : 'spear', fc: 10, fm: 13, belt: 27 });
    }
    dust(s, wrap(t * 0.8, span) - 30, 46, t, 4, SHADE[S.road]);
    seasonFx(s, S, t, 8);
  };

  SC.battle = function (s, t, o) {
    var S = seasonOf(o), gy = 24, i, x;
    land(s, S, t, gy);
    for (var ty = gy + 3; ty < H; ty += 2) for (x = (ty * 7) % 9; x < W; x += 9) s.rect(x, ty, 3 + (ty & 1), 1, SHADE[S.road]);
    flag(s, 8, 18, 8, 5, t, 19, 1, 1); s.line(8, 18, 8, 34, 5);
    flag(s, 127, 18, 8, 5, t + 3, 10, -1, 13); s.line(127, 18, 127, 34, 5);
    for (i = 0; i < 6; i++) {
      var ph = ((t >> 1) + i * 2) % 6, lunge = ph < 3 ? ph : 6 - ph;
      var y = 38 + (i % 3) * 5, row = i % 3;
      x = 44 + row * -8 + Math.floor(i / 3) * -12 + lunge;
      man(s, x, y, { c: 19, h: 'helmet', plume: 18, d: 1, a: ph < 3 ? 'fwd' : 'hold', w: i === 4 ? 'banner' : 'spear', f: t + i, fc: 19, belt: 20 });
      x = 92 - row * -8 - Math.floor(i / 3) * -12 - (ph < 3 ? 3 - lunge : lunge);
      man(s, x, y + 1, { c: 10, h: 'helmet', d: -1, a: ph >= 3 ? 'fwd' : 'raise', w: i === 1 ? 'banner' : (i % 2 ? 'sword' : 'spear'), f: t + i + 3, fc: 10, belt: 11 });
    }
    for (i = 0; i < 5; i++) {
      var age = wrap(t + i * 7, 34), dx = 68 + Math.sin(i * 2.1) * 10;
      s.ell(dx + age * 0.2, 46 - age * 0.45, 3 + age / 6, 2 + age / 10, i % 2 ? 3 : 4, Math.max(1, 10 - (age >> 2)));
    }
    for (i = 0; i < 3; i++) {
      var a = wrap(t * 2 + i * 23, 70) / 70, ax = 20 + a * 96, ay = 30 - Math.sin(a * Math.PI) * 18;
      s.set(ax, ay, 27); s.set(ax - 1, ay + (a < 0.5 ? 1 : -1), 4);
    }
  };

  SC.feast = function (s, t, o) {
    var i, x, y;
    // panelled hall wall, beams and a landscape painting
    s.rect(0, 0, W, 36, 11);
    for (x = 0; x < W; x += 34) { s.rect(x + 9, 7, 22, 26, 10); s.rect(x + 10, 8, 20, 24, 11); }
    s.rect(0, 0, W, 4, 5); s.rect(0, 4, W, 1, 27); s.rect(0, 34, W, 2, 5);
    for (x = 4; x < W; x += 34) { s.rect(x, 4, 3, 30, 5); s.set(x, 4, 4); s.rect(x + 2, 4, 1, 30, 27); }
    s.rect(54, 9, 28, 14, 2); s.rect(53, 8, 30, 1, 5); s.rect(53, 23, 30, 1, 5);
    for (x = 55; x < 81; x++) { var mh = 20 - Math.abs(Math.sin(x * 0.25)) * 7; for (y = Math.floor(mh); y < 22; y++) s.set(x, y, y < mh + 1 ? 26 : 25); }
    s.set(77, 11, 10);
    for (i = 0; i < 4; i++) {
      var lx = 23 + i * 30 + Math.round(Math.sin(t * 0.15 + i));
      s.line(23 + i * 30, 4, lx, 7, 27); lantern(s, lx, 8, 10); s.warm(lx, 10, 7, 5, 4);
    }
    s.rect(0, 36, W, H - 36, 5); for (x = 0; x < W; x += 9) s.rect(x, 36, 1, H - 36, 27);
    // diners behind the long table raise their cups in turn
    var cols = [20, 21, 16, 19, 12];
    for (i = 0; i < 5; i++) {
      var px = 20 + i * 24, up = ((t >> 2) + i * 2) % 8 < 3;
      man(s, px, 45, { c: cols[i], h: ['knot', 'band', 'cap', 'knot', 'bun'][i], hc: i === 2 ? 20 : 27, d: i < 2 ? 1 : (i > 2 ? -1 : 0), a: up ? 'raise' : 'hold', w: 'cup', f: t });
    }
    s.rect(6, 43, 124, 3, 4); s.rect(6, 43, 124, 1, 3); s.rect(6, 46, 124, 1, 27);
    s.rect(10, 47, 2, 5, 5); s.rect(124, 47, 2, 5, 5);
    for (i = 0; i < 4; i++) {
      x = 30 + i * 24;
      s.rect(x, 41, 5, 2, 1); s.rect(x + 1, 42, 3, 1, 24); s.set(x + 1, 41, 12); s.set(x + 2, 41, 10); s.set(x + 3, 41, 15);
      if ((t + i * 3) % 12 < 8) { s.set(x + 2, 39 - ((t + i) % 3), 24); s.set(x + 3, 38 - ((t + i) % 4), 30); }
    }
    s.rect(9, 39, 5, 4, 9); s.rect(10, 38, 3, 1, 9); s.rect(11, 37, 1, 1, 11); s.set(10, 40, 10);
    s.ell(126, 42, 3, 1.2, 12); s.ell(125, 41.5, 1.5, 1, 13);
  };

  SC.build = function (s, t, o) {
    var S = seasonOf(o), gy = 30, i, x, y;
    land(s, S, t, gy);
    var p = Math.min(1, t / 150);
    var bx = 70, by = 46, bw = 40;
    for (i = 0; i < 4; i++) s.rect(bx + i * 13, by - 22, 2, 22, 5);
    s.rect(bx - 2, by - 23, bw + 6, 2, 4);
    var rows = Math.floor(p * 9);
    for (y = 0; y < rows; y++) {
      for (x = 0; x < bw; x += 4) {
        var ox = (y & 1) ? 2 : 0;
        s.rect(bx + 2 + x + ox, by - 2 - y * 2, 3, 2, (x + y) % 3 ? 3 : 2);
        s.set(bx + 4 + x + ox, by - 1 - y * 2, 4);
      }
    }
    if (p >= 1) roof(s, bx - 3, bx + bw + 4, by - 23, 5, 26, S.name === 'Winter');
    for (y = by - 20; y < by; y += 5) s.line(bx - 6, y, bx - 1, y, 3);
    s.line(bx - 6, by - 22, bx - 6, by, 4); s.line(bx - 1, by - 22, bx - 1, by, 4);
    var hit = (t >> 1) % 3 === 0;
    man(s, bx + 12, by - 23, { c: 4, h: 'straw', d: 1, a: hit ? 'hold' : 'raise', w: 'hammer', f: t });
    if (hit) { s.set(bx + 17, by - 26, 13); s.set(bx + 18, by - 27, 1); }
    var rope = 8 + Math.round(Math.sin(t * 0.15) * 6);
    s.line(bx + 30, by - 23, bx + 30, by - 23 + rope, 3); s.rect(bx + 29, by - 22 + rope, 3, 2, 4);
    var u = wrap(t, 120), walkX = u < 60 ? 10 + u : 70 - (u - 60), dir = u < 60 ? 1 : -1;
    man(s, walkX, 50, { c: 15, h: 'cap', hc: 20, d: dir, p: 'walk', f: t >> 1, a: 'hold', w: dir > 0 ? 'plank' : null });
    man(s, wrap(walkX + 30, 60) + 6, 47, { c: 26, h: 'straw', d: -dir, p: 'walk', f: (t >> 1) + 1, w: 'pole', load: 3 });
    for (i = 0; i < 4; i++) s.rect(4 + i * 4, 46 - (i % 2), 4, 2, i % 2 ? 3 : 2);
    s.rect(6, 43, 10, 1, 4); s.rect(5, 41, 12, 1, 3);
    seasonFx(s, S, t, 6);
  };

  SC.farm = function (s, t, o) {
    var S = seasonOf(o), gy = 22, x, y;
    land(s, S, t, gy);
    house(s, 8, 30, 16, 6, { roof: 4, snow: S.name === 'Winter' });
    tree(s, 30, 31, S, t, 9, 'round');
    var cyc = 220, u = wrap(t, cyc), px = -20 + u * 0.75;
    var crop = S.name === 'Autumn' ? 13 : (S.name === 'Summer' ? 15 : (S.name === 'Winter' ? 30 : 14));
    for (y = 32; y < H; y++) {
      var row = (y - 32) % 3;
      for (x = 0; x < W; x++) {
        var ploughed = x < px - 4;
        var c = ploughed ? (row === 0 ? 27 : (row === 1 ? 5 : 4)) : (row === 0 ? S.gd : (row === 1 ? crop : S.g));
        if (!ploughed && S.name === 'Summer' && row === 1 && (x % 3 === 0)) c = 16;
        s.set(x, y, c);
      }
    }
    s.rect(0, 31, W, 1, S.gd);
    var oxX = px + 14;
    ox(s, oxX, 47, 1, t >> 2);
    s.line(px + 2, 42, oxX - 6, 41, 3);
    s.line(px - 2, 41, px + 3, 47, 5); s.set(px + 4, 48, 26); s.set(px + 3, 48, 24);
    man(s, px - 5, 48, { c: 20, l: 4, h: 'straw', d: 1, p: 'walk', f: t >> 2, a: 'fwd' });
    for (var i = 0; i < 3; i++) bird(s, px - 20 - i * 6, 34 - i * 2 + Math.sin(t * 0.3 + i), t + i, 1);
    seasonFx(s, S, t, 6);
  };

  SC.flood = function (s, t, o) {
    var x, y, i;
    s.vgrad(0, 16, 27, 26);
    for (i = 0; i < 4; i++) cloud(s, wrap(i * 40 + t * 0.4, W + 40) - 20, 4 + (i % 2) * 4, 30, 26, 27);
    water(s, 16, 31, t, 20, 27, 31, 1.2);
    for (x = 0; x < W; x++) {
      var wv = Math.sin(x * 0.3 - t * 0.5) * 1.5 + Math.sin(x * 0.11 + t * 0.2);
      var top = Math.round(28 + wv);
      s.set(x, top, 24); s.set(x, top + 1, 31); for (y = top + 2; y < 32; y++) s.set(x, y, 19);
    }
    for (y = 31; y < 38; y++) { var inset = (y - 31); s.rect(0, y, W, 1, y === 31 ? 3 : (y < 34 ? 4 : 5)); }
    for (i = 0; i < 18; i++) { x = i * 8 + 3; s.rect(x, 29, 6, 3, 3); s.rect(x, 29, 6, 1, 2); s.set(x + 5, 31, 4); }
    s.rect(0, 38, W, H - 38, 29); s.dith(0, 38, W, H - 38, 15, 5);
    for (y = 40; y < H; y += 4) for (x = (y % 8) ? 0 : 3; x < W; x += 6) s.set(x, y, 16);
    var sp = wrap(t, 40);
    if (sp < 10) { var sx = 40 + (Math.floor(t / 40) * 37) % 60; for (i = 0; i < 6; i++) s.set(sx + i - 3 + sp * 0.3 * (i - 3), 27 - sp * (1 - Math.abs(i - 3) / 4) + sp * sp * 0.08, i % 2 ? 1 : 31); }
    for (i = 0; i < 4; i++) {
      var u = wrap(t * 0.7 + i * 35, W + 30) - 15, dir = i % 2 ? -1 : 1;
      var wx = dir > 0 ? u : W - u;
      man(s, wx, 30, { c: [4, 26, 20, 5][i], h: 'straw', d: dir, p: 'walk', f: (t >> 1) + i, w: i % 2 ? 'sack' : 'pole', load: 4 });
    }
    man(s, 30, 49, { c: 20, h: 'straw', d: 1, a: (t >> 2) & 1 ? 'raise' : 'hold', w: 'hammer', f: t });
    man(s, 100, 50, { c: 4, h: 'cap', hc: 27, d: -1, p: 'walk', f: t >> 1, w: 'sack' });
    for (i = 0; i < 60; i++) {
      var rx = wrap(rnd(i * 5 + 1) * W + t * 2, W), ry = wrap(rnd(i * 5 + 2) * H + t * 5, H);
      s.set(rx, ry, 31); s.set(rx - 1, ry - 2, 24);
    }
  };

  SC.market = function (s, t, o) {
    var S = seasonOf(o), gy = 22, i, x;
    land(s, S, t, gy);
    house(s, 4, 30, 34, 9, { roof: 26, wall: 2, post: 11, lit: false, snow: S.name === 'Winter' });
    house(s, 50, 30, 36, 10, { roof: 20, wall: 3, post: 5, snow: S.name === 'Winter' });
    house(s, 98, 30, 34, 9, { roof: 26, wall: 2, post: 11, snow: S.name === 'Winter' });
    groundTex(s, 30, S.name === 'Winter' ? 24 : 3, S.name === 'Winter' ? 25 : 4);
    flag(s, 46, 14, 3, 9, t, 1, 1); s.line(46, 13, 46, 30, 5);
    for (i = 0; i < 3; i++) {
      x = 8 + i * 44;
      var stripe = [10, 19, 12][i];
      for (var j = 0; j < 24; j++) { s.set(x + j, 33, (j >> 2) & 1 ? stripe : 1); s.set(x + j, 34, (j >> 2) & 1 ? SHADE[stripe] : 24); }
      s.rect(x + 1, 35, 1, 10, 5); s.rect(x + 22, 35, 1, 10, 5);
      man(s, x + 12, 42, { c: [16, 4, 21][i], h: ['knot', 'cap', 'bun'][i], hc: 27, d: 0, a: i === 1 && ((t >> 3) & 1) ? 'raise' : 'hold' });
      s.rect(x, 41, 24, 3, 4); s.rect(x, 41, 24, 1, 3);
      for (j = 0; j < 7; j++) {
        var gc = [[15, 12, 14], [9, 19, 5], [10, 22, 13]][i][j % 3];
        s.rect(x + 2 + j * 3, 39, 2, 2, gc); s.set(x + 2 + j * 3, 39, LIGHT[gc]);
      }
    }
    var walkers = [[22, 1, 10], [11, 1, 20], [26, -1, 5], [15, -1, 26]];
    for (i = 0; i < 4; i++) {
      var w = walkers[i], u = wrap(t * 0.6 + i * 41, W + 20) - 10, wx = w[1] > 0 ? u : W - u;
      man(s, wx, 50 - (i % 2) * 2, { c: w[2], h: ['knot', 'straw', 'bun', 'cap'][i], hc: 27, d: w[1], p: 'walk', f: (t >> 1) + i, w: i === 1 ? 'pole' : null, load: 12 });
    }
    seasonFx(s, S, t, 5);
  };

  SC.tavern = function (s, t, o) {
    var i, x, y;
    s.rect(0, 0, W, 38, 4);
    for (x = 0; x < W; x += 5) s.rect(x, 0, 1, 38, 5);
    s.rect(0, 0, W, 4, 5); s.rect(0, 4, W, 1, 27);
    for (x = 0; x < W; x += 34) { s.rect(x + 2, 4, 3, 34, 9); s.rect(x + 4, 4, 1, 34, 5); }
    s.rect(14, 10, 22, 14, 27); s.rect(15, 11, 20, 12, 20);
    s.ell(30, 15, 2.5, 2.5, 30); s.ell(31, 14, 2, 2, 20);
    for (x = 15; x < 35; x += 5) s.rect(x, 11, 1, 12, 5); s.rect(15, 16, 20, 1, 5);
    var sw = Math.round(Math.sin(t * 0.12));
    s.line(56, 5, 56 + sw, 7, 27); s.rect(53 + sw, 8, 7, 14, 1); s.rect(59 + sw, 8, 1, 14, 24);
    s.ell(56.5 + sw, 13.5, 2.5, 2.5, 27); s.ell(56.5 + sw, 13.5, 1.2, 1.2, 10); s.rect(53 + sw, 20, 7, 2, 10); s.set(54 + sw, 22, 10); s.set(58 + sw, 22, 10);
    for (i = 0; i < 2; i++) { s.warm(75 + i * 40, 9, 9 + (((t >> 2) + i) & 1), 7, 4); lantern(s, 75 + i * 40, 6, 10); }
    s.rect(96, 14, 38, 1, 5); s.rect(96, 26, 38, 1, 5);
    for (i = 0; i < 6; i++) { x = 98 + i * 6; s.rect(x, 9, 4, 5, 9); s.rect(x + 1, 8, 2, 1, 9); s.set(x, 10, 8); s.rect(x + 1, 11, 2, 2, 10); }
    for (i = 0; i < 5; i++) { x = 99 + i * 7; s.rect(x, 21, 5, 5, 26); s.set(x, 21, 25); s.rect(x + 1, 20, 3, 1, 26); }
    s.rect(0, 38, W, H - 38, 5); for (x = 0; x < W; x += 12) s.rect(x, 38, 1, H - 38, 27);
    s.rect(92, 33, 44, 2, 4); s.rect(92, 33, 44, 1, 3); s.rect(92, 35, 44, 13, 9); for (x = 94; x < W; x += 8) s.rect(x, 36, 1, 11, 5);
    man(s, 112, 33, { c: 26, h: 'cap', hc: 27, d: -1, a: 'hold' });
    var drinkers = [[26, 1, 19], [38, 0, 10], [50, -1, 16]];
    for (i = 0; i < 3; i++) {
      var dk = drinkers[i], up = ((t >> 2) + i * 3) % 9 < 3;
      man(s, dk[0], 43 + (i === 1 ? -1 : 0), { c: dk[2], h: ['band', 'knot', 'cap'][i], hc: 27, d: dk[1], a: up ? 'mouth' : 'hold', w: 'cup', lean: i === 2 && ((t >> 3) & 1) ? 1 : 0 });
    }
    s.ell(38, 44, 16, 3, 4); s.ell(38, 43.5, 15, 2, 3); s.rect(37, 46, 2, 5, 5);
    s.rect(35, 40, 3, 3, 26); s.set(35, 40, 25); s.rect(41, 41, 2, 2, 1);
    var u = wrap(t, 90), wx = u < 45 ? 64 + u * 0.55 : 64 + (90 - u) * 0.55;
    man(s, wx, 50, { c: 2, l: 4, h: 'cap', hc: 27, d: u < 45 ? 1 : -1, p: 'walk', f: t >> 1, a: 'fwd' });
    s.rect(wx + (u < 45 ? 3 : -5), 43, 3, 1, 25); s.set(wx + (u < 45 ? 4 : -4), 42, 9);
  };

  SC.train = function (s, t, o) {
    var S = seasonOf(o), gy = 22, i;
    land(s, S, t, gy);
    groundTex(s, 28, S.name === 'Winter' ? 24 : 3, S.name === 'Winter' ? 25 : 4);
    s.rect(4, 26, 14, 1, 5); s.rect(4, 36, 14, 1, 5); s.rect(4, 26, 1, 12, 5); s.rect(17, 26, 1, 12, 5);
    for (i = 0; i < 5; i++) { s.line(6 + i * 2, 18, 6 + i * 2, 37, 4); s.set(6 + i * 2, 17, 24); }
    s.rect(124, 30, 1, 16, 4); s.ell(124, 32, 3, 4, 13); s.ell(124, 32, 2, 3, 3, 8); s.rect(121, 34, 7, 1, 4);
    var ph = (t >> 2) % 4;
    var arm = ph === 1 || ph === 2 ? 'fwd' : 'hold';
    for (var r = 0; r < 2; r++) {
      for (i = 0; i < 5; i++) {
        var x = 30 + i * 16 + r * 6 + (ph === 2 ? 2 : 0);
        man(s, x, 40 + r * 8, { c: r ? 20 : 19, h: 'helmet', d: 1, a: arm, w: 'spear', f: t, belt: 27, p: ph === 2 ? 'walk' : 'stand' });
      }
    }
    man(s, 116, 46, { c: 11, h: 'helmet', plume: 13, d: -1, a: ph < 2 ? 'raise' : 'hold', w: 'banner', fc: 13, fm: 10, f: t });
    seasonFx(s, S, t, 5);
  };

  SC.festival = function (s, t, o) {
    var i, x, j;
    s.vgrad(0, 30, 27, 20);
    stars(s, t, 26, 26);
    for (i = 0; i < 3; i++) {
      var cyc = 48, age = wrap(t + i * 17, cyc), bx = 28 + i * 40 + ((Math.floor((t + i * 17) / cyc) * 23) % 20), by = 9 + (i % 2) * 5;
      var col = [10, 13, 18, 22, 15][(Math.floor((t + i * 17) / cyc) + i) % 5];
      if (age < 12) { for (j = 0; j < 3; j++) s.set(bx, 40 - age * 2.6 + j, j ? 12 : 13); }
      else if (age < 40) {
        var r = (age - 12) * 0.75, fade = age > 30;
        for (j = 0; j < 14; j++) {
          var a = j / 14 * Math.PI * 2, px = bx + Math.cos(a) * r, py = by + Math.sin(a) * r + (age - 12) * (age - 12) * 0.012;
          s.set(px, py, fade ? SHADE[col] : (age < 16 ? 1 : col));
          if (!fade) s.set(bx + Math.cos(a) * r * 0.6, by + Math.sin(a) * r * 0.6 + (age - 12) * 0.2, age < 20 ? 13 : SHADE[col]);
        }
      }
    }
    var roofs = [[0, 18, 9], [20, 26, 12], [48, 22, 8], [72, 30, 11], [104, 32, 9]];
    for (i = 0; i < roofs.length; i++) {
      var rf = roofs[i];
      s.rect(rf[0] + 2, 52 - rf[2] - 6, rf[1] - 4, rf[2] + 6, 27);
      roof(s, rf[0], rf[0] + rf[1], 52 - rf[2] - 7, 4, 0);
      for (x = rf[0] + 4; x < rf[0] + rf[1] - 4; x += 5) s.rect(x, 52 - rf[2] - 3, 2, 2, (x + t >> 3) % 5 ? 13 : 12);
    }
    for (j = 0; j < 2; j++) {
      for (x = 0; x < W; x++) {
        var yy = 18 + j * 6 + Math.round(Math.sin(x / W * Math.PI) * 6 * (j ? 0.6 : 1));
        s.set(x, yy, 26);
        if ((x + j * 11) % 22 === 0) { lantern(s, x, yy + 1 + Math.round(Math.sin(t * 0.2 + x) * 0.6), [10, 12, 10, 22][(x / 22 + j) % 4 | 0]); }
      }
    }
    for (i = 0; i < 14; i++) {
      x = 4 + i * 9 + (i % 3);
      tiny(s, x, 51 - (i % 2), [10, 20, 16, 21, 4][i % 5], 7, (t >> 3) + i, i % 3 === 0, 27);
      if (i % 4 === 1) lantern(s, x + 2, 41 - (i % 2) + ((t >> 2) + i & 1), 12);
    }
  };

  SC.typhoon = function (s, t, o) {
    var i, j, x, y;
    var flash = wrap(t, 54) < 2;
    s.vgrad(0, 30, flash ? 24 : 27, flash ? 1 : 26);
    for (i = 0; i < 6; i++) cloud(s, wrap(i * 31 + t * 2.2, W + 50) - 25, 3 + (i % 3) * 4, 34, i % 2 ? 26 : 27, 0);
    if (wrap(t, 54) < 4) {
      var lx = 30 + (Math.floor(t / 54) * 41) % 80, ly = 0;
      for (i = 0; i < 6; i++) { var nx = lx + (rnd(i + Math.floor(t / 54) * 9) - 0.5) * 8; s.line(lx, ly, nx, ly + 5, 1); lx = nx; ly += 5; }
    }
    water(s, 30, H, t, 20, 27, 24, 2.5);
    for (x = 0; x < W; x++) {
      var wv = Math.round(Math.sin(x * 0.18 - t * 0.6) * 2 + Math.sin(x * 0.07 + t * 0.3) * 1.5);
      s.set(x, 30 + wv, 1); s.set(x, 31 + wv, 24); s.set(x + 1, 30 + wv, wv < -1 ? 1 : -1);
      for (y = 26 + wv + 4; y < 30 + wv; y++) s.set(x, y, 20);
    }
    s.rect(0, 40, 52, 12, 26); s.dith(0, 40, 52, 12, 27, 6); s.rect(0, 40, 52, 1, 25);
    house(s, 4, 40, 18, 7, { roof: 5, wall: 3 });
    var gust = 2.5 + Math.sin(t * 0.35) * 1.5;
    for (i = 0; i < 3; i++) {
      var tx = 28 + i * 8, th = 16 + i * 2;
      var px = tx, py = 40;
      for (y = 0; y < th; y++) {
        var bend = Math.pow(y / th, 2) * gust * 3;
        px = tx + bend; py = 40 - y;
        s.set(px, py, 5); s.set(px + 1, py, 27);
      }
      for (j = 0; j < 7; j++) s.line(px, py, px + 4 + gust * 1.5 + j * 0.3, py - 3 + j * 1.2 + Math.sin(t * 0.9 + j) * 1.2, j % 2 ? 16 : 15);
    }
    for (i = 0; i < 90; i++) {
      x = wrap(rnd(i * 3 + 1) * W + t * 5, W); y = wrap(rnd(i * 3 + 2) * H + t * 6, H);
      s.line(x, y, x + 2, y + 3, i % 3 ? 25 : 24);
    }
    for (i = 0; i < 8; i++) {
      x = wrap(rnd(i + 99) * W + t * 7, W + 10) - 5; y = 20 + rnd(i + 7) * 20 + Math.sin(t * 0.8 + i) * 3;
      s.set(x, y, i % 2 ? 15 : 14); s.set(x + 1, y + (t & 1), 16);
    }
  };

  SC.snow = function (s, t, o) {
    var i, x, y;
    var S = SEASONS.Winter;
    s.vgrad(0, 30, 26, 25);
    ridge(s, 0, 24, 6, 1.3, 24, 30, 30, true);
    s.dith(0, 22, W, 8, 25, 8);
    s.rect(0, 30, W, H - 30, 30); s.dith(0, 30, W, H - 30, 31, 3);
    house(s, 10, 42, 22, 8, { roof: 26, snow: true, lit: true });
    house(s, 98, 38, 18, 7, { roof: 26, snow: true, lit: true });
    tree(s, 42, 44, S, t, 13, 'bare');
    tree(s, 124, 40, S, t, 12, 'pine');
    tree(s, 86, 39, S, t, 9, 'pine');
    var u = wrap(t * 0.3 + 50, W + 30) - 15;
    for (x = Math.max(0, Math.floor(u) - 40); x < u - 3; x += 3) s.set(x, 48 + ((x / 3) & 1), 31);
    man(s, u, 48, { c: 26, l: 27, h: 'straw', d: 1, p: 'walk', f: t >> 2, a: 'hold', w: 'staff', lean: 1 });
    s.set(u - 2, 41, 30); s.rect(u - 2, 40, 5, 1, 30);
    var gust = 1.5 + Math.sin(t * 0.2) * 1.2;
    for (i = 0; i < 140; i++) {
      var sp = 0.6 + rnd(i * 5 + 3) * 0.9;
      x = wrap(rnd(i * 5 + 1) * W + t * gust * sp * 1.5, W); y = wrap(rnd(i * 5 + 2) * H + t * sp, H);
      s.set(x, y, i % 5 ? 30 : 1);
      if (i % 9 === 0) s.set(x + 1, y, 1);
    }
  };

  SC.epidemic = function (s, t, o) {
    var i, x, y;
    s.rect(0, 0, W, 12, 26); s.vgrad(12, 26, 26, 25);
    ridge(s, 0, 22, 5, 3.3, 26, 25, 27, true);
    s.rect(0, 26, W, H - 26, 4);
    for (y = 27; y < H; y += 3) for (x = (y * 7) % 11; x < W; x += 11) s.rect(x, y, 4, 1, 5);
    s.dith(0, 26, W, 3, 26, 8);
    house(s, 6, 40, 26, 10, { roof: 27, wall: 3, post: 5 });
    s.rect(18, 31, 2, 5, 13); s.set(18, 33, 10); s.set(19, 34, 10);
    house(s, 92, 38, 22, 9, { roof: 27, wall: 3, post: 5 });
    house(s, 50, 32, 16, 6, { roof: 27, wall: 24, post: 5, window: false });
    s.line(124, 42, 124, 24, 27); s.line(124, 30, 129, 25, 27); s.line(124, 34, 119, 29, 27); s.line(119, 29, 117, 28, 27);
    s.set(128, 25, 27); s.set(129, 24, 27); s.set(127, 24, 0);
    var fx = 70, fy = 46;
    s.rect(fx - 3, fy - 2, 7, 3, 26); s.rect(fx - 2, fy - 4, 5, 2, 27);
    fire(s, fx, fy - 4, t, 0.5);
    smoke(s, fx, fy - 9, t, 6, 24, 0.15, 48);
    smoke(s, 22, 26, t + 20, 4, 25, 0.2, 40);
    man(s, 62, 49, { c: 25, h: 'cap', hc: 27, d: 1, a: 'fwd', lean: 1 });
    man(s, 40, 48, { c: 4, h: 'straw', d: 0, p: 'sit', a: 'hold' });
    var u = wrap(t * 0.25, W + 20) - 10;
    man(s, W - u, 51, { c: 26, h: 'bald', k: 8, d: -1, p: 'walk', f: t >> 3, a: 'hold', w: 'staff', lean: 1 });
    var cr = wrap(t, 120);
    if (cr < 50) bird(s, 129 - cr * 2.5, 22 - cr * 0.2, t, 27);
    s.warm(70, 42, 9, 5, 4);
  };

  SC.riot = function (s, t, o) {
    var i, x;
    s.rect(0, 0, W, 10, 27);
    s.vgrad(10, 24, 27, 11);
    s.vgrad(24, 30, 11, 12);
    s.rect(0, 26, W, 8, 27);
    s.rect(30, 14, 76, 18, 26);
    for (var yy = 16; yy < 32; yy += 4) s.rect(30, yy, 76, 1, 27);
    roof(s, 28, 107, 13, 5, 27);
    s.rect(56, 18, 24, 14, 11); s.rect(67, 18, 2, 14, 5); for (x = 58; x < 78; x += 3) for (var y = 20; y < 31; y += 3) s.set(x, y, 13);
    roof(s, 54, 81, 17, 3, 0);
    lantern(s, 50, 18, 10); lantern(s, 86, 18, 10);
    s.rect(0, 32, W, H - 32, 27);
    for (i = 0; i < 3; i++) smoke(s, 24 + i * 44, 34, t + i * 9, 5, 26, 0.3, 40);
    s.warm(68, 46, 70, 9, 3);
    for (var row = 0; row < 3; row++) {
      for (i = 0; i < 12; i++) {
        x = 3 + i * 11 + (row & 1) * 5 + Math.round(Math.sin(t * 0.3 + i + row) * 0.6);
        var y2 = 40 + row * 5 + (((t >> 2) + i + row) & 1);
        var k = row === 2 ? 8 : 9, raise = ((t >> 2) + i * 3 + row) % 5 < 2;
        var torch = (i + row) % 3 === 0;
        if (row < 2) tiny(s, x, y2, [4, 26, 5, 20][(i + row) % 4], k, (t >> 3) + i, raise, 27);
        else man(s, x, y2 + 5, { c: [4, 26, 5, 20][i % 4], k: 8, h: (i % 2) ? 'band' : 'knot', d: 0, a: raise || torch ? 'raise' : 'hold', w: torch ? 'torch' : (i % 3 === 1 ? 'staff' : null), f: t + i });
        if (torch && row < 2) { s.set(x + 2, y2 - 7, 5); s.set(x + 2, y2 - 8, 12 + ((t + i) & 1)); s.set(x + 2, y2 - 9, 10); }
      }
    }
  };

  SC.edict = function (s, t, o) {
    var x, y, i;
    // palace red with a sparse lattice of small diamonds
    s.rect(0, 0, W, H, 11);
    for (y = 4; y < H; y += 8) {
      for (x = (y % 16) === 4 ? 4 : 12; x < W; x += 16) { s.set(x, y - 1, 10); s.set(x - 1, y, 10); s.set(x + 1, y, 5); s.set(x, y + 1, 5); }
    }
    s.rect(0, 0, W, 2, 13); s.rect(0, 2, W, 1, 12); s.rect(0, H - 2, W, 2, 13); s.rect(0, H - 3, W, 1, 12);
    var p = Math.min(1, t / 30), ease = 1 - Math.pow(1 - p, 2);
    var hw = Math.round(4 + ease * 54), cx = 68, top = 10, bot = 42;
    s.rect(cx - hw + 2, top + 2, hw * 2 - 4, bot - top - 4, 5);
    s.rect(cx - hw, top, hw * 2, bot - top, 13);
    s.rect(cx - hw, top, hw * 2, 2, 12); s.rect(cx - hw, bot - 2, hw * 2, 2, 12);
    s.rect(cx - hw, top + 3, hw * 2, 1, 10); s.rect(cx - hw, bot - 4, hw * 2, 1, 10);
    s.dith(cx - hw, top + 4, hw * 2, bot - top - 8, 2, 3);
    for (i = 0; i < 12; i++) {
      var col = cx + 48 - i * 8;
      if (Math.abs(col - cx) > hw - 4) continue;
      for (y = top + 7; y < bot - 7; y += 2) {
        if (rnd(i * 31 + y) < 0.2) continue;
        s.rect(col, y, 3 - (rnd(i * 17 + y) < 0.4 ? 1 : 0), 1, 27);
      }
    }
    if (t > 36) { s.rect(cx - 46, bot - 14, 6, 6, 10); s.rect(cx - 45, bot - 13, 4, 4, 11); s.set(cx - 44, bot - 12, 10); s.set(cx - 43, bot - 11, 10); }
    for (i = -1; i <= 1; i += 2) {
      var rx = cx + i * hw - (i > 0 ? 0 : 3);
      s.rect(rx, top - 3, 3, bot - top + 6, 5); s.rect(rx + 1, top - 3, 1, bot - top + 6, 4);
      s.rect(rx - 1, top - 5, 5, 2, 13); s.rect(rx - 1, bot + 3, 5, 2, 13); s.set(rx + 1, top - 6, 12); s.set(rx + 1, bot + 5, 12);
    }
    if (p >= 1) {
      var g = wrap(t - 30, 60);
      if (g < 20) for (y = top + 4; y < bot - 4; y++) s.set(cx - hw + g * 6 + (y - top) * 0.4, y, 1);
    }
  };

  SC.victory = function (s, t, o) {
    var S = seasonOf(o), gy = 30, i;
    land(s, S, t, gy);
    for (i = 0; i < 8; i++) {
      var a = i / 8 * Math.PI + t * 0.02;
      s.line(68, 4, 68 + Math.cos(a) * 30, 4 + Math.sin(a) * 30 * 0.4, 13);
    }
    s.ell(68, 4, 5, 5, 13); s.ell(68, 4, 3, 3, 1);
    for (i = 0; i < 4; i++) { var fx = 14 + i * 36; s.line(fx, 12, fx, 44, 5); flag(s, fx, 12, 9, 6, t + i * 2, [10, 13, 10, 19][i], 1, [13, 10, 13, 1][i]); }
    horse(s, 68, 46, 1, (t >> 3) % 2 ? 0 : 2, 1, 24);
    man(s, 67, 38, { p: 'ride', c: 11, h: 'helmet', plume: 13, d: 1, a: 'raise', w: 'sword', f: t });
    for (i = 0; i < 9; i++) {
      var x = 6 + i * 15 + (i > 3 ? 12 : 0), y = 46 + (i % 2) * 4;
      if (Math.abs(x - 68) < 10) continue;
      man(s, x, y, { c: [10, 19, 16, 11][i % 4], h: i % 3 ? 'helmet' : 'band', d: x < 68 ? 1 : -1, p: 'jump', f: (t >> 2) + i, a: 'cheer', w: i % 2 ? 'spear' : 'sword' });
    }
    seasonFx(s, S, t, 6);
  };

  SC.defeat = function (s, t, o) {
    var S = seasonOf(o), i, x, y;
    s.rect(0, 0, W, 10, 26);
    s.vgrad(10, 22, 26, 25);
    s.vgrad(22, 30, 25, 8);
    ridge(s, 0, 26, 4, 2.2, 27, 26, 31, true);
    var gc = S.name === 'Winter' ? 24 : 4;
    s.rect(0, 30, W, H - 30, gc);
    for (y = 31; y < H; y += 3) for (x = (y * 5) % 9; x < W; x += 9) s.rect(x, y, 3, 1, SHADE[gc]);
    for (i = 0; i < 2; i++) {
      var sx = 30 + i * 70;
      fire(s, sx, 34 + i * 2, t + i * 9, 0.5);
      smoke(s, sx, 30 + i * 2, t + i * 13, 8, i ? 26 : 27, 0.35, 56);
    }
    // fallen banners: poles in the dirt with torn flags draped on the ground
    s.line(8, 47, 44, 39, 5); s.line(8, 48, 44, 40, 27);
    for (x = 0; x < 13; x++) for (y = 0; y < 6 - (x > 9 ? x - 9 : 0); y++) s.set(30 + x, 41 + y - Math.round(x * 0.22), (x + 2 * y) % 7 === 0 ? 27 : (y === 0 ? 10 : 11));
    s.set(36, 44, 13); s.set(37, 44, 13); s.set(36, 45, 13);
    s.line(92, 50, 128, 43, 5);
    for (x = 0; x < 11; x++) for (y = 0; y < 5 - (x > 8 ? x - 8 : 0); y++) s.set(110 + x, 46 + y - Math.round(x * 0.2), (x * 3 + y) % 8 === 0 ? 27 : (y === 0 ? 19 : 20));
    s.line(60, 50, 55, 40, 4); s.line(84, 50, 90, 41, 4); s.set(90, 40, 24); s.set(91, 39, 1); s.line(70, 51, 72, 45, 4);
    s.ell(46, 49, 3, 3, 5); s.ell(46, 49, 1.5, 1.5, 4); s.set(46, 49, 27);
    man(s, 76, 50, { c: 26, h: 'helmet', d: -1, p: 'kneel', a: 'hold', lean: 1 });
    for (i = 0; i < 3; i++) {
      var a = t * 0.05 + i * 2.1;
      bird(s, 70 + Math.cos(a) * 22, 10 + Math.sin(a) * 4, t + i, 27);
    }
  };

  SC.rest = function (s, t, o) {
    var i, x, y;
    s.rect(0, 0, W, 14, 27); s.vgrad(14, 30, 27, 20);
    stars(s, t, 28, 30);
    s.ell(112, 8, 4, 4, 30); s.ell(114, 7, 3.5, 3.5, 27);
    ridge(s, 0, 28, 5, 0.5, 27, 26, 33, true);
    s.rect(0, 32, W, H - 32, 27);
    for (y = 33; y < H; y += 3) for (x = (y * 7) % 13; x < W; x += 13) s.rect(x, y, 3, 1, 16);
    for (i = 0; i < 4; i++) { x = [6, 20, 118, 130][i]; var th = 14 + (i % 2) * 4; s.line(x, 33, x, 33 - th, 27); s.ell(x, 33 - th + 2, 4, th * 0.4, 27); }
    for (y = 0; y < 13; y++) { s.rect(22 - y, 45 - 12 + y, y * 2 + 1, 1, y < 2 ? 2 : 3); s.rect(22 + Math.floor(y * 0.4), 33 + y, Math.ceil(y * 0.6) + 1, 1, 4); }
    s.rect(21, 39, 3, 6, 27); s.line(22, 31, 22, 33, 5);
    var fx = 72, fy = 44;
    s.warm(fx, fy, 26 + ((t >> 1) & 1), 9, 4);
    s.warm(fx, fy, 15, 5, 8);
    s.line(fx - 4, fy + 1, fx + 4, fy - 1, 5); s.line(fx - 4, fy - 1, fx + 4, fy + 1, 9);
    fire(s, fx, fy - 1, t, 0.9);
    s.line(fx - 8, fy - 12, fx, fy - 15, 26); s.line(fx + 8, fy - 12, fx, fy - 15, 26); s.line(fx, fy - 15, fx, fy - 10, 26);
    s.rect(fx - 2, fy - 10, 5, 3, 27); s.set(fx - 2, fy - 10, 26);
    smoke(s, fx, fy - 14, t, 4, 26, 0.1, 30);
    man(s, fx - 13, fy + 3, { c: 19, k: 6, h: 'band', d: 1, p: 'sit', a: 'fwd' });
    man(s, fx + 14, fy + 3, { c: 10, k: 6, h: 'knot', d: -1, p: 'sit', a: (t >> 3) % 3 === 0 ? 'mouth' : 'hold', w: 'cup' });
    man(s, fx + 2, fy + 8, { c: 16, k: 7, h: 'straw', d: 0, p: 'sit', a: 'hold' });
    horse(s, 112, 46, -1, 0, 26, 27);
  };

  SC.smithy = function (s, t, o) {
    var i, x, y;
    s.rect(0, 0, W, 40, 27);
    for (y = 0; y < 40; y += 4) for (x = (y % 8) ? 0 : 5; x < W; x += 10) { s.rect(x, y, 9, 3, 26); s.set(x, y, 25); }
    s.rect(0, 40, W, H - 40, 5);
    for (y = 41; y < H; y += 3) for (x = (y * 5) % 11; x < W; x += 11) s.rect(x, y, 4, 1, 27);
    var flick = (t >> 1) & 1;
    s.warm(21, 26, 30 + flick, 17, 4);
    s.rect(6, 26, 30, 15, 26); s.rect(6, 26, 30, 1, 25); for (x = 8; x < 36; x += 5) s.rect(x, 27, 1, 14, 27);
    s.rect(10, 4, 22, 18, 26); s.rect(12, 0, 18, 4, 26); s.rect(10, 4, 22, 1, 25); s.rect(30, 4, 2, 18, 27);
    s.rect(11, 22, 20, 4, 11);
    for (x = 11; x < 31; x++) { var hh = 1 + Math.floor(rnd(x * 3 + (t >> 1)) * 3); for (y = 0; y < hh; y++) s.set(x, 25 - y, y === 0 ? 13 : 12); }
    s.rect(38, 30, 9, 6, 4); s.line(38, 30, 46, 33, 3); s.rect(46, 32, 4, 1, 26);
    var ph = wrap(t, 6), hit = ph === 3;
    s.warm(82, 36, hit ? 16 : 10, hit ? 9 : 6, 4);
    s.rect(78, 40, 8, 8, 5); s.rect(76, 36, 13, 4, 26); s.rect(74, 35, 17, 1, 25); s.rect(73, 35, 2, 2, 26); s.rect(77, 36, 11, 1, 24);
    s.rect(80, 34, 6, 1, hit || ph === 4 ? 13 : 12); s.set(85, 34, 10);
    man(s, 96, 49, { c: 4, k: 8, h: 'band', hc: 27, band: 2, d: -1, a: ph < 3 ? 'raise' : 'fwd', w: 'hammer', f: t, belt: 27 });
    if (ph >= 3) {
      for (i = 0; i < 10; i++) {
        var age = ph - 3 + rnd(i) * 0.5, a = rnd(i * 7 + Math.floor(t / 6)) * Math.PI;
        var sx = 83 + Math.cos(a) * age * 5, sy = 34 - Math.sin(a) * age * 4 + age * age * 0.8;
        s.set(sx, sy, age < 1.2 ? 1 : (age < 2 ? 13 : 12));
      }
    }
    for (i = 0; i < 4; i++) { x = 110 + i * 5; s.line(x, 8, x, 18, 25); s.rect(x - 1, 18, 3, 2, 26); }
    s.ell(124, 44, 6, 5, 4); s.rect(118, 40, 13, 1, 3); s.rect(119, 41, 11, 1, 20);
    if (wrap(t, 40) < 20) smoke(s, 124, 39, t, 3, 24, 0.05, 20);
  };

  SC.ship = function (s, t, o) {
    var S = seasonOf(o), gy = 26, i;
    land(s, S, t, gy);
    water(s, gy + 2, H, t, S.water, S.waterD, S.waterHi, 0.5);
    s.rect(0, gy, W, 2, S.gd);
    var b1 = wrap(t * 0.25, W + 60) - 30, bob = Math.round(Math.sin(t * 0.3));
    boat(s, b1, 44 + bob, 1, true, t, 3);
    for (i = 0; i < 3; i++) man(s, b1 - 6 + i * 5, 40 + bob, { c: [19, 10, 16][i], h: 'knot', d: 1, a: ((t >> 2) + i) & 1 ? 'fwd' : 'hold' });
    var b2 = W - wrap(t * 0.15 + 50, W + 60) + 30, bob2 = Math.round(Math.sin(t * 0.3 + 2));
    boat(s, b2, 33 + bob2, -1, true, t, 2);
    var b3 = 30 + Math.sin(t * 0.03) * 10;
    boat(s, b3, 49 + Math.round(Math.sin(t * 0.4 + 1)), 1, false, t);
    man(s, b3, 47 + Math.round(Math.sin(t * 0.4 + 1)), { c: 20, h: 'straw', d: 1, a: 'fwd' });
    s.line(b3 + 2, 40, b3 - 4, 51, 4);
    reeds(s, 0, 18, H - 1, t, S.name === 'Winter' ? 25 : 16);
    reeds(s, 116, W, H - 1, t + 3, S.name === 'Winter' ? 25 : 16);
    for (i = 0; i < 2; i++) bird(s, wrap(t * 0.5 + i * 12, W + 20) - 10, 12 + i * 3, t + i * 2, 1);
  };

  SC.travel = function (s, t, o) {
    var S = seasonOf(o), gy = 28, i, x;
    var off = t * 2;
    land(s, S, t, gy, { scroll: off });
    s.rect(0, 40, W, 7, S.road); s.rect(0, 40, W, 1, SHADE[S.road]);
    for (i = 0; i < 20; i++) { x = wrap(i * 13 - off, W + 10) - 5; s.rect(x, 43 + (i % 2) * 2, 3, 1, SHADE[S.road]); }
    for (i = 0; i < 4; i++) {
      x = wrap(i * 47 + 20 - off * 0.8, W + 40) - 20;
      tree(s, x, 38, S, t, 10 + (i % 2) * 3, i % 3 === 2 ? 'pine' : (i % 2 ? 'blossom' : 'round'));
    }
    var stone = wrap(90 - off, W + 60) - 30;
    s.rect(stone, 35, 3, 5, 25); s.rect(stone, 35, 3, 1, 24); s.set(stone + 1, 37, 26);
    var bob = (t >> 1) & 1;
    dust(s, 50, 47, t, 4, SHADE[S.road]);
    horse(s, 62, 46, 1, t >> 1, 5, 27);
    man(s, 61, 38 - bob, { p: 'ride', c: 20, h: 'straw', d: 1, a: 'hold', f: t });
    for (i = 0; i < 6; i++) { x = wrap(i * 23 - off * 1.4, W + 10) - 5; s.rect(x, 49 + (i % 3), 2, 1, S.gd); s.set(x + 1, 48 + (i % 3), S.g2); }
    seasonFx(s, S, t, 8, -1);
  };

  SC.treaty = function (s, t, o) {
    var i, x, y;
    s.rect(0, 0, W, 34, 2);
    for (x = 0; x < W; x += 19) s.rect(x, 5, 1, 29, 3);
    s.rect(0, 28, W, 1, 3); s.rect(0, 33, W, 1, 3);
    s.rect(0, 0, W, 4, 11); s.rect(0, 4, W, 1, 13);
    for (i = 0; i < 4; i++) { x = 10 + i * 38; s.rect(x, 4, 4, 30, 10); s.rect(x + 3, 4, 1, 30, 11); s.set(x, 4, 12); }
    s.rect(52, 8, 32, 18, 11); s.rect(54, 10, 28, 14, 10); s.rect(55, 11, 26, 12, 11);
    s.ell(68, 17, 5, 5, 13); s.ell(68, 17, 3.5, 3.5, 12); s.ell(68, 17, 2, 2, 13); s.set(67, 15, 2);
    s.line(57, 13, 61, 13, 13); s.line(75, 13, 79, 13, 13); s.line(57, 21, 61, 21, 13); s.line(75, 21, 79, 21, 13);
    s.rect(0, 34, W, H - 34, 4);
    for (y = 34; y < H; y += 3) s.rect(0, y, W, 1, 5);
    for (x = 0; x < W; x += 10) for (y = 34; y < H; y++) s.set(x + Math.round((y - 34) * (x - 68) / 40), y, 5);
    s.line(22, 10, 22, 46, 5); flag(s, 22, 10, 9, 7, t, 20, 1, 1);
    s.line(114, 10, 114, 46, 5); flag(s, 114, 10, 9, 7, t + 4, 11, -1, 13);
    var cyc = wrap(t, 48), lb = cyc < 12 ? Math.min(2, cyc >> 1) : (cyc < 18 ? Math.max(0, 2 - ((cyc - 12) >> 1)) : 0);
    var rb = cyc >= 24 && cyc < 36 ? Math.min(2, (cyc - 24) >> 1) : (cyc >= 36 && cyc < 42 ? Math.max(0, 2 - ((cyc - 36) >> 1)) : 0);
    man(s, 50, 46, { c: 16, h: 'knot', d: 1, a: lb ? 'fwd' : 'hold', lean: lb });
    man(s, 86, 46, { c: 21, h: 'official', d: -1, a: rb ? 'fwd' : 'hold', lean: rb });
    man(s, 38, 46, { c: 4, h: 'band', d: 1, a: 'hold', w: 'spear' });
    man(s, 98, 46, { c: 11, h: 'helmet', d: -1, a: 'hold', w: 'spear' });
    s.rect(58, 42, 20, 2, 9); s.rect(58, 42, 20, 1, 8); s.rect(59, 44, 2, 4, 5); s.rect(75, 44, 2, 4, 5);
    s.rect(63, 40, 10, 2, 1); s.rect(63, 40, 1, 2, 13); s.rect(72, 40, 1, 2, 13);
    for (x = 65; x < 71; x += 2) s.set(x, 41, 27);
    s.rect(60, 40, 2, 2, 27); s.set(75, 41, 10);
  };

  SC.prison = function (s, t, o) {
    var i, x, y;
    // stone cell wall and a straw floor
    s.rect(0, 0, W, 42, 26);
    for (y = 0; y < 42; y += 5) {
      s.rect(0, y + 4, W, 1, 27);
      for (x = (y % 10) ? 0 : 7; x < W; x += 14) { s.rect(x, y, 1, 4, 27); s.rect(x + 1, y, 4, 1, 25); }
    }
    s.rect(0, 42, W, H - 42, 5);
    for (i = 0; i < 46; i++) { x = rnd(i * 3) * W; y = 43 + rnd(i * 3 + 1) * 8; s.line(x, y, x + 2, y - (i & 1), i % 3 ? 4 : 3); }
    // barred window with the night sky and a moonbeam
    s.rect(61, 6, 15, 9, 20); s.rect(60, 5, 17, 1, 27); s.rect(60, 15, 17, 1, 25);
    s.set(64, 8, 24); s.set(72, 11, 1); s.ell(69, 9, 1.5, 1.5, 30);
    for (x = 63; x < 76; x += 3) s.rect(x, 6, 1, 9, 27);
    for (y = 16; y < 50; y++) {
      var bx = Math.round(61 - (y - 16) * 0.65);
      for (x = bx; x < bx + 15; x++) if (BAYER[(y & 3) * 4 + (x & 3)] < (y < 30 ? 5 : 4)) { var c = s.get(x, y); if (c >= 0) s.set(x, y, LIGHT[c]); }
    }
    // torch on the wall
    var fl = (t >> 1) & 1;
    s.warm(15, 24, 18 + fl, 14, 4);
    s.rect(14, 21, 2, 7, 5); s.rect(13, 20, 4, 1, 26); fire(s, 15, 19, t, 0.4);
    // the prisoner in a wooden cangue, now and then lifting his head
    var lift = wrap(t, 72) < 24 ? 1 : 0, px = 47;
    man(s, px, 47, { c: 25, l: 26, k: 7, h: 'cap', hc: 27, d: 1, p: 'sit', a: 'none', lean: lift ? 0 : 1 });
    var cy = 41 - lift;
    s.rect(px - 6, cy, 13, 2, 3); s.rect(px - 6, cy, 13, 1, 2); s.rect(px - 6, cy + 2, 13, 1, 4);
    s.set(px - 5, cy + 1, 27); s.set(px + 5, cy + 1, 27); s.set(px + 6, cy + 1, 13);
    // iron bars in front
    s.rect(0, 2, W, 2, 26); s.rect(0, 2, W, 1, 24);
    s.rect(0, 47, W, 2, 26); s.rect(0, 47, W, 1, 24);
    for (x = 4; x < W; x += 17) {
      s.rect(x, 0, 3, H, 26); s.rect(x, 0, 1, H, 24); s.rect(x + 2, 0, 1, H, 27);
      s.set(x + 1, 3, 25); s.set(x + 1, 48, 25);
    }
  };

  var SCENES = ['idle', 'hunt', 'beast', 'march', 'battle', 'feast', 'build', 'farm', 'flood', 'market', 'tavern',
    'train', 'festival', 'typhoon', 'snow', 'epidemic', 'riot', 'edict', 'victory', 'defeat', 'rest', 'smithy',
    'ship', 'travel', 'treaty', 'prison'];
  // Still frame used under reduced motion (a moment where each scene reads well).
  var STILL = { edict: 60, build: 160, hunt: 20, battle: 5, festival: 25, typhoon: 1, smithy: 3 };

  function paint(scene, t, opts) {
    var s = new Pix(W, H), fn = SC[scene] || SC.idle;
    fn(s, t | 0, opts || {});
    for (var i = 0; i < s.d.length; i++) if (s.d[i] > 31) s.d[i] = 27;
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

  function create(canvas) {
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    var ctx = canvas.getContext('2d'), img = ctx.createImageData(W, H), raf = 0, scene = 'idle', opts = {}, frame = 0, last = 0, seen = false;
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
      while (now - last >= step) { last += step; frame++; drew = true; }
      if (drew) blit(paint(scene, frame, opts));
      raf = root.requestAnimationFrame(tick);
    }
    function stop() {
      if (raf && root.cancelAnimationFrame) root.cancelAnimationFrame(raf);
      raf = 0;
    }
    return {
      play: function (name, o) {
        stop();
        scene = SC[name] ? name : 'idle';
        opts = o || {};
        frame = 0; last = 0;
        if (reducedMotion() || !root.requestAnimationFrame) {
          blit(paint(scene, STILL[scene] != null ? STILL[scene] : 24, opts));
          return;
        }
        blit(paint(scene, 0, opts));
        raf = root.requestAnimationFrame(tick);
      },
      stop: stop
    };
  }

  BK.Vignette = {
    W: W,
    H: H,
    FPS: FPS,
    SCENES: SCENES,
    create: create,
    // Palette indices of one frame, no DOM: { w, h, data: Uint8Array }.
    frame: function (scene, t, opts) { var s = paint(scene, t, opts); return { w: s.w, h: s.h, data: s.d }; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
