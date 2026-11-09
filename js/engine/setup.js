/* Creates a new game state from a scenario and the players' choice of Good Fellows. */
(function (root) {
  'use strict';
  var BK = root.BK = root.BK || {};
  var W = BK.World;

  var MAX_CHARS = 255;

  // Stats for a named character are rolled from its own seed, so each hero is the same in every game.
  function rollStats(def) {
    var r = new BK.Rng(BK.hash('stats:' + def.key));
    var ranges = BK.Heroes.ARCH[def.arch];
    var out = {};
    BK.Heroes.STATS.forEach(function (k, i) { out[k] = r.int(ranges[i][0], ranges[i][1]); });
    for (var k in def.fix) if (k !== 'pop') out[k] = def.fix[k];
    out.pop = def.fix.pop != null ? def.fix.pop : r.int(4, 28);
    return out;
  }

  function newChar(s, o) {
    var c = {
      id: s.chars.length, key: o.key || ('gen' + s.chars.length), name: o.name, nick: o.nick || '',
      arch: o.arch, role: o.role || 'townsperson', look: o.look || {}, cls: o.cls || '',
      body: o.body, bodyMax: o.body, str: o.str, dex: o.dex, wis: o.wis, int: o.int,
      mercy: o.mercy, courage: o.courage, popEarned: o.pop || 0, loyalty: 0, men: 0,
      steersman: !!o.steersman || o.arch === 'sailor', status: 'free', faction: null, loc: 0,
      brother: false, pos: 1, gold: 0, captor: null, ship: !!o.steersman || o.arch === 'sailor', exp: { body: 0, str: 0, dex: 0, wis: 0 }
    };
    s.chars.push(c);
    return c;
  }

  function usedNames(s) {
    var set = {};
    s.chars.forEach(function (c) { set[c.name] = true; });
    BK.Heroes.list.forEach(function (h) { set[h.name] = true; });
    return set;
  }

  function genName(s, rng, used) {
    for (var tries = 0; tries < 200; tries++) {
      var g = rng.pick(BK.Heroes.GIVEN);
      if (rng.chance(0.35)) g += rng.pick(BK.Heroes.GIVEN).toLowerCase();
      var n = rng.pick(BK.Heroes.SURNAMES) + ' ' + g;
      if (!used[n]) { used[n] = true; return n; }
    }
    return 'Nameless ' + s.chars.length;
  }

  function genChar(s, rng, used, arch, role, cls) {
    var ranges = BK.Heroes.ARCH[arch];
    var o = { name: genName(s, rng, used), arch: arch, role: role, cls: cls };
    BK.Heroes.STATS.forEach(function (k, i) { o[k] = rng.int(ranges[i][0], ranges[i][1]); });
    o.pop = role === 'official' ? rng.int(0, 8) : rng.int(0, 15);
    if (role === 'official' && arch === 'officer') o.look = { hair: 'helmet' };
    if (role === 'official' && arch === 'official') o.look = { hair: 'official' };
    if (role === 'townsperson' && rng.chance(0.18)) o.look = { sex: 'f', hair: 'bun' };
    return newChar(s, o);
  }

  function serve(c, fid, prefId, men, pos, loyalty) {
    c.status = 'served';
    c.faction = fid;
    c.loc = prefId;
    c.men = men;
    c.pos = pos;
    c.loyalty = loyalty;
  }

  function makePref(def, rng, boost) {
    var tags = def.tags, rich = tags.indexOf('rich') >= 0, capital = tags.indexOf('capital') >= 0;
    var t = BK.MapGeo.build().terrain[def.id];
    var south = def.area === 'south';
    var p = {
      id: def.id, name: def.name, owner: null, ruler: null,
      gold: rng.int(150, 600) + (rich ? 400 : 0),
      food: rng.int(500, 1400) + (rich ? 700 : 0),
      metal: rng.int(0, 50) + (t.hills * 8),
      fur: rng.int(0, 30) + (def.area === 'north' || def.area === 'west' ? 25 : 0),
      rate: rng.int(42, 58),
      arms: rng.int(20, 45), skill: rng.int(20, 45),
      castles: BK.clamp(rng.int(1, 3) + (rich ? 1 : 0) + (tags.indexOf('border') >= 0 ? 1 : 0), 1, 7),
      support: rng.int(42, 66),
      flood: rng.int(20, 60) - (t.river >= 2 ? 10 : 0),
      land: rng.int(22, 58) + (south ? 10 : 0),
      wealth: rng.int(20, 55) + (rich ? 20 : 0),
      ships: 0,
      shipyard: (t.coast || t.river >= 2 || t.lake) && rng.chance(0.55),
      smithy: rng.chance(0.35) || t.hills >= 3,
      beasts: false, snowbound: false, orders: 'develop'
    };
    if (capital) {
      p.gold = 3000; p.food = 5000; p.castles = 6; p.arms = 70 + boost * 4; p.skill = 70 + boost * 4;
      p.support = 30; p.wealth = 85; p.land = 70; p.flood = 70; p.smithy = true;
    }
    p.flood = BK.clamp(p.flood, 5, 100);
    p.land = BK.clamp(p.land, 5, 100);
    p.wealth = BK.clamp(p.wealth, 5, 100);
    return p;
  }

  // Land nobody rules is poor: empty granaries, no drilled soldiers or weapons, neglected dikes and
  // fields, and a people too wary to pay taxes until a new ruler wins them over.
  function makeWild(p, rng) {
    p.gold = rng.int(0, 30);
    p.food = rng.int(0, 60);
    p.metal = 0;
    p.fur = rng.int(0, 10);
    p.arms = 0;
    p.skill = 0;
    p.support = rng.int(10, 30);
    p.flood = BK.clamp(Math.round(p.flood / 2), 10, 35);
    p.land = BK.clamp(Math.round(p.land / 2), 10, 35);
    p.wealth = BK.clamp(Math.round(p.wealth / 2), 10, 35);
    p.castles = rng.int(1, 2);
    p.orders = 'develop';
  }

  BK.Setup = {
    MAX_CHARS: MAX_CHARS,
    // empire: size of imperial garrisons; tax: human players' tax yield; caution: extra edge the
    // computer wants before attacking a human player.
    // rivalTax and rivalCaution do the same for computer-run Good Fellows racing the player.
    DIFFICULTY: {
      easy: { label: 'Easy', empire: 0.8, tax: 1.25, caution: 0.3, rivalTax: 0.85, rivalCaution: 0.2 },
      normal: { label: 'Normal', empire: 1, tax: 1, caution: 0, rivalTax: 1, rivalCaution: 0 },
      hard: { label: 'Hard', empire: 1.15, tax: 0.9, caution: -0.15, rivalTax: 1.1, rivalCaution: -0.1 }
    },

    // opts: { scenarioId, seed, players: [{ key: 'Lu Zhishen', name: 'Player 1', stats: {body,str,dex,wis} }] }
    newGame: function (opts) {
      var sc = BK.Scenarios[opts.scenarioId - 1];
      var seed = opts.seed >>> 0 || (Date.now() >>> 0);
      var s = {
        v: 2, seed: seed, scenarioId: sc.id, year: sc.year, month: 1, endYear: 1127,
        difficulty: BK.Setup.DIFFICULTY[opts.difficulty] ? opts.difficulty : 'normal',
        prefs: [], chars: [], factions: [], players: [], log: [],
        imperial: 0, over: false, winner: null, phase: 'monthStart', queue: [], qi: 0,
        gaoDemandCooldown: 6
      };
      var rng = W.rng(s);
      var used = {};
      BK.Heroes.list.forEach(function (h) { used[h.name] = true; });

      BK.MapData.prefs.forEach(function (d) { s.prefs.push(makePref(d, rng, sc.imperialBoost)); });

      var byKey = {};
      BK.Heroes.list.forEach(function (def) {
        var st = rollStats(def);
        var c = newChar(s, {
          key: def.key, name: def.name, nick: def.nick, arch: def.arch, role: def.role, look: def.look,
          cls: BK.Heroes.CLASS_FOR_ARCH[def.arch], steersman: def.steersman,
          body: st.body, str: st.str, dex: st.dex, wis: st.wis, int: st.int, mercy: st.mercy,
          courage: st.courage, pop: st.pop
        });
        byKey[def.key] = c;
      });

      function addFaction(kind, leader, color) {
        var f = {
          id: s.factions.length, kind: kind, leader: leader.id, color: color, human: false, player: -1,
          alive: true, edict: false, treaties: [], exileAt: 0
        };
        s.factions.push(f);
        return f;
      }
      function claim(prefId, f, ruler) {
        var p = W.pref(s, prefId);
        p.owner = f.id;
        p.ruler = ruler.id;
      }

      // Imperial court.
      var gao = byKey['Gao Qiu'];
      var imp = addFaction('imperial', gao, BK.C.red);
      s.imperial = imp.id;
      var boost = sc.imperialBoost;

      // The prefectures Gao Qiu's court governs. Every other prefecture nobody claims below starts
      // as wild land with no ruler, waiting for a band to settle it.
      var empire = sc.empire || [];

      // Good Fellows.
      var gfColor = {};
      BK.Heroes.GOOD_FELLOWS.forEach(function (g) { gfColor[g.key] = g.color; });
      Object.keys(sc.goodFellows).forEach(function (key) {
        var cfg = sc.goodFellows[key], c = byKey[key];
        var f = addFaction('goodfellow', c, gfColor[key]);
        if (sc.pop != null) c.popEarned = sc.pop;
        if (cfg.exile) {
          // An exile starts lean: no soldiers and only a few coins.
          f.exileAt = cfg.pref;
          serve(c, f.id, cfg.pref, 0, 5, 100);
          c.gold = 10;
        } else {
          claim(cfg.pref, f, c);
          serve(c, f.id, cfg.pref, rng.int(60, 85), 5, 100);
          var p = W.pref(s, cfg.pref);
          p.support = rng.int(58, 72);
          p.orders = 'develop';
        }
        cfg.followers.forEach(function (fk) {
          var h = byKey[fk];
          serve(h, f.id, cfg.pref, cfg.exile ? 0 : rng.int(25, 55),
            h.arch === 'general' ? 3 : 2, rng.int(76, 95));
        });
      });

      // Rebel kings.
      Object.keys(sc.bosses).forEach(function (key) {
        var cfg = sc.bosses[key], c = byKey[key];
        var f = addFaction('boss', c, BK.C.lightGrey);
        claim(cfg.pref, f, c);
        serve(c, f.id, cfg.pref, rng.int(80, 100), 5, 100);
        var p = W.pref(s, cfg.pref);
        p.arms = rng.int(40, 60); p.skill = rng.int(40, 60); p.orders = 'develop';
        (cfg.followers || []).forEach(function (fk) {
          serve(byKey[fk], f.id, cfg.pref, rng.int(25, 55), 2, rng.int(60, 85));
        });
        var extra = cfg.followers && cfg.followers.length ? 1 : 2;
        for (var i = 0; i < extra; i++) {
          serve(genChar(s, rng, used, rng.chance(0.5) ? 'officer' : 'brawler', 'townsperson', 'Outlaw'),
            f.id, cfg.pref, rng.int(35, 60), 2, rng.int(60, 85));
        }
      });

      // Local strongmen who answer to nobody.
      (sc.locals || []).forEach(function (prefId) {
        var ruler = genChar(s, rng, used, rng.pick(['officer', 'noble', 'brawler']), 'townsperson', 'Squire');
        var f = addFaction('local', ruler, BK.C.tan);
        claim(prefId, f, ruler);
        serve(ruler, f.id, prefId, rng.int(40, 65), 4, 100);
        serve(genChar(s, rng, used, 'officer', 'townsperson', 'Soldier'), f.id, prefId, rng.int(25, 45), 1, rng.int(55, 80));
      });

      // Named officials, then generic governors for every empire prefecture still unclaimed.
      var dif = BK.Setup.DIFFICULTY[s.difficulty];
      var impMen = function (lo, hi) { return Math.min(W.MEN_MAX, Math.round(rng.int(lo, hi) * (1 + boost * 0.12) * dif.empire)); };
      Object.keys(sc.imperial).forEach(function (key) {
        var prefId = sc.imperial[key], c = byKey[key], p = W.pref(s, prefId);
        var isGao = key === 'Gao Qiu';
        if (empire.indexOf(prefId) < 0) return;
        if (p.owner == null) claim(prefId, imp, c);
        else if (p.owner !== imp.id) return;
        if (isGao) serve(c, imp.id, prefId, impMen(95, 100), 5, 100);
        else if (c.arch === 'officer') serve(c, imp.id, prefId, impMen(80, 100), 3, rng.int(55, 80));
        else serve(c, imp.id, prefId, impMen(45, 70), 4, rng.int(60, 85));
      });
      W.pref(s, BK.MapData.capital).ruler = gao.id;
      s.prefs.forEach(function (p) {
        if (p.owner == null && empire.indexOf(p.id) >= 0) {
          var gov = genChar(s, rng, used, 'official', 'official', 'Official');
          claim(p.id, imp, gov);
          serve(gov, imp.id, p.id, impMen(40, 65), 3, rng.int(50, 80));
        }
        if (p.owner === imp.id) {
          p.arms = BK.clamp(p.arms + 8 + boost * 5, 0, 100);
          p.skill = BK.clamp(p.skill + 8 + boost * 5, 0, 100);
          p.support = BK.clamp(p.support - 10, 15, 100);
          p.orders = 'develop';
          var have = W.heroesAt(s, p.id).length;
          // The capital keeps a guard of officers besides its named generals.
          var want = p.id === BK.MapData.capital ? have + 3 : rng.int(1, 2);
          for (var i = have; i < want + 1; i++) {
            serve(genChar(s, rng, used, 'officer', 'official', 'Officer'), imp.id, p.id,
              p.id === BK.MapData.capital ? impMen(70, 100) : impMen(30, 60), 2, rng.int(40, 75));
          }
        }
      });

      s.prefs.forEach(function (p) { if (p.owner == null) makeWild(p, rng); });

      // Everyone not yet placed becomes a townsperson: named friends where the scenario puts them,
      // the rest somewhere in the empire.
      var townsfolk = sc.townsfolk || {};
      s.chars.forEach(function (c) {
        if (c.status === 'free' && c.loc === 0) c.loc = townsfolk[c.key] || rng.int(1, s.prefs.length);
      });
      while (s.chars.length < MAX_CHARS) {
        var cls = rng.pick(BK.Heroes.TOWN_CLASS);
        var t = genChar(s, rng, used, BK.Heroes.ARCH_FOR_CLASS[cls], 'townsperson', cls);
        t.loc = rng.int(1, s.prefs.length);
      }

      // Players.
      (opts.players || []).forEach(function (pl, i) {
        var c = byKey[pl.key];
        var f = s.factions.filter(function (x) { return x.leader === c.id; })[0];
        if (!f) return;
        f.human = true;
        f.player = i;
        if (pl.stats) {
          ['body', 'str', 'dex', 'wis'].forEach(function (k) { if (pl.stats[k] != null) c[k] = pl.stats[k]; });
          c.bodyMax = c.body;
        }
        s.players.push({ name: pl.name || ('Player ' + (i + 1)), faction: f.id, alive: true });
      });

      W.log(s, 'Scenario ' + sc.id + ': ' + sc.title + '.');
      return s;
    },

    // The range a player may roll for their Good Fellow's four abilities on the setup screen.
    statLimits: function (key) {
      var def = BK.Heroes.byKey(key);
      var base = rollStats(def);
      var lim = {};
      ['body', 'str', 'dex', 'wis'].forEach(function (k) {
        lim[k] = { lo: BK.clamp(base[k] - 12, 10, 100), hi: BK.clamp(base[k] + 6, 10, 100), base: base[k] };
      });
      lim.fixed = { int: base.int, mercy: base.mercy, courage: base.courage };
      return lim;
    },
    rollStats: rollStats
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = BK.Setup;
})(typeof window !== 'undefined' ? window : globalThis);
