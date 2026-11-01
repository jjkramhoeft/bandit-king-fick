/* Bandit King of Ancient China - procedural character portraits, 32x40, BK.PAL colours only.
   A portrait is painted back to front into a palette-index buffer from a "look". Any look field
   the caller leaves out is filled from BK.hash(id) and the role, so an id always gives the same
   face. Finished canvases are cached by id. */
(function (root) {
  'use strict';
  var BK = root.BK = root.BK || {};

  var W = 32, H = 40, CX = 16;     // the face centre falls between columns 15 and 16
  var EY = 16, MY = 22;            // eye row, mouth row

  // Darker / lighter neighbour of every palette entry, used for 2-tone shading.
  var SHADE = [0, 24, 3, 4, 5, 27, 7, 8, 9, 5, 11, 5, 8, 12, 15, 16, 27, 16, 19, 20, 27, 20, 21, 22, 25, 26, 27, 0, 29, 15, 31, 25];
  var LIGHT = [27, 1, 1, 2, 3, 4, 2, 6, 7, 8, 12, 10, 13, 2, 28, 14, 15, 18, 30, 31, 19, 22, 23, 1, 1, 24, 25, 26, 30, 28, 1, 30];
  var BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  var LIGHTISH = [1, 2, 3, 6, 7, 12, 13, 14, 18, 23, 24, 28, 30, 31];

  var ROLES = ['hero', 'official', 'boss', 'townsperson', 'emperor'];
  var ALL_COLOURS = [];
  for (var ci = 0; ci < 32; ci++) ALL_COLOURS.push(ci);

  var LOOK_FIELDS = {
    sex: ['m', 'f'],
    age: ['young', 'adult', 'old'],
    skin: [0, 1, 2, 3],
    build: ['slim', 'normal', 'broad'],
    hair: ['topknot', 'bald', 'headband', 'scarf', 'long', 'wild', 'bun', 'cap', 'official', 'helmet', 'monk', 'turban', 'crown'],
    hairColor: ['black', 'brown', 'grey', 'white', 'red'],
    beard: ['none', 'stubble', 'mustache', 'goatee', 'full', 'long', 'wild'],
    brows: ['thin', 'thick', 'angry'],
    mood: ['calm', 'fierce', 'smile', 'sly'],
    mark: [null, 'blueface', 'tattoo', 'scar', 'brand'],
    garb: ALL_COLOURS,
    accessory: [null, 'beads', 'earring', 'flower', 'feather']
  };

  // ---- weighted tables: [value, weight, value, weight, ...] ----
  var T = {
    sex: { hero: ['m', 9, 'f', 1], official: ['m', 1], boss: ['m', 9, 'f', 1], townsperson: ['m', 7, 'f', 3], emperor: ['m', 1] },
    age: {
      hero: ['young', 3, 'adult', 6, 'old', 1.5], official: ['young', 1, 'adult', 5, 'old', 4],
      boss: ['young', 1, 'adult', 6, 'old', 3], townsperson: ['young', 3, 'adult', 4, 'old', 3],
      emperor: ['young', 2, 'adult', 7, 'old', 1]
    },
    skin: {
      hero: [0, 3, 1, 4, 2, 3, 3, 1.2], official: [0, 5, 1, 4, 2, 1.5, 3, 0.3], boss: [0, 2, 1, 4, 2, 3, 3, 1.5],
      townsperson: [0, 2, 1, 4, 2, 3, 3, 1.2], emperor: [0, 6, 1, 3, 2, 0.5]
    },
    build: {
      hero: ['slim', 2.5, 'normal', 4, 'broad', 3.5], official: ['slim', 3, 'normal', 5, 'broad', 2],
      boss: ['slim', 1, 'normal', 4, 'broad', 5], townsperson: ['slim', 3.5, 'normal', 5, 'broad', 1.5],
      emperor: ['slim', 4, 'normal', 5, 'broad', 1]
    },
    mood: {
      hero: ['calm', 3.5, 'fierce', 3, 'smile', 2.5, 'sly', 1], official: ['calm', 4, 'sly', 4.5, 'smile', 1, 'fierce', 0.5],
      boss: ['fierce', 4, 'sly', 3, 'calm', 2, 'smile', 1], townsperson: ['calm', 4.5, 'smile', 4, 'sly', 1, 'fierce', 0.5],
      emperor: ['calm', 7, 'smile', 2, 'sly', 1]
    },
    mark: {
      hero: [null, 85, 'scar', 6, 'tattoo', 4, 'brand', 3.5, 'blueface', 1.5],
      boss: [null, 70, 'scar', 15, 'tattoo', 6, 'brand', 7, 'blueface', 2],
      townsperson: [null, 95, 'scar', 2, 'brand', 2, 'tattoo', 1], official: [null, 97, 'scar', 3], emperor: [null, 1]
    },
    garb: {
      hero: [19, 20, 10, 11, 16, 15, 4, 21, 17, 26, 12, 5, 27],
      official: [11, 21, 16, 20, 10, 11, 21],
      boss: [27, 26, 11, 4, 21, 5, 16],
      townsperson: [4, 3, 5, 25, 26, 29, 31, 24, 2, 20],
      emperor: [13],
      monk: [8, 12, 4, 26, 3, 5]
    }
  };

  function hairTable(role, sex) {
    if (role === 'emperor') return ['crown', 1];
    if (sex === 'f') {
      if (role === 'townsperson') return ['bun', 5, 'scarf', 3, 'long', 2];
      if (role === 'official') return ['bun', 1];
      return ['bun', 6, 'long', 3, 'headband', 1.5, 'scarf', 1];
    }
    if (role === 'official') return ['official', 8, 'cap', 1, 'topknot', 1];
    if (role === 'townsperson') return ['topknot', 3, 'cap', 3, 'scarf', 3, 'bald', 1, 'turban', 1, 'headband', 0.7];
    if (role === 'boss') return ['wild', 3, 'headband', 2.5, 'helmet', 2.5, 'topknot', 1.5, 'bald', 1.5, 'scarf', 1.5, 'turban', 1];
    return ['topknot', 5, 'headband', 4, 'scarf', 3, 'wild', 2.5, 'long', 1.5, 'cap', 1.5, 'helmet', 2, 'bald', 0.8, 'monk', 0.5, 'turban', 1];
  }
  function hairColorTable(role, age) {
    if (age === 'old') return ['grey', 5, 'white', 4, 'black', 1];
    if (role === 'official' || role === 'emperor') return ['black', 9, 'brown', 1, 'grey', 1];
    var red = role === 'townsperson' ? 0.1 : 0.3;
    return ['black', 8, 'brown', 2.5, 'red', red, 'grey', age === 'adult' ? 0.4 : 0];
  }
  function beardTable(role, age) {
    var t;
    if (age === 'young') t = { none: 6, stubble: 2.5, mustache: 1.5, goatee: 0, full: 0, long: 0, wild: 0 };
    else if (age === 'old') t = { none: 0.8, stubble: 0, mustache: 1.5, goatee: 2, full: 2, long: 3.5, wild: 0.6 };
    else t = { none: 2, stubble: 2, mustache: 2, goatee: 2, full: 2.5, long: 1, wild: 1 };
    if (role === 'official' || role === 'emperor') { t.wild = 0; t.stubble = 0; t.full *= 0.5; t.goatee *= 2; t.long *= 1.5; t.mustache *= 1.5; }
    if (role === 'boss') { t.wild *= 2; t.full *= 1.5; }
    if (role === 'townsperson') t.wild *= 0.5;
    var out = [];
    for (var k in t) out.push(k, t[k]);
    return out;
  }
  function browTable(sex, mood) {
    if (sex === 'f') return ['thin', 8, 'thick', 1, 'angry', mood === 'fierce' ? 3 : 0.5];
    return ['thin', 3, 'thick', 4, 'angry', mood === 'fierce' ? 7 : 1.5];
  }
  function garbTable(role, hair) {
    var list = hair === 'crown' ? T.garb.emperor : (hair === 'monk' ? T.garb.monk : T.garb[role]);
    var out = [];
    for (var i = 0; i < list.length; i++) out.push(list[i], 1);
    return out;
  }
  function accTable(role, sex) {
    if (role === 'official' || role === 'emperor') return [null, 1];
    if (sex === 'f') return [null, 55, 'earring', 15, 'flower', 25, 'beads', 5];
    return [null, 88, 'beads', 3, 'earring', 3, 'flower', 2, 'feather', 3];
  }

  function wpick(rng, table) {
    var total = 0, i;
    for (i = 1; i < table.length; i += 2) total += table[i];
    var r = rng.next() * total;
    for (i = 0; i < table.length; i += 2) {
      r -= table[i + 1];
      if (r < 0) return table[i];
    }
    return table[table.length - 2];
  }

  function valid(name, v) {
    if (name === 'garb') return typeof v === 'number' && v >= 0 && v < 32 && v === Math.floor(v);
    return LOOK_FIELDS[name].indexOf(v) >= 0;
  }

  // Fill the look. Every field consumes the generator, given or not, so fixing one field
  // never reshuffles the others.
  function resolve(spec) {
    spec = spec || {};
    var id = String(spec.id != null ? spec.id : (spec.name || '?'));
    var role = ROLES.indexOf(spec.role) >= 0 ? spec.role : 'hero';
    var given = spec.look || {};
    var rng = new BK.Rng(BK.hash(id));
    var L = {};
    function take(name, table) {
      var v = wpick(rng, table), g = given[name];
      L[name] = (g !== undefined && valid(name, g)) ? g : v;
    }
    take('sex', T.sex[role]);
    take('age', T.age[role]);
    take('skin', T.skin[role]);
    take('build', T.build[role]);
    take('hair', hairTable(role, L.sex));
    take('hairColor', hairColorTable(role, L.age));
    take('beard', beardTable(role, L.age));
    if (L.sex === 'f') L.beard = 'none';
    take('mood', T.mood[role]);
    take('brows', browTable(L.sex, L.mood));
    take('mark', T.mark[role]);
    take('garb', garbTable(role, L.hair));
    take('accessory', accTable(role, L.sex));
    return { id: id, role: role, look: L };
  }

  // Hidden variety that is not part of the look API: face shape, colours of trims and cloths.
  function extras(R) {
    var L = R.look, r = new BK.Rng(BK.hash(R.id + '#portrait'));
    var X = {};
    X.face = wpick(r, L.sex === 'f' ? ['oval', 4, 'pointed', 5, 'round', 2, 'long', 1] :
      L.build === 'broad' ? ['square', 4, 'broad', 4, 'round', 2, 'oval', 1] :
        L.build === 'slim' ? ['oval', 3, 'long', 3, 'pointed', 2, 'square', 1] :
          ['oval', 3, 'square', 3, 'round', 2, 'long', 1.5, 'broad', 1]);
    X.eyeIn = r.chance(0.6) ? 2 : 1;
    X.noseLong = r.chance(0.35);
    X.side = r.chance(0.5) ? 1 : 0;
    X.glance = r.chance(0.5) ? 1 : -1;
    X.bigEars = r.chance(0.25);
    X.grin = r.chance(0.5);
    X.droop = r.chance(0.55);
    X.seed = r.int(1, 1000000000);
    X.knot = r.pick(['plain', 'band', 'cloth', 'band']);
    X.bun = r.pick(['top', 'top', 'twin', 'side']);
    X.cloth = r.pick([27, 20, 16, 5, 11, 26, 4, 19, 21]);
    X.band = r.pick([10, 11, 1, 19, 13, 2, 27]);
    X.cap = r.pick([5, 27, 20, 26, 16, 4]);
    X.turban = r.pick([2, 1, 10, 12, 20, 3]);
    X.flower = r.pick([10, 23, 1, 22, 13]);
    X.beadC = r.pick([10, 17, 5, 13]);
    X.glyph = r.int(0, 2);
    X.armourC = r.pick([26, 25, 11, 4, 20]);
    X.oldTufts = L.age === 'old' || r.chance(0.3);
    var bgs = {
      hero: [20, 16, 5, 26, 20, 11], official: [11, 5, 16, 20], boss: [11, 26, 5, 27],
      townsperson: [5, 16, 26, 20], emperor: [11]
    }[R.role];
    var bg = r.pick(bgs);
    if (bg === L.garb || bg === SHADE[L.garb]) bg = bgs[(bgs.indexOf(bg) + 1) % bgs.length];
    if (bg === L.garb) bg = 26;
    X.bg = bg;
    var light = LIGHTISH.indexOf(L.garb) >= 0;
    X.trim = light ? r.pick([27, 20, 11, SHADE[SHADE[L.garb]]]) : r.pick([2, 3, 1, 10, 13, LIGHT[L.garb]]);
    if (X.trim === L.garb) X.trim = light ? 27 : 2;
    X.inner = r.pick([2, 1, 24, 2]);
    if (L.hair === 'crown') { X.trim = 10; X.inner = 1; }
    X.armour = L.mark !== 'tattoo' && (L.hair === 'helmet' || ((R.role === 'hero' || R.role === 'boss') && r.chance(0.12)));
    return X;
  }

  var FACES = {
    oval: [4, 5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 5, 5, 4, 4, 3, 2],
    square: [4, 5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 5, 5, 4, 3],
    round: [4, 5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 5, 5, 4, 3],
    long: [4, 5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 5, 5, 5, 5, 4, 4, 3, 2],
    pointed: [4, 5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 5, 5, 4, 4, 3, 2, 1],
    broad: [4, 5, 6, 6, 6, 6, 6, 6, 6, 7, 7, 7, 7, 7, 6, 6, 5, 4, 3]
  };
  var HAIRC = {
    black: { b: 27, s: 0, h: 26 },
    brown: { b: 5, s: 27, h: 4 },
    grey: { b: 25, s: 26, h: 24 },
    white: { b: 24, s: 25, h: 1 },
    red: { b: 10, s: 11, h: 12 }
  };
  var SKULL = [4, 6, 7, 7, 7, 7];  // hair cap rows from y=4

  function geometry(L, X) {
    var f = L.sex === 'f' ? 1 : 0;
    var P = {
      skin: 6 + L.skin,
      neck: Math.max(3, { slim: 3, normal: 4, broad: 5 }[L.build] - f),
      shoulder: { slim: 11, normal: 13, broad: 15 }[L.build] - f,
      face: FACES[X.face],
      hc: HAIRC[L.hairColor]
    };
    P.chin = 8 + P.face.length - 1;
    P.fw = function (y) { var i = y - 8; return i >= 0 && i < P.face.length ? P.face[i] : 0; };
    P.isFace = function (x, y) { var hw = P.fw(y); return hw > 0 && x >= CX - hw && x < CX + hw; };
    return P;
  }

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
    for (var j = 0; j < h; j++) for (var i = 0; i < w; i++) this.set(x + i, y + j, c);
  };
  Pix.prototype.line = function (x0, y0, x1, y1, c) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    var dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, e = dx + dy;
    for (;;) {
      this.set(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      var e2 = 2 * e;
      if (e2 >= dy) { e += dy; x0 += sx; }
      if (e2 <= dx) { e += dx; y0 += sy; }
    }
  };
  Pix.prototype.mir = function (x, y, c) { this.set(x, y, c); this.set(W - 1 - x, y, c); };

  // Fill centred rows (half-widths from y=top) with a light left side and a shaded right side.
  function fillRows(s, top, rows, b, sh) {
    for (var i = 0; i < rows.length; i++) {
      var y = top + i, hw = rows[i];
      for (var x = CX - hw; x < CX + hw; x++) {
        var rel = x - (CX - hw), c = b;
        if (rel >= hw * 2 - 2 || (rel === hw * 2 - 3 && ((x + y) & 1))) c = sh;
        s.set(x, y, c);
      }
    }
  }

  // ---- background, body ----
  // Flat backdrop colour with a dithered fade to near-black in the corners.
  function background(s, X) {
    for (var y = 0; y < H; y++) {
      for (var x = 0; x < W; x++) {
        var dx = (x - 15.5) / 16, dy = (y - 15) / 21, d = dx * dx + dy * dy;
        var lv = d < 0.85 ? 16 : (d < 1.05 ? 8 : (d < 1.3 ? 3 : 0));
        s.set(x, y, BAYER[(y & 3) * 4 + (x & 3)] < lv ? X.bg : 27);
      }
    }
  }

  function backNeck(s, L, P) {
    var n = P.neck, sk = P.skin, sh = SHADE[sk];
    for (var y = 22; y <= 32; y++) {
      for (var x = CX - n; x < CX + n; x++) {
        var c = sk;
        if (x >= CX + n - 1 || y <= P.chin + 1) c = sh;
        else if (y === P.chin + 2 && ((x + y) & 1)) c = sh;
        s.set(x, y, c);
      }
    }
  }

  function shoulderTop(P, d) {
    var n = P.neck, sw = P.shoulder, top = 30;
    if (d > n + 1) top = 30 + Math.floor((d - n - 1) * 3 / Math.max(1, sw - n - 1));
    if (d === sw - 1) top++;
    return top;
  }

  function body(s, L, P, X) {
    var n = P.neck, sw = P.shoulder, x, y, d, top, c;
    var g = L.garb, gs = SHADE[g], gl = LIGHT[g];
    var bare = L.mark === 'tattoo' && L.sex === 'm';
    var sk = P.skin, ss = SHADE[sk];
    for (x = 0; x < W; x++) {
      d = x < CX ? CX - 1 - x : x - CX;
      if (d >= sw) continue;
      top = shoulderTop(P, d);
      var right = x >= CX;
      for (y = top; y < H; y++) {
        var b = g, bs = gs, bl = gl;
        if (bare && !(x < CX && d >= sw - 4)) { b = sk; bs = ss; bl = LIGHT[sk]; }
        c = b;
        if (right && d >= sw - 4) c = bs;
        else if (right && d === sw - 5 && ((x + y) & 1)) c = bs;
        if (d === sw - 4 && y > top + 3) c = bs;
        if (y === top && !right && d > n) c = bl;
        if (X.armour && !bare) c = armourPx(x, y, d, top, P, X);
        s.set(x, y, c);
      }
    }
    if (bare) {
      // pectoral lines and the dragon tattoo
      for (x = CX - 5; x < CX + 5; x++) {
        if (x === CX - 1 || x === CX) continue;
        s.set(x, 35 + (Math.abs(x - 15.5) > 3 ? 0 : 1), ss);
      }
      tattoo(s, P, X);
      return;
    }
    if (X.armour) {
      // scarf at the throat and a round chest mirror
      for (x = CX - n - 1; x < CX + n + 1; x++) { s.set(x, 30, g); s.set(x, 31, x >= CX + 1 ? gs : g); }
      var mx = CX - 1, my = 35;
      s.rect(mx - 1, my - 1, 3, 3, 24); s.set(mx - 1, my - 1, 25); s.set(mx + 1, my - 1, 25);
      s.set(mx - 1, my + 1, 25); s.set(mx + 1, my + 1, 26); s.set(mx, my - 1, 1); s.set(mx, my, 1);
      return;
    }
    if (L.hair === 'official') {
      // round collar of a Song court robe
      for (x = CX - n - 2; x < CX + n + 2; x++) {
        d = x < CX ? CX - 1 - x : x - CX;
        var cy = 30 + (d < n - 1 ? 2 : (d < n + 1 ? 1 : 0));
        s.set(x, cy, gs); s.set(x, cy - 1, d < n ? X.inner : gs);
      }
      return;
    }
    // cross collar, right over left; a tattooed woman shows inked skin in the opening
    var inked = L.mark === 'tattoo';
    var inner = inked ? P.skin : X.inner, trim = X.trim;
    for (y = 30; y <= 36; y++) {
      var a = CX - n + Math.floor((y - 30) * 0.5), e = CX + n - 1 - (y - 30);
      if (a > e) break;
      for (x = a; x <= e; x++) s.set(x, y, inner);
      s.set(a - 1, y, trim); s.set(a - 2, y, trim);
    }
    for (y = 30; y < H; y++) {
      var x0 = CX + n - (y - 30);
      s.set(x0, y, trim); s.set(x0 + 1, y, y > 33 ? SHADE[trim] : trim);
    }
    if (inked) {
      for (y = P.chin + 2; y <= 34; y++) {
        x = CX - n + 1 + Math.round(Math.sin(y * 1.3) * 1.2);
        s.set(x, y, (y & 1) ? 20 : 19);
        if (y > 30) s.set(x + 2, y - 1, 19);
      }
      s.set(CX + n - 2, 29, 19); s.set(CX + n - 2, 30, 20);
    }
    if (L.hair === 'crown') {
      // small dragon roundels on the shoulders of the yellow robe
      roundel(s, CX - sw + 4, 34, 12); roundel(s, CX + sw - 5, 34, 11);
    }
  }

  function roundel(s, x, y, c) {
    s.set(x, y - 1, c); s.set(x - 1, y, c); s.set(x + 1, y, c); s.set(x, y + 1, c); s.set(x, y, 10);
  }

  function armourPx(x, y, d, top, P, X) {
    var a = X.armourC, as = SHADE[a], al = LIGHT[a], sw = P.shoulder;
    if (d >= sw - 5 && y < top + 5) {
      // pauldron: rounded plate with a light rim
      if (y === top) return al;
      return (y - top) % 2 === 0 ? as : (x >= CX ? as : a);
    }
    var row = (y - 30) >> 1, col = Math.floor((x + (row & 1) * 2) / 3);
    if ((x + (row & 1) * 2) % 3 === 0) return SHADE[as];
    if ((y & 1) === 1) return as;
    return (col & 1) ? a : (x >= CX + 3 ? as : al);
  }

  function tattoo(s, P, X) {
    var sw = P.shoulder, n = P.neck, i, t, x, y;
    var lo = 20, hi = 19;
    // a coiling dragon from the right shoulder across the chest
    for (i = 0; i <= 40; i++) {
      t = i / 40;
      x = CX - 4 + t * (sw + 2);
      y = 34 + 2.6 * Math.sin(t * Math.PI * 2.2 + 0.6) - t * 2;
      s.set(x, y, hi); s.set(x, y + 1, lo);
      if (i % 6 === 3) { s.set(x, y - 1, lo); s.set(x + 1, y + 2, lo); }
    }
    // head with a light eye
    x = CX + sw - 3; y = 31;
    s.rect(x - 1, y, 3, 2, hi); s.set(x - 1, y + 1, lo); s.set(x, y, 1); s.set(x + 2, y - 1, lo);
    // scales curling up the neck
    for (y = P.chin + 2; y <= 31; y++) {
      x = CX - n + ((y & 1) ? 0 : 1);
      s.set(x, y, (y & 1) ? lo : hi);
    }
    s.set(CX + n - 2, 30, hi); s.set(CX + n - 1, 29, lo);
    // a second coil on the bare left shoulder area by the robe
    for (i = 0; i <= 14; i++) {
      t = i / 14;
      x = CX - 5 - t * 4;
      y = 37 - t * 5 + Math.sin(t * 6) * 1.2;
      s.set(x, y, hi); s.set(x + 1, y, lo);
    }
  }

  // ---- face ----
  function face(s, L, P) {
    var rows = P.face, sk = P.skin, sh = SHADE[sk], hi = LIGHT[sk];
    for (var i = 0; i < rows.length; i++) {
      var y = 8 + i, hw = rows[i], last = i === rows.length - 1;
      for (var x = CX - hw; x < CX + hw; x++) {
        var rel = x - (CX - hw), c = sk;
        if (rel >= hw * 2 - 2) c = sh;
        else if (rel === hw * 2 - 3 && ((x + y) & 1)) c = sh;
        if (last && x >= CX - 1) c = sh;
        s.set(x, y, c);
      }
    }
    s.set(CX - 4, 11, hi); s.set(CX - 3, 11, hi); s.set(CX - 4, 12, hi);
    s.set(CX - 4, EY + 2, hi);
    if (L.sex === 'f' && L.skin < 2 && L.age !== 'old') { s.set(CX - 5, EY + 3, 23); s.set(CX + 3, EY + 3, 23); }
  }

  function ears(s, L, P, X) {
    var hw = P.fw(EY), sk = P.skin, sh = SHADE[sk];
    var lx = CX - hw - 1, rx = CX + hw;
    for (var y = 15; y <= 18; y++) { s.set(lx, y, sk); s.set(rx, y, sh); }
    s.set(lx, 16, sh); s.set(rx, 16, SHADE[sh]);
    if (X.bigEars) { s.set(lx - 1, 15, sk); s.set(lx - 1, 16, sk); s.set(rx + 1, 15, sh); s.set(rx + 1, 16, sh); }
  }

  function faceMarks(s, L, P, X) {
    var sk = P.skin, x, y, left = X.side === 0;
    if (L.mark === 'blueface') {
      var r = new BK.Rng(X.seed), mx = left ? CX - 4 : CX + 3, my = EY + 2;
      for (y = 11; y <= 26; y++) {
        for (x = mx - 6; x <= mx + 6; x++) {
          if (!P.isFace(x, y)) continue;
          var dx = (x + 0.5 - mx) / 4.2, dy = (y - my) / 5.6, dd = dx * dx + dy * dy + (r.next() - 0.5) * 0.25;
          if (dd < 1) s.set(x, y, dd > 0.72 ? (((x + y) & 1) ? 20 : 19) : (dd > 0.55 && ((x + y) & 1) ? 20 : 19));
        }
      }
    } else if (L.mark === 'brand') {
      var G = [['#.#', '###', '#.#', '###'], ['###', '.#.', '###', '#.#'], ['##.', '.##', '#.#', '###']][X.glyph];
      var bx = left ? CX - 6 : CX + 3, c = L.skin === 3 ? 27 : 20;
      for (y = 0; y < 4; y++) for (x = 0; x < 3; x++) if (G[y][x] === '#') s.set(bx + x, EY + 2 + y, c);
    }
  }

  function scar(s, L, P, X) {
    var sk = P.skin, c = L.skin <= 1 ? 23 : LIGHT[LIGHT[sk]], dark = SHADE[SHADE[sk]];
    var left = X.side === 1;   // the scar goes on the opposite cheek to a brand
    var x0 = left ? CX - 2 : CX + 1, x1 = left ? CX - 6 : CX + 5;
    var y0 = EY - 4, y1 = EY + 5;
    for (var i = 0; i <= 9; i++) {
      var x = Math.round(x0 + (x1 - x0) * i / 9), y = y0 + i;
      if (y === EY || y === EY - 1) continue;
      if (!P.isFace(x, y)) continue;
      s.set(x, y, c);
      if (i % 3 === 1) s.set(x + (left ? 1 : -1), y, dark);
    }
  }

  function wrinkles(s, L, P) {
    var sh = SHADE[P.skin];
    s.set(CX - 3, 12, sh); s.set(CX - 2, 12, sh); s.set(CX + 1, 12, sh); s.set(CX + 2, 12, sh);
    s.set(CX - 1, 11, sh); s.set(CX, 11, sh);
    s.set(CX - 3, 20, sh); s.set(CX - 3, 21, sh); s.set(CX + 2, 20, sh); s.set(CX + 2, 21, sh);
  }

  // Eye columns, outer to inner, for side 0 (screen left) and 1.
  function eyeX(X, side, u) { return side === 0 ? CX - X.eyeIn - 3 + u : CX + X.eyeIn + 2 - u; }

  function eyes(s, L, P, X) {
    var lid = 27, wh = 1, pu = 0, sh = SHADE[P.skin], m = L.mood, u, side;
    for (side = 0; side < 2; side++) {
      var o = eyeX(X, side, 0), mi = eyeX(X, side, 1), i = eyeX(X, side, 2), out = side === 0 ? -1 : 1;
      if (m === 'smile') {
        s.set(mi, EY - 1, lid); s.set(o, EY, lid); s.set(i, EY, lid);
        s.set(o + out, EY, lid);
        continue;
      }
      for (u = 0; u < 3; u++) s.set(eyeX(X, side, u), EY - 1, lid);
      if (m === 'sly') {
        var pl = (X.glance < 0) === (side === 0) ? o : i;
        s.set(o, EY, wh); s.set(mi, EY, wh); s.set(i, EY, wh); s.set(pl, EY, pu);
        if (pl === o) s.set(i, EY, sh); else s.set(o, EY, sh);
        s.set(o + out, EY - 1, lid);
      } else {
        s.set(o, EY, wh); s.set(mi, EY, pu); s.set(i, EY, wh);
        if (m === 'fierce') { s.set(o, EY + 1, sh); s.set(mi, EY + 1, sh); s.set(i, EY + 1, sh); }
      }
      if (L.sex === 'f') s.set(o + out, EY - 1, lid);
      if (L.age === 'old') { s.set(o, EY + 1, sh); s.set(mi, EY + 1, sh); }
    }
  }

  function brows(s, L, P, X) {
    var hc = P.hc, c = (L.hairColor === 'grey' || L.hairColor === 'white') ? hc.b : (L.hairColor === 'black' ? 0 : hc.s);
    if (L.hair === 'monk' || L.hair === 'bald') c = L.hairColor === 'black' ? 27 : c;
    var by = EY - 2, raise = L.mood === 'smile' ? -1 : 0;
    for (var side = 0; side < 2; side++) {
      var ex = function (u) { return eyeX(X, side, u); }, inw = side === 0 ? 1 : -1;
      if (L.brows === 'angry') {
        s.set(ex(-1), by - 1, c); s.set(ex(0), by - 1, c); s.set(ex(1), by, c); s.set(ex(2), by, c);
        s.set(ex(2) + inw, by + 1, c);
        if (L.sex === 'm') s.set(ex(0), by, c);
      } else if (L.brows === 'thick') {
        s.set(ex(-1), by + raise, c); s.set(ex(0), by + raise, c); s.set(ex(1), by + raise, c); s.set(ex(2), by + raise, c);
        s.set(ex(0), by - 1 + raise, c); s.set(ex(1), by - 1 + raise, c);
      } else {
        s.set(ex(0), by + raise, c); s.set(ex(1), by - 1 + raise, c); s.set(ex(2), by + raise, c);
        if (L.sex === 'm') s.set(ex(-1), by + 1 + raise, c);
      }
    }
  }

  function nose(s, L, P, X) {
    var sk = P.skin, sh = SHADE[sk], sh2 = SHADE[sh];
    if (L.sex === 'f') { s.set(CX, EY + 2, sh); s.set(CX - 1, EY + 3, sh); s.set(CX, EY + 3, sh); return; }
    var len = X.noseLong ? 3 : 2, y0 = EY + 1, i;
    for (i = 0; i < len; i++) s.set(CX, y0 + i, sh);
    s.set(CX - 1, y0, LIGHT[sk]);
    var ny = y0 + len;
    s.set(CX - 2, ny, sh); s.set(CX - 1, ny, sh2); s.set(CX, ny, sh2); s.set(CX + 1, ny, sh);
  }

  function hasMustache(L) { return ['mustache', 'goatee', 'full', 'long', 'wild'].indexOf(L.beard) >= 0; }

  function mouth(s, L, P, X) {
    var sk = P.skin, lip = SHADE[SHADE[sk]], y = MY, x, mus = hasMustache(L);
    if (L.beard === 'full' || L.beard === 'wild') lip = 0;
    if (lip === sk) lip = 27;
    var up = function (xx, c) { if (!mus) s.set(xx, y - 1, c); };
    if (L.sex === 'f') {
      var red = L.skin < 2 ? 10 : 11;
      if (L.mood === 'fierce') { s.set(CX - 2, y, red); s.set(CX - 1, y, 1); s.set(CX, y, 1); s.set(CX + 1, y, red); s.set(CX - 1, y + 1, red); s.set(CX, y + 1, red); return; }
      if (L.mood === 'smile') { s.set(CX - 2, y - 1, red); s.set(CX - 1, y, red); s.set(CX, y, red); s.set(CX + 1, y - 1, red); return; }
      if (L.mood === 'sly') { s.set(CX - 1, y, red); s.set(CX, y, red); s.set(CX + 1, y - 1, red); return; }
      s.set(CX - 1, y, red); s.set(CX, y, red); s.set(CX - 1, y + 1, SHADE[sk]); s.set(CX, y + 1, SHADE[sk]);
      return;
    }
    switch (L.mood) {
      case 'smile':
        up(CX - 3, lip); up(CX + 2, lip);
        for (x = CX - 2; x < CX + 2; x++) s.set(x, y, lip);
        if (X.grin) { s.set(CX - 1, y, 1); s.set(CX, y, 1); s.set(CX - 1, y + 1, lip); s.set(CX, y + 1, lip); }
        if (mus) { s.set(CX - 3, y, lip); s.set(CX + 2, y, lip); }
        break;
      case 'fierce':
        for (x = CX - 2; x < CX + 2; x++) { up(x, lip); s.set(x, y, 1); s.set(x, y + 1, lip); }
        s.set(CX - 3, y, lip); s.set(CX + 2, y, lip);
        break;
      case 'sly':
        for (x = CX - 2; x < CX + 1; x++) s.set(x, y, lip);
        if (mus) s.set(CX + 1, y, lip); else s.set(CX + 1, y - 1, lip);
        break;
      default:
        for (x = CX - 2; x < CX + 2; x++) s.set(x, y, lip);
    }
  }

  // ---- beards ----
  function beard(s, L, P, X) {
    var b = L.beard, hc = P.hc, sk = P.skin, chin = P.chin, x, y, hw, de, on;
    if (b === 'none') return;
    var tex = function (x, y) {
      var c = x >= CX + 2 ? hc.s : hc.b;
      if (((x * 7 + y * 3) % 5) === 0) c = hc.h;
      return c;
    };
    if (b === 'stubble') {
      var st = (L.hairColor === 'black' || L.hairColor === 'brown') ? (L.skin < 2 ? 26 : SHADE[SHADE[sk]]) : hc.s;
      for (y = EY + 3; y <= chin; y++) {
        hw = P.fw(y);
        for (x = CX - hw; x < CX + hw; x++) {
          de = Math.min(x - (CX - hw), CX + hw - 1 - x);
          if ((y >= MY - 1 || de < 2) && BAYER[(y & 3) * 4 + (x & 3)] < 6) s.set(x, y, st);
        }
      }
      return;
    }
    var mus = function (wide) {
      for (x = CX - 3 - wide; x < CX + 3 + wide; x++) s.set(x, MY - 1, tex(x, MY - 1));
      if (X.droop || b === 'long') {
        s.set(CX - 4 - wide, MY, hc.b); s.set(CX + 3 + wide, MY, hc.s);
        s.set(CX - 4 - wide, MY + 1, hc.b); s.set(CX + 3 + wide, MY + 1, hc.s);
      } else {
        s.set(CX - 4 - wide, MY - 2, hc.b); s.set(CX + 3 + wide, MY - 2, hc.s);
      }
    };
    if (b === 'mustache') { mus(0); return; }
    if (b === 'goatee') {
      for (x = CX - 2; x < CX + 2; x++) s.set(x, MY - 1, tex(x, MY - 1));
      for (y = MY + 2; y <= chin + 2; y++) {
        var gw = y <= MY + 3 ? 2 : 1;
        for (x = CX - gw; x < CX + gw; x++) s.set(x, y, tex(x, y));
      }
      return;
    }
    if (b === 'full') {
      for (y = EY + 1; y <= chin + 3; y++) {
        hw = y <= chin ? P.fw(y) : Math.max(1, P.fw(chin) + 1 - (y - chin));
        for (x = CX - hw; x < CX + hw; x++) {
          de = Math.min(x - (CX - hw), CX + hw - 1 - x);
          on = (de < 1) || (y >= MY - 2 && de < 3) || y >= MY + 1 || y > chin || (y === MY - 1 && Math.abs(x - 15.5) < 4);
          if (on) s.set(x, y, tex(x, y));
        }
      }
      for (y = chin - 3; y <= chin; y++) { s.set(CX - P.fw(y) - 1, y, hc.b); s.set(CX + P.fw(y), y, hc.s); }
      return;
    }
    if (b === 'long') {
      mus(0);
      for (y = EY + 1; y <= chin; y++) {
        hw = P.fw(y);
        s.set(CX - hw, y, hc.b); s.set(CX + hw - 1, y, hc.s);
      }
      for (y = MY + 1; y <= 36; y++) {
        var lw = y <= chin ? Math.min(P.fw(y), 3) : Math.max(1, 3 - Math.floor((y - chin) / 3));
        if (y < MY + 3) lw = Math.min(P.fw(y), 4);
        for (x = CX - lw; x < CX + lw; x++) s.set(x, y, ((x + (y >> 2)) & 1) ? hc.b : (x >= CX ? hc.s : hc.h));
      }
      return;
    }
    if (b === 'wild') {
      var r = new BK.Rng(X.seed + 7);
      for (y = EY - 1; y <= chin + 6; y++) {
        hw = y <= chin ? P.fw(y) + 1 : Math.max(1, P.fw(chin) + 4 - (y - chin));
        hw += r.int(0, 1);
        for (x = CX - hw; x < CX + hw; x++) {
          de = Math.min(x - (CX - hw), CX + hw - 1 - x);
          on = (de < 2) || (y >= MY - 2 && de < 4) || y >= MY + 1 || (y === MY - 1 && Math.abs(x - 15.5) < 5);
          if (y === MY && Math.abs(x - 15.5) < 3) on = false;
          if (y <= EY + 1 && de > 1) on = false;
          if (!on) continue;
          var c = x >= CX + 3 ? hc.s : hc.b;
          if ((x + (y >> 1)) % 3 === 0) c = hc.s;
          else if (x < CX && (x * 5 + y * 3) % 13 === 0) c = hc.h;
          s.set(x, y, c);
        }
      }
    }
  }

  // ---- hair and headwear ----
  function hairline(s, hc, y1) {
    var y;
    s.set(CX - 7, 10, hc.b); s.set(CX - 6, 10, hc.b); s.set(CX - 5, 10, hc.b);
    s.set(CX + 4, 10, hc.s); s.set(CX + 5, 10, hc.s); s.set(CX + 6, 10, hc.s);
    for (y = 11; y <= y1; y++) { s.set(CX - 7, y, hc.b); s.set(CX - 6, y, hc.b); s.set(CX + 5, y, hc.s); s.set(CX + 6, y, hc.s); }
  }
  function sheen(s, top, hc) {
    s.set(CX - 3, top + 1, hc.h); s.set(CX - 2, top + 1, hc.h); s.set(CX - 4, top + 2, hc.h); s.set(CX - 5, top + 3, hc.h);
  }
  function capOf(c) { return { b: c, s: SHADE[c], h: LIGHT[c] }; }
  function scalp(s, P) {
    var sk = P.skin, sc = { b: sk, s: SHADE[sk], h: LIGHT[sk] };
    fillRows(s, 4, SKULL, sc.b, sc.s);
    s.set(CX - 3, 5, sc.h); s.set(CX - 2, 5, sc.h); s.set(CX - 4, 6, sc.h);
    return sc;
  }

  var HAIR = {};

  HAIR.topknot = {
    front: function (s, L, P, X) {
      var hc = P.hc;
      fillRows(s, 4, SKULL, hc.b, hc.s); sheen(s, 4, hc); hairline(s, hc, 13);
      var k = X.knot === 'cloth' ? capOf(X.cloth === hc.b ? 2 : X.cloth) : hc;
      fillRows(s, 0, [1, 2, 2], k.b, k.s);
      s.set(CX - 2, 1, k.h);
      if (X.knot === 'band') { s.set(CX - 1, 3, X.band); s.set(CX, 3, X.band); s.set(CX - 2, 3, X.band); s.set(CX + 1, 3, SHADE[X.band]); }
      else fillRows(s, 3, [1], k.b, k.s);
      if (X.knot === 'cloth') { s.set(CX - 3, 1, 13); s.set(CX + 2, 1, 13); }
    }
  };

  HAIR.bald = {
    front: function (s, L, P, X) {
      var hc = P.hc;
      scalp(s, P);
      if (X.oldTufts) {
        for (var y = 9; y <= 14; y++) { s.set(CX - 7, y, hc.b); s.set(CX + 6, y, hc.s); if (y > 10) { s.set(CX - 8, y, hc.b); s.set(CX + 7, y, hc.s); } }
      }
    }
  };

  HAIR.monk = {
    front: function (s, L, P, X) {
      scalp(s, P);
      var dot = SHADE[SHADE[P.skin]];
      s.set(CX - 4, 6, dot); s.set(CX - 2, 5, dot); s.set(CX + 1, 5, dot); s.set(CX + 3, 6, dot);
      s.set(CX - 3, 8, dot); s.set(CX + 2, 8, dot);
    }
  };

  HAIR.headband = {
    front: function (s, L, P, X) {
      var hc = P.hc, r = new BK.Rng(X.seed + 3), x;
      fillRows(s, 4, SKULL, hc.b, hc.s); sheen(s, 4, hc); hairline(s, hc, 13);
      for (x = CX - 4; x < CX + 4; x++) if (r.chance(0.4)) s.set(x, 3, x >= CX + 1 ? hc.s : hc.b);
      if (r.chance(0.5)) fillRows(s, 1, [1, 2, 2], hc.b, hc.s);
      var bc = X.band === hc.b ? 10 : X.band, bs = SHADE[bc];
      for (x = CX - 7; x < CX + 7; x++) { s.set(x, 9, x >= CX + 4 ? bs : bc); s.set(x, 10, bs); }
      s.set(CX + 7, 9, bc); s.set(CX + 7, 10, bs);
      s.line(CX + 7, 11, CX + 8, 14, bc); s.line(CX + 8, 11, CX + 10, 13, bs);
    }
  };

  HAIR.scarf = {
    back: function (s, L, P, X) {
      var c = SHADE[X.cloth === 27 ? 26 : X.cloth];
      s.line(CX - 8, 9, CX - 10, 24, c); s.line(CX - 7, 10, CX - 9, 25, c);
      s.line(CX + 7, 9, CX + 9, 24, c); s.line(CX + 6, 10, CX + 8, 25, c);
    },
    front: function (s, L, P, X) {
      var hc = P.hc, k = capOf(X.cloth === 27 ? 26 : X.cloth), x, y;
      hairline(s, hc, 12);
      fillRows(s, 3, [4, 6, 7, 8, 8, 8, 8, 8], k.b, k.s);
      for (y = 4; y <= 9; y++) for (x = CX - 6; x < CX + 4; x++) if ((x - y + 40) % 5 === 0) s.set(x, y, k.s);
      for (x = CX - 8; x < CX + 8; x++) s.set(x, 10, k.s);
      s.set(CX - 3, 4, k.h); s.set(CX - 4, 5, k.h); s.set(CX - 5, 6, k.h);
      fillRows(s, 1, [1, 2], k.b, k.s);
    }
  };

  HAIR.long = {
    back: function (s, L, P, X) {
      var hc = P.hc, rows = [], y;
      for (y = 5; y <= 36; y++) rows.push(y < 10 ? [6, 7, 8, 8, 9][y - 5] : (y < 31 ? 9 : Math.max(6, 9 - (y - 30))));
      fillRows(s, 5, rows, hc.b, hc.s);
      for (y = 12; y <= 34; y += 1) if ((y % 5) < 3) { s.set(CX - 8, y, hc.s); s.set(CX + 5, y, hc.h === 1 ? hc.b : hc.s); }
    },
    front: function (s, L, P, X) {
      var hc = P.hc, y, bottom = L.sex === 'f' ? 37 : 26;
      fillRows(s, 4, SKULL, hc.b, hc.s); sheen(s, 4, hc);
      s.set(CX - 1, 4, hc.s); s.set(CX - 1, 5, hc.s); s.set(CX - 1, 6, hc.s);
      s.set(CX - 7, 10, hc.b); s.set(CX - 6, 10, hc.b); s.set(CX - 5, 10, hc.b); s.set(CX - 4, 10, hc.b);
      s.set(CX + 3, 10, hc.s); s.set(CX + 4, 10, hc.s); s.set(CX + 5, 10, hc.s); s.set(CX + 6, 10, hc.s);
      for (y = 11; y <= bottom; y++) {
        var o = y > 25 ? Math.floor((y - 25) / 3) : 0;
        s.set(CX - 7 - o, y, hc.b); s.set(CX - 6 - o, y, y < 14 ? hc.b : hc.h);
        s.set(CX + 5 + o, y, hc.s); s.set(CX + 6 + o, y, hc.s);
        if (y < 13) { s.set(CX - 5, y, hc.b); s.set(CX + 4, y, hc.s); }
        if (y > 25) { s.set(CX - 8 - o, y, hc.s); s.set(CX + 7 + o, y, hc.s); }
      }
    }
  };

  HAIR.wild = {
    back: function (s, L, P, X) {
      var hc = P.hc, r = new BK.Rng(X.seed + 11), y, x;
      for (y = 1; y <= 30; y++) {
        var hw = y < 5 ? 6 + y : (y < 20 ? 11 : 11 - Math.floor((y - 19) / 2));
        hw += r.int(-1, 1);
        for (x = CX - hw; x < CX + hw; x++) {
          var c = x >= CX + 4 ? hc.s : hc.b;
          if ((x + (y >> 2)) % 4 === 0) c = hc.s;
          else if (x < CX && (x * 3 + y) % 11 === 0) c = hc.h;
          s.set(x, y, c);
        }
      }
      for (var i = 0; i < 7; i++) { x = CX - 9 + i * 3 + r.int(0, 1); s.set(x, 0, hc.b); s.set(x, 1, hc.b); }
    },
    front: function (s, L, P, X) {
      var hc = P.hc, r = new BK.Rng(X.seed + 13), x, y;
      fillRows(s, 3, [5, 7, 8, 8, 8, 8, 8], hc.b, hc.s); sheen(s, 3, hc);
      for (x = CX - 6; x < CX + 6; x++) {
        var len = r.int(0, 3);
        for (y = 10; y < 10 + len; y++) s.set(x, y, x >= CX + 2 ? hc.s : hc.b);
      }
      for (y = 10; y <= 19; y++) {
        s.set(CX - 8, y, hc.b); s.set(CX - 7, y, hc.b); s.set(CX + 6, y, hc.s); s.set(CX + 7, y, hc.s);
        if (y < 14) { s.set(CX - 6, y, hc.b); s.set(CX + 5, y, hc.s); }
      }
    }
  };

  HAIR.bun = {
    front: function (s, L, P, X) {
      var hc = P.hc, y;
      if (X.bun === 'twin') {
        // two round buns low on either side of the crown, tied with ribbons
        s.rect(CX - 8, 3, 4, 3, hc.b); s.rect(CX - 7, 2, 2, 1, hc.b); s.rect(CX - 7, 6, 2, 1, hc.b);
        s.rect(CX + 4, 3, 4, 3, hc.s); s.rect(CX + 5, 2, 2, 1, hc.s); s.rect(CX + 5, 6, 2, 1, hc.s);
        s.set(CX - 7, 3, hc.h); s.set(CX - 6, 2, hc.h);
        s.set(CX - 5, 6, X.band); s.set(CX + 4, 6, X.band);
      } else {
        var ox = X.bun === 'side' ? 3 : 0;
        for (y = 0; y <= 4; y++) {
          var hw = [2, 3, 3, 3, 2][y];
          for (var x = CX - hw + ox; x < CX + hw + ox; x++) s.set(x, y, x >= CX + ox + 1 ? hc.s : hc.b);
        }
        s.set(CX - 2 + ox, 1, hc.h); s.set(CX - 1 + ox, 1, hc.h);
      }
      fillRows(s, 4, SKULL, hc.b, hc.s); sheen(s, 4, hc);
      s.set(CX - 1, 4, hc.s); s.set(CX - 1, 5, hc.s);
      s.set(CX - 7, 10, hc.b); s.set(CX - 6, 10, hc.b); s.set(CX - 5, 10, hc.b); s.set(CX - 4, 10, hc.b);
      s.set(CX + 3, 10, hc.s); s.set(CX + 4, 10, hc.s); s.set(CX + 5, 10, hc.s); s.set(CX + 6, 10, hc.s);
      for (y = 11; y <= 15; y++) { s.set(CX - 7, y, hc.b); s.set(CX - 6, y, hc.b); s.set(CX + 5, y, hc.s); s.set(CX + 6, y, hc.s); }
      s.set(CX - 5, 11, hc.b); s.set(CX + 4, 11, hc.s);
      if (X.bun !== 'twin') {
        // hairpin with a hanging ornament
        s.line(CX - 6, 4, CX + 5, 0, 13);
        s.set(CX - 7, 4, X.flower === 13 ? 10 : X.flower); s.set(CX - 7, 5, 13); s.set(CX - 7, 6, X.beadC);
      }
    }
  };

  HAIR.cap = {
    front: function (s, L, P, X) {
      var hc = P.hc, k = capOf(X.cap === hc.b ? 4 : X.cap), x;
      hairline(s, hc, 12);
      fillRows(s, 2, [3, 5, 6, 7, 7, 7, 7], k.b, k.s);
      s.set(CX - 3, 3, k.h); s.set(CX - 4, 4, k.h); s.set(CX - 5, 5, k.h);
      for (x = CX - 8; x < CX + 8; x++) { s.set(x, 9, x >= CX + 5 ? SHADE[k.s] : k.s); }
      s.set(CX - 1, 1, k.b); s.set(CX, 1, k.s);
    }
  };

  HAIR.official = {
    front: function (s, L, P, X) {
      var hc = P.hc, x, y;
      s.set(CX - 7, 11, hc.b); s.set(CX - 7, 12, hc.b); s.set(CX + 6, 11, hc.s); s.set(CX + 6, 12, hc.s);
      s.rect(CX - 5, 1, 10, 4, 27);
      for (x = CX - 5; x < CX; x++) s.set(x, 1, 26);
      s.rect(CX - 7, 4, 14, 7, 0);
      for (x = CX - 7; x < CX + 2; x++) s.set(x, 4, 26);
      s.set(CX - 7, 5, 26);
      for (y = 6; y <= 10; y++) s.set(CX + 6, y, 27);
      // the long horizontal wings
      for (x = 0; x < CX - 7; x++) { s.mir(x, 6, 26); s.mir(x, 7, 0); }
      for (y = 5; y <= 8; y++) { s.mir(0, y, 0); s.mir(1, y, 0); }
      s.mir(0, 5, 25); s.mir(1, 5, 25);
      s.set(CX - 8, 6, 26); s.set(CX + 7, 6, 27);
    }
  };

  HAIR.helmet = {
    back: function (s, L, P, X) {
      for (var y = 10; y <= 30; y++) {
        for (var x = CX - 9; x < CX + 9; x++) {
          var c = (y & 1) ? 26 : 25;
          if ((x + (y >> 1)) % 3 === 0) c = 27;
          if (x >= CX + 5) c = (y & 1) ? 27 : 26;
          s.set(x, y, c);
        }
      }
    },
    front: function (s, L, P, X) {
      var x, y;
      fillRows(s, 2, [3, 5, 6, 7, 7, 7, 7, 7], 25, 26);
      for (y = 3; y <= 8; y++) s.set(CX - 6 + (y < 5 ? 2 : 0), y, 24);
      for (y = 2; y <= 8; y++) { s.set(CX - 1, y, 24); s.set(CX, y, 26); }
      s.set(CX - 1, 0, 10); s.set(CX, 0, 11); s.set(CX - 2, 1, 10); s.set(CX - 1, 1, 10); s.set(CX, 1, 11); s.set(CX + 1, 1, 11);
      s.set(CX - 3, 0, 10); s.set(CX + 2, 0, 11);
      for (x = CX - 8; x < CX + 8; x++) { s.set(x, 9, x >= CX + 5 ? 26 : 24); s.set(x, 10, 26); }
      s.set(CX - 5, 10, 13); s.set(CX + 4, 10, 12); s.set(CX - 1, 7, 13); s.set(CX, 7, 12);
      for (y = 11; y <= 19; y++) {
        var c = (y & 1) ? 25 : 26;
        s.set(CX - 9, y, c); s.set(CX - 8, y, c); s.set(CX - 7, y, 26);
        s.set(CX + 6, y, 26); s.set(CX + 7, y, (y & 1) ? 26 : 27); s.set(CX + 8, y, 27);
      }
    }
  };

  HAIR.turban = {
    front: function (s, L, P, X) {
      var hc = P.hc, k = capOf(X.turban), x, y;
      hairline(s, hc, 12);
      fillRows(s, 1, [4, 6, 7, 8, 8, 8, 8, 8, 8, 8], k.b, k.s);
      for (y = 2; y <= 9; y++) for (x = CX - 8; x < CX + 8; x++) if ((x + 2 * y) % 5 === 0) s.set(x, y, k.s);
      for (x = CX - 8; x < CX + 8; x++) s.set(x, 10, k.s);
      s.set(CX - 3, 2, k.h); s.set(CX - 5, 3, k.h); s.set(CX - 6, 4, k.h);
      s.set(CX - 1, 6, 13); s.set(CX, 6, 13); s.set(CX - 1, 7, 10); s.set(CX, 7, 11);
    }
  };

  HAIR.crown = {
    front: function (s, L, P, X) {
      var hc = P.hc, x, y, beads = [1, 10, 13, 17];
      s.set(CX - 7, 11, hc.b); s.set(CX + 6, 11, hc.s);
      s.rect(CX - 6, 4, 12, 7, 0);
      for (x = CX - 6; x < CX; x++) s.set(x, 4, 26);
      for (x = CX - 6; x < CX + 6; x++) { s.set(x, 9, 13); s.set(x, 10, 12); }
      for (x = CX - 9; x < CX + 9; x++) s.set(x, 6, x < CX - 6 || x >= CX + 6 ? 13 : 12);
      s.set(CX - 10, 6, 10); s.set(CX + 9, 6, 10);
      for (x = CX - 12; x < CX + 12; x++) { s.set(x, 2, 27); s.set(x, 3, 13); }
      for (x = CX - 11; x < CX + 11; x++) s.set(x, 1, 26);
      var cols = [CX - 12, CX - 10, CX + 9, CX + 11];
      for (var i = 0; i < cols.length; i++) {
        for (y = 4; y <= 11 - (i === 1 || i === 2 ? 2 : 0); y++) s.set(cols[i], y, beads[(y + i) % 4]);
      }
      for (x = CX - 5; x < CX + 5; x += 2) { s.set(x, 4, beads[x % 4]); s.set(x, 5, beads[(x + 1) % 4]); }
    }
  };

  // ---- accessories ----
  function lum(c) {
    var n = parseInt(BK.PAL[c].slice(1), 16);
    return (((n >> 16) & 255) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000;
  }

  function prayerBeads(s, L, P, big) {
    var k, x, y;
    if (big) {
      // dark wood beads on a light robe, pale amber beads on a dark one
      var pale = lum(L.garb) < 95;
      for (k = -4; k <= 4; k++) {
        x = 15.5 + k * 2.3; y = 29 + 7 * (1 - (k * k) / 21);
        var b = k === 0 ? 11 : (pale ? 3 : 5), hi = k === 0 ? 10 : (pale ? 2 : 4);
        var bx = Math.round(x - 1), by = Math.round(y - 1);
        s.set(bx + 1, by, b); s.set(bx, by + 1, b); s.set(bx + 1, by + 1, b); s.set(bx + 2, by + 1, b); s.set(bx + 1, by + 2, SHADE[b]);
        s.set(bx, by, hi); s.set(bx + 2, by, b); s.set(bx, by + 2, b); s.set(bx + 2, by + 2, SHADE[b]);
        s.set(bx + 1, by, hi);
      }
      return;
    }
    for (k = -5; k <= 5; k++) {
      x = 15.5 + k * 1.15; y = 30 + 4 * (1 - (k * k) / 30);
      s.set(x, y, (k & 1) ? P.beadC : SHADE[P.beadC]);
    }
  }

  function accessory(s, L, P, X) {
    var hw = P.fw(EY);
    if (L.hair === 'monk') prayerBeads(s, L, P, true);
    switch (L.accessory) {
      case 'beads':
        if (L.hair !== 'monk') { P.beadC = X.beadC; prayerBeads(s, L, P, false); }
        break;
      case 'earring':
        s.set(CX - hw - 1, 19, 13); s.set(CX - hw - 1, 20, 12);
        s.set(CX + hw, 19, 12); s.set(CX + hw, 20, 8);
        break;
      case 'flower':
        var fc = X.flower, fx = CX - 7, fy = 9;
        s.set(fx - 1, fy - 1, SHADE[fc]); s.set(fx + 1, fy - 1, SHADE[fc]); s.set(fx - 1, fy + 1, SHADE[fc]); s.set(fx + 1, fy + 1, SHADE[fc]);
        s.set(fx, fy - 1, fc); s.set(fx - 1, fy, fc); s.set(fx + 1, fy, fc); s.set(fx, fy + 1, fc);
        s.set(fx, fy, fc === 13 ? 10 : 13);
        s.set(fx - 2, fy + 2, 15); s.set(fx - 1, fy + 2, 16); s.set(fx + 2, fy - 2, 15);
        break;
      case 'feather':
        for (var i = 0; i <= 10; i++) {
          var x = CX + 4 + i * 0.85, y = 7 - i * 0.7;
          s.set(x, y, (i % 3 === 2) ? 5 : (i > 8 ? 2 : 3));
          s.set(x + 1, y, (i % 3 === 2) ? 27 : 4);
        }
        break;
    }
  }

  // ---- assemble ----
  function paint(spec) {
    var R = resolve(spec), L = R.look, X = extras(R), P = geometry(L, X);
    var s = new Pix(W, H), style = HAIR[L.hair];
    background(s, X);
    if (style.back) style.back(s, L, P, X);
    backNeck(s, L, P);
    body(s, L, P, X);
    face(s, L, P);
    ears(s, L, P, X);
    faceMarks(s, L, P, X);
    if (L.age === 'old') wrinkles(s, L, P);
    eyes(s, L, P, X);
    brows(s, L, P, X);
    nose(s, L, P, X);
    if (L.mark === 'scar') scar(s, L, P, X);
    beard(s, L, P, X);
    mouth(s, L, P, X);
    style.front(s, L, P, X);
    accessory(s, L, P, X);
    return s;
  }

  var rgb = null;
  function palRGB() {
    if (rgb) return rgb;
    rgb = BK.PAL.map(function (h) { var n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; });
    return rgb;
  }

  function toCanvas(s) {
    var c = document.createElement('canvas');
    c.width = s.w; c.height = s.h;
    var ctx = c.getContext('2d'), img = ctx.createImageData(s.w, s.h), p = palRGB(), d = img.data;
    for (var i = 0; i < s.d.length; i++) {
      var q = p[s.d[i]], j = i * 4;
      d[j] = q[0]; d[j + 1] = q[1]; d[j + 2] = q[2]; d[j + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  var cache = {};
  function keyOf(spec) { return String(spec && spec.id != null ? spec.id : (spec && spec.name) || '?'); }

  BK.Portrait = {
    W: W,
    H: H,
    LOOK_FIELDS: LOOK_FIELDS,
    // The full look a spec resolves to (given fields plus seeded ones).
    resolveLook: function (spec) {
      var L = resolve(spec).look, out = {};
      for (var k in L) out[k] = L[k];
      return out;
    },
    // Palette indices only, no DOM: { w, h, data: Uint8Array }.
    pixels: function (spec) { var s = paint(spec); return { w: s.w, h: s.h, data: s.d }; },
    // Cached 32x40 canvas. The same element comes back for the same id, so to show one
    // portrait in two places draw it with BK.Portrait.draw instead of appending it twice.
    render: function (spec) {
      var k = keyOf(spec);
      if (!cache[k]) {
        cache[k] = toCanvas(paint(spec));
        if (spec && spec.name) cache[k].title = spec.name;
      }
      return cache[k];
    },
    draw: function (ctx, spec, x, y, scale) {
      var c = this.render(spec), sc = scale || 1;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(c, x || 0, y || 0, W * sc, H * sc);
    },
    clearCache: function () { cache = {}; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
