/* Tactical battle on a 15×11 flat-topped hex field, one month of 30 daily turns.
   The same object drives the human battle screen and silent auto-resolution.
   Terrain costs, Body costs, ranges and requirements follow the battle chapter of the original
   PC/Amiga manual; damage formulas are this game's own. */
(function (root) {
  'use strict';
  var BK = root.BK = root.BK || {};
  var W = BK.World;

  var COLS = 15, ROWS = 11, MP = 12;
  var COST = { plain: 3, forest: 4, castle: 4, hill: 5, marsh: 5, ice: 4 };
  var DEF = { plain: 1, forest: 1.25, hill: 1.35, castle: 2.0, marsh: 0.9, river: 0.8, lake: 0.9, ice: 0.9 };
  var FLAMMABLE = { plain: 0.45, forest: 0.7, hill: 0.35, castle: 0.4 };
  // Body each order costs the hero who gives it. A duel costs the challenger 5 and the challenged 4.
  var TIRE = { move: 1, charge: 1, melee: 2, archery: 1, magic: 20, fireball: 1, putout: 1 };
  // Experience each order earns.
  var LEARN = {
    melee: [['str', 1]], charge: [['str', 1]], archery: [['dex', 1]], magic: [['wis', 5]],
    fireball: [['wis', 1], ['dex', 1]], putout: [['dex', 1], ['wis', 1]]
  };
  // Odd-q neighbour offsets; index doubles as wind direction (0 = SE, 1 = NE, 2 = N, 3 = NW, 4 = SW, 5 = S).
  var DIRS = [
    [[1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0], [0, 1]],
    [[1, 1], [1, 0], [0, -1], [-1, 0], [-1, 1], [0, 1]]
  ];
  // Spring is cloudy and wet, summer and winter mostly clear, autumn changeable; winter rain is snow.
  var WEATHER = {
    Spring: [['Clear', 0.25], ['Clouds', 0.4], ['Rain', 0.35]],
    Summer: [['Clear', 0.7], ['Clouds', 0.15], ['Rain', 0.15]],
    Autumn: [['Clear', 0.45], ['Clouds', 0.3], ['Rain', 0.25]],
    Winter: [['Clear', 0.65], ['Clouds', 0.15], ['Snow', 0.2]]
  };

  function idx(q, r) { return r * COLS + q; }
  function inside(q, r) { return q >= 0 && r >= 0 && q < COLS && r < ROWS; }
  function neighbors(q, r) {
    var out = [];
    DIRS[q & 1].forEach(function (d, i) {
      var nq = q + d[0], nr = r + d[1];
      if (inside(nq, nr)) out.push({ q: nq, r: nr, dir: i });
    });
    return out;
  }
  function cube(q, r) { var x = q, z = r - (q - (q & 1)) / 2; return { x: x, y: -x - z, z: z }; }
  function dist(a, b) {
    var p = cube(a.q, a.r), o = cube(b.q, b.r);
    return Math.max(Math.abs(p.x - o.x), Math.abs(p.y - o.y), Math.abs(p.z - o.z));
  }

  function genField(s, prefId, season) {
    var p = W.pref(s, prefId);
    var t = BK.MapGeo.build().terrain[prefId];
    var r = new BK.Rng(BK.hash('field:' + prefId + ':' + s.year + ':' + s.month));
    var cells = [], river = [];
    for (var i = 0; i < COLS * ROWS; i++) cells.push({ t: 'plain', fire: 0, burnt: false, frozen: false });
    function at(q, rr) { return cells[idx(q, rr)]; }
    function blob(type, n, q0, q1, avoid) {
      var q = r.int(q0, q1), rr = r.int(0, ROWS - 1);
      for (var k = 0; k < n; k++) {
        var c = at(q, rr);
        if (!avoid || avoid.indexOf(c.t) < 0) c.t = type;
        var nb = neighbors(q, rr);
        var step = r.pick(nb);
        q = BK.clamp(step.q, q0, q1); rr = step.r;
      }
    }
    var forests = 2 + r.int(0, 3);
    for (i = 0; i < forests; i++) blob('forest', r.int(4, 9), 1, COLS - 2);
    for (i = 0; i < 1 + t.hills; i++) blob('hill', r.int(3, 6), 2, COLS - 3);
    for (i = 0; i < t.hills; i++) blob('mount', r.int(2, 4), 3, COLS - 4);
    if (t.lake) blob('lake', r.int(5, 9), 4, 10);
    if (t.river) {
      // Every river runs from the upper left of the field to the lower right, with one or two fords.
      var q = r.int(3, 6), fords = t.river >= 3 ? 1 : 2, fordRows = [];
      while (fordRows.length < fords) { var fr = r.int(1, ROWS - 2); if (fordRows.indexOf(fr) < 0) fordRows.push(fr); }
      var lay = function (qq, rr2) {
        var c = at(qq, rr2);
        c.t = fordRows.indexOf(rr2) >= 0 ? 'plain' : 'river';
        river.push({ q: qq, r: rr2 });
        neighbors(qq, rr2).forEach(function (n) {
          var m = at(n.q, n.r);
          if (m.t === 'plain' && r.chance(0.2)) m.t = 'marsh';
        });
      };
      for (var rr = 0; rr < ROWS; rr++) {
        lay(q, rr);
        if (rr < ROWS - 1 && q < 10 && r.chance(0.45)) {
          // Stepping east from an even column needs one more hex to keep the water unbroken.
          if (!(q & 1)) lay(q + 1, rr);
          q++;
        }
      }
    }
    // Castles stand in the defender's half.
    var castles = [], tries = 0;
    while (castles.length < p.castles && tries++ < 400) {
      var cq = r.int(9, COLS - 2), cr = r.int(1, ROWS - 2);
      var ok = castles.every(function (o) { return dist(o, { q: cq, r: cr }) >= 2; });
      if (ok || tries > 300) { at(cq, cr).t = 'castle'; castles.push({ q: cq, r: cr }); }
    }
    // Keep the deployment edge open.
    for (rr = 0; rr < ROWS; rr++) for (q = 0; q < 2; q++) {
      var e = at(q, rr);
      if (e.t === 'mount' || e.t === 'lake' || e.t === 'river') e.t = 'plain';
    }
    if (season === 'Winter') cells.forEach(function (c) {
      if (c.t === 'river' || c.t === 'marsh' || c.t === 'lake') c.frozen = true;
    });
    return { cells: cells, castles: castles, river: river };
  }

  function Battle() {}

  BK.Battle = {
    COLS: COLS, ROWS: ROWS, MP: MP, DIRS: DIRS,
    neighbors: neighbors, dist: dist, idx: idx,

    // opts: { atkFid, source, target, heroes: [ids], food, leader }
    create: function (s, opts) {
      var b = new Battle();
      var tp = W.pref(s, opts.target), sp = W.pref(s, opts.source);
      var exile = W.isExiled(s, opts.atkFid);
      b.s = s;
      b.atkFid = opts.atkFid;
      b.defFid = tp.owner;
      b.source = opts.source;
      b.target = opts.target;
      b.season = W.season(s);
      b.day = 1;
      b.weather = 'Clear';
      b.wind = W.rng(s).int(0, 5);
      b.food = { atk: opts.food, def: tp.food };
      b.stats = {
        atk: exile ? { arms: 25, skill: 35 } : { arms: sp.arms, skill: sp.skill },
        def: { arms: tp.arms, skill: tp.skill }
      };
      var f = genField(s, opts.target, b.season);
      b.cells = f.cells;
      b.castles = f.castles;
      b.river = f.river;
      b.units = [];
      b.log = [];
      b.over = false;
      b.result = null;
      b.side = 'def';
      b.atkLeader = opts.leader;
      b.defLeader = tp.ruler;

      // Ten deployment hexes for the attacker on the west edge, twenty for the defender around the castles.
      var atkSpots = [], defSpots = [];
      for (var rr = 0; rr < ROWS; rr++) for (var q = 0; q < 2; q++) atkSpots.push({ q: q, r: rr });
      atkSpots.sort(function (a, c) { return Math.abs(a.r - 5) - Math.abs(c.r - 5) || a.q - c.q; });
      b.castles.forEach(function (c) { defSpots.push(c); });
      for (rr = 0; rr < ROWS; rr++) for (q = 8; q < COLS; q++) {
        var cell = b.cells[idx(q, rr)];
        if (cell.t !== 'castle' && b.passable(cell, true)) defSpots.push({ q: q, r: rr });
      }
      var self = b;
      defSpots = defSpots.slice(0, b.castles.length).concat(defSpots.slice(b.castles.length).sort(function (a, c) {
        var da = Math.min.apply(null, self.castles.map(function (k) { return dist(k, a); }));
        var dc = Math.min.apply(null, self.castles.map(function (k) { return dist(k, c); }));
        return da - dc;
      }));
      b.atkDeploy = atkSpots.slice(0, 10);
      b.defDeploy = defSpots.slice(0, 20);

      var atkHeroes = opts.heroes.slice(0, 10).map(function (id) { return W.char(s, id); });
      atkHeroes.sort(function (a, c) { return (c.id === opts.leader) - (a.id === opts.leader); });
      atkHeroes.forEach(function (c, i) { b.addUnit(c, 'atk', b.atkDeploy[i]); });
      var defHeroes = W.heroesAt(s, opts.target).slice();
      defHeroes.sort(function (a, c) { return (c.id === tp.ruler) - (a.id === tp.ruler) || c.men - a.men; });
      defHeroes.slice(0, 10).forEach(function (c, i) { b.addUnit(c, 'def', b.defDeploy[i]); });
      // Up to 35 heroes may hold a prefecture, but only ten take the field; the rest can be called up.
      b.reserve = defHeroes.slice(10).map(function (c) { return c.id; });
      b.beginDay(true);
      return b;
    }
  };

  Battle.prototype = {
    addUnit: function (c, side, spot) {
      if (!spot) return null;
      var u = {
        uid: this.units.length, cid: c.id, side: side, men: c.men, men0: Math.max(1, c.men),
        q: spot.q, r: spot.r, acted: false, gone: null, confused: 0
      };
      this.units.push(u);
      return u;
    },
    hero: function (u) { return this.s.chars[u.cid]; },
    cell: function (q, r) { return this.cells[idx(q, r)]; },
    live: function (side) {
      return this.units.filter(function (u) { return !u.gone && (!side || u.side === side); });
    },
    unitAt: function (q, r) {
      for (var i = 0; i < this.units.length; i++) {
        var u = this.units[i];
        if (!u.gone && u.q === q && u.r === r) return u;
      }
      return null;
    },
    terrain: function (c) {
      if (c.frozen) return 'ice';
      return c.t;
    },
    water: function (c) { var t = this.terrain(c); return t === 'river' || t === 'lake'; },
    passable: function (c, plain) {
      var t = this.terrain(c);
      if (t === 'mount') return false;
      if (plain && (t === 'river' || t === 'lake')) return false;
      return true;
    },
    // Only a hero with a ship may take to rivers and lakes; a steersman handles one at half the cost.
    canFord: function (u) { return !!this.hero(u).ship; },
    stepCost: function (u, c) {
      var t = this.terrain(c);
      if (t === 'mount') return Infinity;
      if (t === 'river' || t === 'lake') return this.canFord(u) ? (this.hero(u).steersman ? 4 : 8) : Infinity;
      return COST[t];
    },
    enemyAdjacent: function (u, q, r) {
      var self = this;
      return neighbors(q, r).some(function (n) {
        var o = self.unitAt(n.q, n.r);
        return o && o.side !== u.side;
      });
    },
    // Stepping next to an enemy ends a move, unless you have more than four times its men.
    pinned: function (u, q, r) {
      var self = this;
      return neighbors(q, r).some(function (n) {
        var o = self.unitAt(n.q, n.r);
        return o && o.side !== u.side && !(u.men > 4 * o.men);
      });
    },
    // Dijkstra over movement points; enemies close by and river hexes end a move.
    reachable: function (u, mp) {
      var best = {}, out = [], self = this;
      var start = idx(u.q, u.r);
      mp = mp || MP;
      best[start] = 0;
      var open = [{ q: u.q, r: u.r, c: 0, stop: false }];
      while (open.length) {
        open.sort(function (a, b) { return a.c - b.c; });
        var cur = open.shift();
        if (cur.stop) continue;
        neighbors(cur.q, cur.r).forEach(function (n) {
          var cell = self.cell(n.q, n.r);
          var cost = self.stepCost(u, cell);
          var occ = self.unitAt(n.q, n.r);
          if (occ && occ.side !== u.side) return;
          var nc = cur.c + cost;
          if (nc > mp) return;
          var k = idx(n.q, n.r);
          if (best[k] != null && best[k] <= nc) return;
          best[k] = nc;
          var stop = self.pinned(u, n.q, n.r) || self.terrain(cell) === 'river';
          open.push({ q: n.q, r: n.r, c: nc, stop: stop });
        });
      }
      Object.keys(best).forEach(function (k) {
        k = +k;
        if (k === start) return;
        var q = k % COLS, r = Math.floor(k / COLS);
        if (!self.unitAt(q, r)) out.push({ q: q, r: r, cost: best[k] });
      });
      return out;
    },

    // A hero with no men left fights on alone, worth one man for every 5 Body.
    fighters: function (u) { return u.men > 0 ? u.men : Math.floor(Math.max(0, this.hero(u).body) / 5); },
    // Fighting strength: men, weapons, drill and the hero. Terrain is applied where blows land.
    pw: function (u) {
      var st = this.stats[u.side];
      return W.unitPower(this.fighters(u), st.arms, st.skill, this.hero(u));
    },
    other: function (side) { return side === 'atk' ? 'def' : 'atk'; },
    say: function (text, kind) { this.log.push({ day: this.day, text: text, kind: kind || 'info' }); return text; },

    beginDay: function (first) {
      var rng = W.rng(this.s), self = this;
      var w = WEATHER[this.season], x = rng.next(), acc = 0;
      for (var i = 0; i < w.length; i++) { acc += w[i][1]; if (x <= acc) { this.weather = w[i][0]; break; } }
      if (!first && rng.chance(0.4)) this.wind = (this.wind + rng.pick([1, 5])) % 6;
      if (this.weather === 'Rain' || this.weather === 'Snow') {
        this.cells.forEach(function (c) {
          if (c.fire && rng.chance(self.weather === 'Snow' ? 0.9 : 0.75)) { c.fire = 0; c.burnt = true; }
        });
      }
      if (!first) this.burn();
      this.units.forEach(function (u) { u.acted = false; });
      // The defender always moves first.
      this.side = 'def';
      this.say('Day ' + this.day + ': ' + this.weather + '.', 'day');
    },
    burn: function () {
      var rng = W.rng(this.s), self = this, spread = [];
      this.cells.forEach(function (c, k) {
        if (!c.fire) return;
        var q = k % COLS, r = Math.floor(k / COLS);
        var u = self.unitAt(q, r);
        if (u) {
          var d = Math.max(1, Math.round(self.fighters(u) * rng.range(0.15, 0.25)));
          self.say(self.hero(u).name + '\'s unit is caught in the flames and loses ' + d + ' men.', 'fire');
          self.hurt(u, d, null);
        }
        neighbors(q, r).forEach(function (n) {
          var m = self.cell(n.q, n.r), t = self.terrain(m);
          var base = FLAMMABLE[t];
          if (!base || m.fire || m.burnt) return;
          var p = n.dir === self.wind ? base : (t === 'forest' ? 0.12 : 0.03);
          if (rng.chance(p)) spread.push(m);
        });
        c.fire--;
        if (!c.fire) c.burnt = true;
      });
      spread.forEach(function (m) { m.fire = 3; });
    },
    // At day's end the current may carry a hero in a river one or two hexes downstream (a steersman
    // only one, and less often). Swept off the field, the hero is out of the battle.
    sweep: function () {
      var rng = W.rng(this.s), self = this, path = this.river || [];
      this.live().forEach(function (u) {
        if (self.terrain(self.cell(u.q, u.r)) !== 'river') return;
        var h = self.hero(u);
        if (!rng.chance(h.steersman ? 0.25 : 0.5)) return;
        var at = -1;
        for (var i = 0; i < path.length; i++) if (path[i].q === u.q && path[i].r === u.r) at = i;
        var steps = h.steersman ? 1 : rng.int(1, 2), moved = false;
        for (var k = 0; k < steps; k++) {
          var next = path[at + 1];
          if (!next) {
            u.gone = 'swept';
            self.say(h.name + ' is swept off the battlefield by the current!', 'rout');
            return;
          }
          if (self.terrain(self.cell(next.q, next.r)) !== 'river' || self.unitAt(next.q, next.r)) break;
          u.q = next.q; u.r = next.r; at++; moved = true;
        }
        if (moved) self.say(h.name + ' is carried downstream.', 'move');
      });
    },

    // Casualties fall on the men first; a hero with none left takes the blows, 5 Body to a man.
    // A hero worn down to 0 Body cannot fight on, and is taken if attacked hand to hand.
    hurt: function (u, d, by) {
      var h = this.hero(u);
      if (h.body <= 0 && by && dist(by, u) === 1) { this.capture(u); return; }
      var onMen = Math.min(u.men, d);
      u.men -= onMen;
      h.body -= Math.round(onMen / u.men0 * 22) + (d - onMen) * 5;
      if (h.body <= 0) {
        h.body = 0;
        this.say(h.name + ' collapses, exhausted.', 'rout');
      }
    },
    capture: function (u) {
      var h = this.hero(u);
      u.gone = 'captured';
      u.men = 0;
      h.body = Math.max(h.body, 1);
      this.say(h.name + ' is captured!', 'capture');
    },
    // Melee and fire can sink a ship on a river or lake. A steersman may swim ashore; anyone else
    // is fished out by the enemy.
    sink: function (o) {
      var h = this.hero(o), self = this;
      if (o.gone || !h.ship || !this.water(this.cell(o.q, o.r)) || !W.rng(this.s).chance(0.25)) return;
      h.ship = false;
      this.say(h.name + '\'s ship goes down!', 'hit');
      var shore = neighbors(o.q, o.r).filter(function (n) {
        var c = self.cell(n.q, n.r);
        return !self.water(c) && self.passable(c) && !self.unitAt(n.q, n.r);
      })[0];
      if (h.steersman && shore) {
        o.q = shore.q; o.r = shore.r;
        this.say(h.name + ' swims ashore.', 'info');
      } else this.capture(o);
    },

    // --- Commands ---------------------------------------------------------------------------
    canMagic: function (u) {
      var h = this.hero(u);
      return h.wis >= 80 && h.body >= 50 && this.weather === 'Clouds';
    },
    magicRange: function (u) { return this.hero(u).wis >= 90 ? 3 : 2; },
    canArchery: function (u) { return this.hero(u).dex > 60; },
    canFireball: function (u) {
      return this.hero(u).wis >= 60 && this.weather !== 'Rain' && this.weather !== 'Snow';
    },
    canPutOut: function (u) { return this.hero(u).dex >= 40; },
    // Arrows fly exactly two hexes along one of the six hex lines, and never over a mountain.
    inVolley: function (u, o) {
      var a = cube(u.q, u.r), b = cube(o.q, o.r);
      var dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
      if (dist(u, o) !== 2 || (dx && dy && dz)) return false;
      var mx = a.x + dx / 2, mz = a.z + dz / 2;
      return this.terrain(this.cell(mx, mz + (mx - (mx & 1)) / 2)) !== 'mount';
    },
    // Season, terrain and the target's Wisdom decide whether a fireball takes.
    fireOdds: function (c, o) {
      var p = this.water(c) ? 0.5 : 0.3 + FLAMMABLE[this.terrain(c)] * 0.6;
      p += { Summer: 0.1, Autumn: 0.1, Winter: -0.15 }[this.season] || 0;
      if (o) p -= (this.hero(o).wis - 50) / 200;
      return BK.clamp(p, 0.1, 0.95);
    },
    // Heroes the defender can still call up: those waiting in the prefecture, and those who fled
    // within it at least a week ago.
    callable: function () {
      var self = this, out = [];
      if (this.live('def').length >= 10) return out;
      (this.reserve || []).forEach(function (cid) {
        var c = self.s.chars[cid];
        if (c.status === 'served' && c.loc === self.target && c.body > 10) out.push({ cid: cid, men: c.men });
      });
      this.units.forEach(function (x) {
        if (x.side === 'def' && x.gone === 'fled' && self.day - x.fledDay >= 7 && x.cid !== self.defLeader) out.push({ cid: x.cid, men: x.men, unit: x });
      });
      return out.sort(function (a, b) { return b.men - a.men; });
    },
    targets: function (u, cmd) {
      var self = this, out = [];
      if (cmd === 'melee' || cmd === 'duel') {
        neighbors(u.q, u.r).forEach(function (n) {
          var o = self.unitAt(n.q, n.r);
          if (o && o.side !== u.side) out.push({ q: o.q, r: o.r, unit: o });
        });
      } else if (cmd === 'archery') {
        if (!this.canArchery(u)) return out;
        this.live(this.other(u.side)).forEach(function (o) {
          if (self.inVolley(u, o)) out.push({ q: o.q, r: o.r, unit: o });
        });
      } else if (cmd === 'magic') {
        var range = this.magicRange(u);
        this.live(this.other(u.side)).forEach(function (o) {
          if (dist(u, o) <= range) out.push({ q: o.q, r: o.r, unit: o });
        });
      } else if (cmd === 'fireball') {
        neighbors(u.q, u.r).forEach(function (n) {
          var c = self.cell(n.q, n.r), o = self.unitAt(n.q, n.r);
          if (c.fire) return;
          if (FLAMMABLE[self.terrain(c)]) out.push({ q: n.q, r: n.r, unit: o && o.side !== u.side ? o : undefined });
          else if (o && o.side !== u.side && self.water(c)) out.push({ q: n.q, r: n.r, unit: o });
        });
      } else if (cmd === 'putout') {
        if (!this.canPutOut(u)) return out;
        [{ q: u.q, r: u.r }].concat(neighbors(u.q, u.r)).forEach(function (n) {
          if (self.cell(n.q, n.r).fire) out.push({ q: n.q, r: n.r });
        });
      } else if (cmd === 'reinforce') {
        if (u.side !== 'def' || !this.callable().length) return out;
        (this.defDeploy || []).forEach(function (p) {
          if (!self.unitAt(p.q, p.r) && self.passable(self.cell(p.q, p.r), true)) out.push({ q: p.q, r: p.r });
        });
      } else if (cmd === 'charge') {
        // A charge moves and strikes in one turn, so it covers half the ground of a march.
        var reach = this.reachable(u, Math.floor(MP / 2)).concat([{ q: u.q, r: u.r }]);
        this.live(this.other(u.side)).forEach(function (o) {
          var spot = reach.filter(function (p) { return dist(p, o) === 1; })[0];
          if (spot) out.push({ q: o.q, r: o.r, unit: o, from: spot });
        });
      }
      return out;
    },

    act: function (u, cmd, tq, tr) {
      if (this.over || u.gone || u.acted) return null;
      var rng = W.rng(this.s), h = this.hero(u), self = this, t, o, d;
      u.acted = true;
      if (u.confused > 0) {
        u.confused--;
        this.check();
        return this.say(h.name + '\'s troops are in confusion and cannot act.', 'info');
      }
      // A hero at 10 Body or less can do nothing but rest.
      if (h.body <= 10 && cmd !== 'rest') {
        this.say(h.name + ' is worn out and must rest.', 'info');
        cmd = 'rest';
      }
      switch (cmd) {
        case 'move':
          t = this.reachable(u).filter(function (p) { return p.q === tq && p.r === tr; })[0];
          if (!t) { u.acted = false; return null; }
          u.q = tq; u.r = tr;
          this.say(h.name + ' advances.', 'move');
          break;
        case 'charge':
          t = this.targets(u, 'charge').filter(function (p) { return p.q === tq && p.r === tr; })[0];
          if (!t) { u.acted = false; return null; }
          u.q = t.from.q; u.r = t.from.r;
          this.melee(u, t.unit, true);
          break;
        case 'melee':
          o = this.unitAt(tq, tr);
          if (!o || o.side === u.side || dist(u, o) !== 1) { u.acted = false; return null; }
          this.melee(u, o, false);
          break;
        case 'archery':
          o = this.unitAt(tq, tr);
          if (!o || o.side === u.side || !this.canArchery(u) || !this.inVolley(u, o)) { u.acted = false; return null; }
          var st = this.stats[u.side], oh = this.hero(o);
          // Good weapons let the archers loose more volleys.
          var volleys = 1 + (st.arms >= 50 ? 1 : 0) + (st.arms >= 85 ? 1 : 0);
          d = this.fighters(u) * (0.25 + h.dex / 200) * (0.6 + st.skill / 125) * 0.04 * volleys * rng.range(0.8, 1.2);
          d /= DEF[this.terrain(this.cell(o.q, o.r))] * 0.9;
          if (this.weather === 'Rain') d *= 0.5;
          if (this.weather === 'Snow') d *= 0.6;
          if (this.terrain(this.cell(o.q, o.r)) === 'forest') d *= 0.7;
          d = Math.max(1, Math.round(d));
          this.say(h.name + '\'s archers loose ' + volleys + (volleys > 1 ? ' volleys' : ' volley') + ': ' + oh.name + ' loses ' + d + ' men.', 'arrow');
          // A marksman of 85 Dexterity picks out the enemy hero too.
          if (h.dex >= 85 && oh.body > 0) {
            oh.body = Math.max(0, oh.body - Math.max(1, Math.round(d / 2)));
            this.say(oh.name + ' is struck by an arrow.', 'arrow');
          }
          this.hurt(o, d, u);
          break;
        case 'magic':
          o = this.unitAt(tq, tr);
          if (!o || o.side === u.side || !this.canMagic(u) || dist(u, o) > this.magicRange(u)) { u.acted = false; return null; }
          d = Math.min(this.fighters(o), Math.round(8 + h.wis * 0.28 + rng.int(0, 10)));
          this.say(h.name + ' calls down a storm of sorcery! ' + this.hero(o).name + ' loses ' + d + ' men.', 'magic');
          this.hero(o).body = Math.max(0, this.hero(o).body - rng.int(3, 8));
          if (rng.chance(0.5)) { o.confused = 1; this.say(this.hero(o).name + '\'s troops are dazzled and thrown into confusion.', 'magic'); }
          this.hurt(o, d, u);
          break;
        case 'fireball':
          t = this.targets(u, 'fireball').filter(function (p) { return p.q === tq && p.r === tr; })[0];
          if (!this.canFireball(u) || !t) { u.acted = false; return null; }
          var c = this.cell(tq, tr);
          o = this.unitAt(tq, tr);
          if (o && o.side === u.side) o = null;
          if (!rng.chance(this.fireOdds(c, o))) { this.say(h.name + '\'s fireball sputters out.', 'fire'); break; }
          if (!this.water(c)) c.fire = 3;
          this.say(h.name + ' hurls a fireball. ' + (this.water(c) ? 'Flames leap across the deck!' : 'The ground bursts into flame!'), 'fire');
          if (o) {
            d = Math.max(1, Math.round(this.fighters(o) * rng.range(0.15, 0.25)));
            this.say(this.hero(o).name + ' loses ' + d + ' men in the blaze.', 'fire');
            this.hurt(o, d, u);
            this.sink(o);
          }
          break;
        case 'putout':
          var pc = this.cell(tq, tr);
          if (!pc.fire || dist(u, { q: tq, r: tr }) > 1 || !this.canPutOut(u)) { u.acted = false; return null; }
          // Dexterity, weather and terrain decide whether the fire can be beaten out.
          var odds = 0.3 + (h.dex - 40) / 100 + ({ Rain: 0.3, Snow: 0.3, Clouds: 0.05 }[this.weather] || 0) -
            (this.terrain(pc) === 'forest' ? 0.2 : 0);
          if (rng.chance(BK.clamp(odds, 0.1, 0.95))) {
            pc.fire = 0; pc.burnt = true;
            this.say(h.name + '\'s men beat out the fire.', 'info');
          } else this.say(h.name + '\'s men cannot put out the fire.', 'fire');
          break;
        case 'reinforce':
          t = this.targets(u, 'reinforce').filter(function (p) { return p.q === tq && p.r === tr; })[0];
          var call = this.callable()[0];
          if (!t || !call) { u.acted = false; return null; }
          var nu = call.unit;
          if (nu) { nu.gone = null; nu.q = t.q; nu.r = t.r; nu.fledDay = null; }
          else {
            this.reserve = this.reserve.filter(function (x) { return x !== call.cid; });
            nu = this.addUnit(this.s.chars[call.cid], 'def', t);
          }
          nu.acted = true;
          this.say(this.s.chars[call.cid].name + ' comes to the defence with ' + nu.men + ' men.', 'move');
          break;
        case 'duel':
          o = this.unitAt(tq, tr);
          if (!o || o.side === u.side || dist(u, o) !== 1) { u.acted = false; return null; }
          this.duel(u, o);
          break;
        case 'view':
          // Looking over your own heroes is free; scouting the enemy takes the unit's turn.
          this.say(h.name + ' scouts the enemy lines.', 'info');
          break;
        case 'rest':
          // Resting helps only a hero below 40 Body, and only a little.
          if (h.body < 40) h.body = Math.min(h.bodyMax, h.body + 2);
          this.say(h.name + ' rests.', 'info');
          break;
        case 'flee':
          // Slipping away under the enemy's nose is risky.
          var near = this.live(this.other(u.side)).filter(function (x) { return dist(x, u) === 1; });
          var dex = Math.max.apply(null, [0].concat(near.map(function (x) { return self.hero(x).dex; })));
          if (near.length && rng.chance(BK.clamp(0.25 + (dex - h.dex) / 300, 0.05, 0.6))) {
            this.say(h.name + ' tries to flee but is cut off.', 'rout');
            this.capture(u);
            break;
          }
          u.gone = 'fled';
          u.fledDay = this.day;
          this.say(h.name + (u.side === 'def' ? ' slips away from the battlefield.' : ' flees the battlefield!'), 'rout');
          break;
        default:
          u.acted = false;
          return null;
      }
      if (TIRE[cmd] && !u.gone) h.body = Math.max(0, h.body - TIRE[cmd]);
      (LEARN[cmd] || []).forEach(function (l) { BK.Actions.gainExp(h, l[0], l[1]); });
      this.check();
      return true;
    },

    melee: function (u, o, charge) {
      var rng = W.rng(this.s);
      if (this.hero(o).body <= 0) {
        this.say(this.hero(u).name + ' falls on the exhausted ' + this.hero(o).name + '.', 'hit');
        this.capture(o);
        return;
      }
      var defMul = DEF[this.terrain(this.cell(o.q, o.r))];
      var dOut = this.pw(u) * 0.09 * rng.range(0.8, 1.2) / defMul;
      var dIn = this.pw(o) * 0.055 * rng.range(0.8, 1.2) / DEF[this.terrain(this.cell(u.q, u.r))];
      if (charge) { dOut *= 1.3; dIn *= 1.25; }
      dOut = Math.max(1, Math.round(dOut)); dIn = Math.max(1, Math.round(dIn));
      this.say(this.hero(u).name + (charge ? ' charges ' : ' attacks ') + this.hero(o).name + ': ' +
        dOut + ' enemy and ' + dIn + ' own men fall.', 'hit');
      this.hurt(o, dOut, u);
      if (!o.gone) this.hurt(u, dIn, o);
      this.sink(o);
    },

    duel: function (u, o) {
      var rng = W.rng(this.s), a = this.hero(u), b = this.hero(o);
      a.body = Math.max(0, a.body - 5);
      // A hero behind castle walls never comes out; anyone else answers as their Courage allows.
      if (this.terrain(this.cell(o.q, o.r)) === 'castle' || b.body <= 0 || !rng.chance(b.courage / 100 + 0.1)) {
        this.say(b.name + ' will not come out to face ' + a.name + '.', 'duel');
        return;
      }
      b.body = Math.max(1, b.body - 4);
      BK.Actions.gainExp(a, 'str', 15); BK.Actions.gainExp(a, 'dex', 15);
      BK.Actions.gainExp(b, 'str', 5); BK.Actions.gainExp(b, 'dex', 5);
      this.say(a.name + ' and ' + b.name + ' ride out to duel!', 'duel');
      // A hero with far more men has them crowd in and wear the other down first.
      var gap = u.men - o.men;
      if (Math.abs(gap) > 20) {
        var victim = gap > 0 ? b : a;
        victim.body = Math.max(1, victim.body - Math.min(15, Math.round(Math.abs(gap) / 6)));
        this.say((gap > 0 ? a : b).name + '\'s men crowd in and strike at ' + victim.name + '.', 'duel');
      }
      var hit = function (x) { return Math.max(1, Math.round((x.str * 0.55 + x.dex * 0.45) / 12 * rng.range(0.6, 1.4))); };
      for (var round = 0; round < 200 && a.body > 0 && b.body > 0; round++) {
        b.body -= hit(a);
        if (b.body <= 0) break;
        a.body -= hit(b);
      }
      var loser = a.body <= 0 ? u : o;
      var winner = loser === u ? o : u, lh = this.hero(loser), wh = this.hero(winner);
      BK.Actions.earn(this.s, this.factionOf(winner.side), 4);
      // Beating a stronger hero teaches the winner something at once.
      if (lh.str + lh.dex > wh.str + wh.dex) { wh.str = Math.min(100, wh.str + 1); wh.dex = Math.min(100, wh.dex + 1); }
      loser.gone = 'captured';
      loser.men = 0;
      lh.body = 1;
      this.say(wh.name + ' unhorses ' + lh.name + ' and takes ' + (lh.look && lh.look.sex === 'f' ? 'her' : 'him') + ' prisoner!', 'duel');
    },
    factionOf: function (side) { return side === 'atk' ? this.atkFid : this.defFid; },

    // Next unit that still has to act on the current side, or null.
    nextUnit: function () {
      var list = this.live(this.side).filter(function (u) { return !u.acted; });
      return list[0] || null;
    },
    // Advance past a finished side; returns 'side' when the attacker starts, 'day' on a new day.
    endSide: function () {
      if (this.over) return 'over';
      if (this.side === 'def') { this.side = 'atk'; return 'side'; }
      this.endDay();
      return this.over ? 'over' : 'day';
    },
    endDay: function () {
      var self = this;
      ['atk', 'def'].forEach(function (side) {
        var men = self.live(side).reduce(function (a, u) { return a + u.men; }, 0);
        self.food[side] -= Math.ceil(men / 10);
      });
      this.sweep();
      this.check(true);
      if (this.over) return;
      this.day++;
      if (this.day > 30) { this.finish('def', 'The month has ended and the defenders hold firm.'); return; }
      this.beginDay(false);
    },

    check: function (endOfDay) {
      if (this.over) return;
      var self = this;
      var lead = function (cid) { return self.units.filter(function (u) { return u.cid === cid; })[0]; };
      var al = lead(this.atkLeader), dl = lead(this.defLeader);
      if (!this.live('atk').length) return this.finish('def', 'The attackers have been driven off.');
      if (!this.live('def').length) return this.finish('atk', 'The defenders have been wiped out.');
      if (al && al.gone) return this.finish('def', 'The attacking commander ' + this.hero(al).name + ' is lost.');
      if (dl && dl.gone) return this.finish('atk', 'The defending commander ' + this.hero(dl).name + ' is lost.');
      if (endOfDay) {
        if (this.food.atk <= 0) return this.finish('def', 'The attackers have run out of food.');
        if (this.food.def <= 0) return this.finish('atk', 'The defenders are starving and surrender.');
        var held = this.castles.length && this.castles.every(function (c) {
          var u = self.unitAt(c.q, c.r);
          return u && u.side === 'atk';
        });
        if (held) return this.finish('atk', 'The attackers hold every castle.');
      }
    },
    finish: function (winner, reason) {
      this.over = true;
      this.result = { winner: winner, reason: reason, days: this.day };
      this.say(reason, 'end');
    },

    // --- Battle AI --------------------------------------------------------------------------
    aiAct: function (u) {
      if (this.over || u.gone || u.acted) return;
      this.aiChoose(u);
      // Whatever the plan, a unit that could not carry it out holds its ground.
      if (!this.over && !u.gone && !u.acted) this.act(u, 'rest');
    },
    aiChoose: function (u) {
      var self = this, h = this.hero(u), rng = W.rng(this.s);
      var foes = this.live(this.other(u.side));
      if (!foes.length || h.body <= 10) { this.act(u, 'rest'); return; }
      var leader = u.side === 'atk' ? this.atkLeader : this.defLeader;
      foes.sort(function (a, b) { return dist(u, a) - dist(u, b); });
      var near = foes[0], nd = dist(u, near);
      var adj = foes.filter(function (o) { return dist(u, o) === 1; });
      var arrows = function () {
        return self.targets(u, 'archery').sort(function (a, b) { return b.unit.men - a.unit.men; })[0];
      };

      if (u.men < u.men0 * 0.15 && h.courage < 60 && u.cid !== leader && nd <= 2) return this.act(u, 'flee');
      // A defender with room on the field calls up the heroes waiting in the prefecture.
      if (u.side === 'def' && !adj.length) {
        var call = this.targets(u, 'reinforce')[0];
        if (call) return this.act(u, 'reinforce', call.q, call.r);
      }
      var mine = this.cell(u.q, u.r);
      if (mine.fire) {
        var esc = this.reachable(u).filter(function (p) { return !self.cell(p.q, p.r).fire; });
        if (esc.length) { esc.sort(function (a, b) { return dist(a, near) - dist(b, near); }); return this.act(u, 'move', esc[0].q, esc[0].r); }
        if (this.canPutOut(u)) return this.act(u, 'putout', u.q, u.r);
      }
      if (this.canMagic(u)) {
        var mt = this.targets(u, 'magic').sort(function (a, b) { return b.unit.men - a.unit.men; })[0];
        if (mt && mt.unit.men > 15) return this.act(u, 'magic', mt.q, mt.r);
      }
      if (this.canFireball(u) && rng.chance(0.4)) {
        // Only when the wind will not blow the flames back onto our own lines.
        var ft = this.targets(u, 'fireball').filter(function (t) {
          if (!t.unit || t.unit.men <= 12) return false;
          var back = neighbors(t.q, t.r).filter(function (n) { return n.q === u.q && n.r === u.r; })[0];
          return (!back || back.dir !== self.wind) &&
            !neighbors(t.q, t.r).some(function (n) { var f = self.unitAt(n.q, n.r); return f && f !== u && f.side === u.side; });
        }).sort(function (a, b) { return b.unit.men - a.unit.men; })[0];
        if (ft) return this.act(u, 'fireball', ft.q, ft.r);
      }
      // Commanders keep out of the press: losing one loses the battle.
      if (u.cid === leader) {
        var threat = adj.reduce(function (a, o) { return a + self.pw(o); }, 0);
        if (adj.length && this.pw(u) < threat * 1.6) {
          var safe = this.reachable(u).filter(function (p) { return !foes.some(function (o) { return dist(o, p) <= 1; }); });
          if (safe.length) {
            safe.sort(function (a, b) {
              var ca = self.cell(a.q, a.r).t === 'castle', cb = self.cell(b.q, b.r).t === 'castle';
              return (cb - ca) || (Math.min.apply(null, foes.map(function (o) { return dist(o, b); })) -
                Math.min.apply(null, foes.map(function (o) { return dist(o, a); })));
            });
            return this.act(u, 'move', safe[0].q, safe[0].r);
          }
        }
        if (!adj.length) {
          var shot = arrows();
          if (shot) return this.act(u, 'archery', shot.q, shot.r);
          if (u.side === 'def' && mine.t === 'castle') return this.act(u, 'rest');
          var rear = this.reachable(u).filter(function (p) { return !foes.some(function (o) { return dist(o, p) <= 2; }); });
          if (u.side === 'def') {
            var keep = rear.filter(function (p) { return self.cell(p.q, p.r).t === 'castle'; });
            if (keep.length) return this.act(u, 'move', keep[0].q, keep[0].r);
            return this.act(u, 'rest');
          }
          // An attacking commander follows the army at a distance.
          var friends = this.live(u.side).filter(function (x) { return x !== u; });
          if (friends.length && nd > 3 && rear.length) {
            var lead = friends.sort(function (a, b) { return dist(a, near) - dist(b, near); })[0];
            rear.sort(function (a, b) { return dist(a, lead) - dist(b, lead); });
            if (dist(rear[0], near) >= 3) return this.act(u, 'move', rear[0].q, rear[0].r);
          }
          if (friends.length) return this.act(u, 'rest');
        }
      }
      if (adj.length) {
        var foeLead = u.side === 'atk' ? self.defLeader : self.atkLeader;
        adj.sort(function (a, b) {
          return (self.hero(b).body <= 0) - (self.hero(a).body <= 0) || (b.cid === foeLead) - (a.cid === foeLead) || a.men - b.men;
        });
        var foe = adj[0], fh = this.hero(foe);
        if (h.courage > 70 && (h.str + h.dex) - (fh.str + fh.dex) > 35 && h.body > 60 && fh.body > 0 &&
          this.cell(foe.q, foe.r).t !== 'castle' && rng.chance(0.35)) return this.act(u, 'duel', foe.q, foe.r);
        if (this.pw(u) < this.pw(foe) * 0.35 && h.dex >= 70) {
          var back = this.reachable(u).filter(function (p) { return !adj.some(function (o) { return dist(o, p) <= 1; }); });
          if (back.length && rng.chance(0.5)) return this.act(u, 'move', back[0].q, back[0].r);
        }
        return this.act(u, 'melee', foe.q, foe.r);
      }
      var volley = arrows();
      if (volley && rng.chance(0.75)) return this.act(u, 'archery', volley.q, volley.r);

      var goal = near;
      if (u.side === 'def') {
        // Hold the walls; sally out only against a clearly weaker enemy close by.
        var onCastle = mine.t === 'castle';
        var sally = nd <= 3 && this.pw(u) > this.pw(near) * 1.3;
        if (onCastle && !sally) return this.act(u, 'rest');
        var free = this.castles.filter(function (c) { return !self.unitAt(c.q, c.r); });
        if (!sally && free.length) goal = free.sort(function (a, b) { return dist(u, a) - dist(u, b); })[0];
        else if (!sally) {
          var nearCastle = this.castles.slice().sort(function (a, b) { return dist(u, a) - dist(u, b); })[0];
          if (nearCastle && dist(u, nearCastle) > 1) goal = nearCastle;
          else return this.act(u, 'rest');
        }
      } else {
        var defLeft = this.live('def').length;
        var openCastle = this.castles.filter(function (c) { var o = self.unitAt(c.q, c.r); return !o; });
        if (defLeft <= 2 && openCastle.length && rng.chance(0.4)) goal = openCastle[0];
      }
      var charge = this.targets(u, 'charge').filter(function (t) { return t.unit === near; })[0];
      if (charge && this.pw(u) > this.pw(near) * 1.2) return this.act(u, 'charge', near.q, near.r);
      var spots = this.reachable(u);
      if (!spots.length) return this.act(u, 'rest');
      spots.sort(function (a, b) {
        return (dist(a, goal) - dist(b, goal)) || (DEF[self.terrain(self.cell(b.q, b.r))] - DEF[self.terrain(self.cell(a.q, a.r))]);
      });
      if (dist(spots[0], goal) >= nd && u.side === 'def') return this.act(u, 'rest');
      return this.act(u, 'move', spots[0].q, spots[0].r);
    },

    // Play out the whole battle with the AI on both sides.
    autoResolve: function () {
      var guard = 0;
      while (!this.over && guard++ < 3000) {
        var u = this.nextUnit();
        if (u) this.aiAct(u);
        else this.endSide();
      }
      if (!this.over) this.finish('def', 'The battle peters out.');
      return this.result;
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = BK.Battle;
})(typeof window !== 'undefined' ? window : globalThis);
