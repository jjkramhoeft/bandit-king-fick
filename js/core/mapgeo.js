/* Builds the prefecture raster from BK.MapData: a warped nearest-seat partition of the land,
   plus adjacency, label points and the terrain facts the battle generator needs.
   Runs without a canvas so the engine and tests can use adjacency under Node. */
(function (root) {
  'use strict';
  var BK = root.BK = root.BK || {};

  var SEA = 0, FRONTIER = 254;

  function lattice(ix, iy, salt) {
    var h = Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(salt, 2246822519);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  // Smooth value noise in [-1, 1].
  function noise(x, y, scale, salt) {
    var fx = x / scale, fy = y / scale;
    var ix = Math.floor(fx), iy = Math.floor(fy);
    var tx = fx - ix, ty = fy - iy;
    tx = tx * tx * (3 - 2 * tx);
    ty = ty * ty * (3 - 2 * ty);
    var a = lattice(ix, iy, salt), b = lattice(ix + 1, iy, salt);
    var c = lattice(ix, iy + 1, salt), d = lattice(ix + 1, iy + 1, salt);
    return ((a + (b - a) * tx) + ((c + (d - c) * tx) - (a + (b - a) * tx)) * ty) * 2 - 1;
  }

  function inPoly(x, y, poly) {
    var inside = false;
    for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      var xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  }

  BK.MapGeo = {
    SEA: SEA,
    FRONTIER: FRONTIER,
    _cache: null,

    build: function () {
      if (this._cache) return this._cache;
      var M = BK.MapData, W = M.W, H = M.H;

      function project(lon, lat) {
        return {
          x: (lon - M.LON0) / (M.LON1 - M.LON0) * W,
          y: (M.LAT0 - lat) / (M.LAT0 - M.LAT1) * H
        };
      }

      var seas = M.seas.map(function (poly) {
        return poly.map(function (p) { var q = project(p[0], p[1]); return [q.x, q.y]; });
      });
      var frontierY = project(M.LON0, M.frontierLat).y;
      var seeds = M.prefs.map(function (p) { return project(p.lon, p.lat); });

      var ids = new Uint8Array(W * H);
      var x, y, i, k;
      for (y = 0; y < H; y++) {
        for (x = 0; x < W; x++) {
          var cx = x + 0.5, cy = y + 0.5;
          var isSea = false;
          for (k = 0; k < seas.length; k++) if (inPoly(cx, cy, seas[k])) { isSea = true; break; }
          if (isSea) { ids[y * W + x] = SEA; continue; }
          var wy = cy + noise(cx, cy, 9, 7) * 2.2;
          if (wy < frontierY) { ids[y * W + x] = FRONTIER; continue; }
          // Warp the sample point so borders wander like real boundaries.
          var wx = cx + noise(cx, cy, 16, 1) * 6 + noise(cx, cy, 5, 3) * 1.5;
          var wy2 = cy + noise(cx, cy, 16, 2) * 6 + noise(cx, cy, 5, 4) * 1.5;
          var best = 1e9, bestId = 1;
          for (k = 0; k < seeds.length; k++) {
            var dx = wx - seeds[k].x, dy = wy2 - seeds[k].y;
            var d = dx * dx + dy * dy;
            if (d < best) { best = d; bestId = k + 1; }
          }
          ids[y * W + x] = bestId;
        }
      }

      var n = M.prefs.length;
      var area = new Array(n + 1).fill(0), sx = new Array(n + 1).fill(0), sy = new Array(n + 1).fill(0);
      var touch = {}, coast = {};
      for (y = 0; y < H; y++) {
        for (x = 0; x < W; x++) {
          var id = ids[y * W + x];
          if (id === SEA || id === FRONTIER) continue;
          area[id]++; sx[id] += x; sy[id] += y;
          var nb = [];
          if (x + 1 < W) nb.push(ids[y * W + x + 1]);
          if (y + 1 < H) nb.push(ids[(y + 1) * W + x]);
          if (x > 0) nb.push(ids[y * W + x - 1]);
          if (y > 0) nb.push(ids[(y - 1) * W + x]);
          for (k = 0; k < nb.length; k++) {
            var o = nb[k];
            if (o === SEA) coast[id] = true;
            else if (o !== FRONTIER && o !== id) {
              var key = id < o ? id + '-' + o : o + '-' + id;
              touch[key] = (touch[key] || 0) + 1;
            }
          }
        }
      }

      var adj = {};
      for (i = 1; i <= n; i++) adj[i] = [];
      Object.keys(touch).forEach(function (key) {
        if (touch[key] < 6) return;   // ignore corner contacts
        var ab = key.split('-').map(Number);
        adj[ab[0]].push(ab[1]);
        adj[ab[1]].push(ab[0]);
      });
      for (i = 1; i <= n; i++) adj[i].sort(function (a, b) { return a - b; });

      // Label points: centroid if it lies inside the region, else the nearest region pixel.
      var label = {};
      for (i = 1; i <= n; i++) {
        var lx = Math.round(sx[i] / Math.max(1, area[i])), ly = Math.round(sy[i] / Math.max(1, area[i]));
        if (ids[ly * W + lx] !== i) {
          var bd = 1e9;
          for (y = 0; y < H; y++) for (x = 0; x < W; x++) {
            if (ids[y * W + x] !== i) continue;
            var dd = (x - lx) * (x - lx) + (y - ly) * (y - ly);
            if (dd < bd) { bd = dd; label[i] = { x: x, y: y }; }
          }
        } else label[i] = { x: lx, y: ly };
      }

      function idAt(px, py) {
        px = Math.floor(px); py = Math.floor(py);
        if (px < 0 || py < 0 || px >= W || py >= H) return SEA;
        return ids[py * W + px];
      }

      var rivers = {}, riverPx = {};
      Object.keys(M.rivers).forEach(function (name) {
        var pts = M.rivers[name].map(function (p) { return project(p[0], p[1]); });
        riverPx[name] = pts;
        for (var s = 0; s < pts.length - 1; s++) {
          var a = pts[s], b = pts[s + 1];
          var steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y));
          for (var t = 0; t <= steps; t++) {
            var rid = idAt(a.x + (b.x - a.x) * t / steps, a.y + (b.y - a.y) * t / steps);
            if (rid !== SEA && rid !== FRONTIER) rivers[rid] = (rivers[rid] || 0) + 1;
          }
        }
      });

      var lakes = {}, lakePx = M.lakes.map(function (l) {
        var c = project(l.lon, l.lat);
        var r = l.r / (M.LON1 - M.LON0) * W;
        var lid = idAt(c.x, c.y);
        if (lid !== SEA && lid !== FRONTIER) lakes[lid] = true;
        return { name: l.name, x: c.x, y: c.y, r: r };
      });

      var rng = new BK.Rng(BK.hash('mountains'));
      var peaks = [], hills = {};
      M.mountains.forEach(function (m) {
        for (var p = 0; p < m.n; p++) {
          var q = project(m.lon + rng.range(-m.dlon, m.dlon), m.lat + rng.range(-m.dlat, m.dlat));
          var pid = idAt(q.x, q.y);
          if (pid === SEA) continue;
          peaks.push({ x: q.x, y: q.y, size: rng.int(4, 7) });
          if (pid !== FRONTIER) hills[pid] = (hills[pid] || 0) + 1;
        }
      });
      peaks.sort(function (a, b) { return a.y - b.y; });

      var terrain = {};
      for (i = 1; i <= n; i++) {
        terrain[i] = {
          river: Math.min(3, Math.ceil((rivers[i] || 0) / 12)),
          hills: Math.min(4, hills[i] || 0),
          coast: !!coast[i],
          lake: !!lakes[i]
        };
      }

      this._cache = {
        W: W, H: H, ids: ids, adj: adj, label: label, area: area, seeds: seeds,
        terrain: terrain, rivers: riverPx, lakes: lakePx, peaks: peaks, seas: seas,
        frontierY: frontierY, project: project, idAt: idAt
      };
      return this._cache;
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = BK.MapGeo;
})(typeof window !== 'undefined' ? window : globalThis);
