/* Draws the strategic map: dithered faction colours over a hand-built map of Song China,
   rivers, lakes, mountains, numbered prefectures and selection highlights. */
(function (root) {
  'use strict';
  var BK = root.BK = root.BK || {};

  var DIGITS = ['111101101101111', '010110010010111', '111001111100111', '111001111001111', '101101111001001',
    '111100111001111', '111100111101111', '111001010010010', '111101111101111', '111101111001111'];

  function rgb(hex) { return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]; }
  function shade(c, k) { return [Math.round(c[0] * k), Math.round(c[1] * k), Math.round(c[2] * k)]; }

  function MapView(canvas) {
    this.cv = canvas;
    this.g = canvas.getContext('2d');
    this.geo = BK.MapGeo.build();
    this.focus = 0;
    this.hover = 0;
    this.cands = null;
    this.blink = true;
    this.edges = this.buildEdges();
    this.base = this.buildBase();
    var self = this;
    this.timer = setInterval(function () {
      if (self.cands) { self.blink = !self.blink; self.draw(); }
    }, 420);
  }

  MapView.prototype = {
    buildEdges: function () {
      var g = this.geo, W = g.W, H = g.H, ids = g.ids, edges = {};
      for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
        var id = ids[y * W + x];
        if (id === 0 || id === 254) continue;
        var e = (x + 1 < W && ids[y * W + x + 1] !== id) || (y + 1 < H && ids[(y + 1) * W + x] !== id) ||
          (x > 0 && ids[y * W + x - 1] !== id) || (y > 0 && ids[(y - 1) * W + x] !== id);
        if (e) (edges[id] = edges[id] || []).push(y * W + x);
      }
      return edges;
    },

    buildBase: function () {
      var g = this.geo, W = g.W, H = g.H;
      var cv = document.createElement('canvas');
      cv.width = W; cv.height = H;
      var c = cv.getContext('2d');
      c.imageSmoothingEnabled = false;
      var img = c.createImageData(W, H), d = img.data;
      var sea = rgb(BK.PAL[19]), seaHi = rgb(BK.PAL[18]), seaDk = rgb(BK.PAL[20]);
      var fr = rgb('#3d4a3a'), frHi = rgb('#55634e');
      for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
        var i = y * W + x, id = g.ids[i], col;
        if (id === 0) {
          col = ((x + y) & 1) ? sea : seaDk;
          if (y % 4 === 1 && ((x + (y >> 2) * 5) % 9) < 3) col = seaHi;
        } else if (id === 254) {
          col = ((x * 3 + y) % 6 === 0) ? frHi : fr;
        } else col = null;
        if (col) { d[i * 4] = col[0]; d[i * 4 + 1] = col[1]; d[i * 4 + 2] = col[2]; d[i * 4 + 3] = 255; }
      }
      c.putImageData(img, 0, 0);
      return cv;
    },

    colorFor: function (s, p) {
      if (p.owner == null) return rgb(BK.PAL[BK.C.land]);
      var f = s.factions[p.owner];
      return rgb(BK.PAL[f.color]);
    },

    draw: function (s) {
      s = s || this.s;
      if (!s) return;
      this.s = s;
      var g = this.geo, W = g.W, H = g.H, ctx = this.g;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(this.base, 0, 0);
      var img = ctx.getImageData(0, 0, W, H), d = img.data;
      var cols = {}, darks = {};
      s.prefs.forEach(function (p) {
        var c = this.colorFor(s, p);
        cols[p.id] = c;
        darks[p.id] = shade(c, 0.82);
      }, this);
      var land = rgb(BK.PAL[BK.C.land]), landDk = rgb(BK.PAL[BK.C.landShade]);
      for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
        var i = y * W + x, id = g.ids[i];
        if (id === 0 || id === 254) continue;
        var p = s.prefs[id - 1];
        var col;
        if (p.owner == null) col = ((x & 1) && (y & 1)) ? landDk : land;
        else col = ((x + y * 2) % 4 === 0) ? darks[id] : cols[id];
        d[i * 4] = col[0]; d[i * 4 + 1] = col[1]; d[i * 4 + 2] = col[2]; d[i * 4 + 3] = 255;
      }
      // Borders between prefectures and along the coast.
      var line = [44, 53, 32];
      Object.keys(this.edges).forEach(function (id) {
        this.edges[id].forEach(function (i) {
          d[i * 4] = line[0]; d[i * 4 + 1] = line[1]; d[i * 4 + 2] = line[2];
        });
      }, this);
      ctx.putImageData(img, 0, 0);

      this.drawWater(ctx);
      this.drawMountains(ctx);
      this.drawHighlights(ctx, s);
      this.drawLabels(ctx, s);
    },

    drawWater: function (ctx) {
      var g = this.geo;
      ctx.fillStyle = BK.PAL[19];
      g.lakes.forEach(function (l) {
        var r = Math.max(3, Math.round(l.r));
        for (var y = -r; y <= r; y++) for (var x = -r; x <= r; x++) {
          if (x * x + y * y <= r * r) ctx.fillRect(Math.round(l.x + x), Math.round(l.y + y), 1, 1);
        }
        ctx.fillStyle = BK.PAL[18];
        ctx.fillRect(Math.round(l.x - r / 2), Math.round(l.y - 1), Math.max(2, r), 1);
        ctx.fillStyle = BK.PAL[19];
      });
      Object.keys(g.rivers).forEach(function (name) {
        ctx.fillStyle = name === 'yellow' ? '#C9A04A' : BK.PAL[19];
        var pts = g.rivers[name];
        for (var s = 0; s < pts.length - 1; s++) {
          var a = pts[s], b = pts[s + 1];
          var n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y));
          for (var t = 0; t <= n; t++) {
            var x = Math.round(a.x + (b.x - a.x) * t / n), y = Math.round(a.y + (b.y - a.y) * t / n);
            if (g.idAt(x, y) === 0) continue;
            ctx.fillRect(x, y, 1, 1);
            if (name === 'yellow' || name === 'yangtze') ctx.fillRect(x + 1, y, 1, 1);
          }
        }
      });
    },

    drawMountains: function (ctx) {
      this.geo.peaks.forEach(function (pk) {
        var x = Math.round(pk.x), y = Math.round(pk.y), h = pk.size;
        for (var row = 0; row < h; row++) {
          var half = Math.floor(row * 0.9);
          for (var dx = -half; dx <= half; dx++) {
            ctx.fillStyle = dx < 0 ? '#B08A5A' : (dx === 0 && row < 2 ? '#E8F2F8' : '#6E4E2E');
            if (row < 2 && h >= 6) ctx.fillStyle = '#E8F2F8';
            ctx.fillRect(x + dx, y - h + row, 1, 1);
          }
        }
        ctx.fillStyle = '#3A2614';
        ctx.fillRect(x - Math.floor((h - 1) * 0.9), y - 1, Math.floor((h - 1) * 0.9) * 2 + 1, 1);
      });
    },

    outline: function (ctx, id, color, thick) {
      var W = this.geo.W;
      ctx.fillStyle = color;
      (this.edges[id] || []).forEach(function (i) {
        var x = i % W, y = Math.floor(i / W);
        ctx.fillRect(x, y, thick || 1, thick || 1);
      });
    },

    drawHighlights: function (ctx, s) {
      var self = this;
      if (this.cands && this.blink) this.cands.forEach(function (id) { self.outline(ctx, id, '#FFFFFF', 2); });
      if (this.focus) this.outline(ctx, this.focus, '#F6D63E', 2);
      if (this.hover && this.hover !== this.focus) this.outline(ctx, this.hover, '#FFFFFF', 1);
      // Exile bands camp as small banners.
      s.factions.forEach(function (f) {
        if (!f.alive || !f.exileAt || !BK.World.isExiled(s, f.id)) return;
        var l = self.geo.label[f.exileAt];
        var x = l.x + 7, y = l.y - 8;
        ctx.fillStyle = '#23262E'; ctx.fillRect(x, y, 1, 9);
        ctx.fillStyle = BK.PAL[f.color]; ctx.fillRect(x + 1, y, 5, 4);
        ctx.fillStyle = '#000'; ctx.fillRect(x + 1, y + 4, 5, 1);
      });
    },

    drawLabels: function (ctx, s) {
      var g = this.geo, cap = BK.MapData.capital;
      s.prefs.forEach(function (p) {
        var l = g.label[p.id], txt = String(p.id);
        var w = txt.length * 4 + 1, h = 7;
        var x = Math.round(l.x - w / 2), y = Math.round(l.y - h / 2);
        ctx.fillStyle = p.id === cap ? '#F6D63E' : '#F4F2EA';
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = '#15161C';
        ctx.fillRect(x - 1, y, 1, h); ctx.fillRect(x + w, y, 1, h);
        ctx.fillRect(x, y - 1, w, 1); ctx.fillRect(x, y + h, w, 1);
        for (var k = 0; k < txt.length; k++) {
          var bits = DIGITS[+txt[k]];
          for (var b = 0; b < 15; b++) if (bits[b] === '1') ctx.fillRect(x + 1 + k * 4 + (b % 3), y + 1 + Math.floor(b / 3), 1, 1);
        }
        if (p.id === cap) {
          ctx.fillStyle = '#A0201C';
          ctx.fillRect(x + w + 2, y + 1, 5, 5);
          ctx.fillStyle = '#F6D63E';
          ctx.fillRect(x + w + 3, y + 2, 3, 3);
        }
      });
    },

    // Prefecture id under a mouse event, or 0.
    hit: function (ev) {
      var r = this.cv.getBoundingClientRect();
      var x = (ev.clientX - r.left) / r.width * this.geo.W;
      var y = (ev.clientY - r.top) / r.height * this.geo.H;
      var id = this.geo.idAt(x, y);
      return id >= 1 && id <= 49 ? id : 0;
    }
  };

  BK.MapView = MapView;
})(typeof window !== 'undefined' ? window : globalThis);
