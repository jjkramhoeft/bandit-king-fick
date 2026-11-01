/* The calendar: start-of-month events (taxes, seasons, disasters, arrivals, the Edict) and
   end-of-month upkeep. Functions mutate the state and return event records for the UI. */
(function (root) {
  'use strict';
  var BK = root.BK = root.BK || {};
  var W = BK.World;

  function ev(kind, text, o) {
    var e = { kind: kind, text: text };
    if (o) for (var k in o) e[k] = o[k];
    return e;
  }

  function cap(p) {
    p.gold = BK.clamp(Math.round(p.gold), 0, 9999);
    p.food = BK.clamp(Math.round(p.food), 0, 9999);
    p.metal = BK.clamp(Math.round(p.metal), 0, 999);
    p.fur = BK.clamp(Math.round(p.fur), 0, 999);
    ['arms', 'skill', 'support', 'flood', 'land', 'wealth'].forEach(function (k) {
      p[k] = BK.clamp(Math.round(p[k]), 0, 100);
    });
  }

  function loseMen(s, prefId, frac) {
    var lost = 0;
    W.heroesAt(s, prefId).forEach(function (c) {
      var d = Math.round(c.men * frac);
      c.men -= d;
      lost += d;
    });
    return lost;
  }

  function isNorth(prefId) { return BK.MapData.prefById(prefId).lat > 34.2; }

  BK.Econ = {
    cap: cap,
    loseMen: loseMen,

    riot: function (s, p) {
      var gone = loseMen(s, p.id, 0.1);
      p.gold *= 0.9; p.support -= 2;
      cap(p);
      return 'Riots break out in ' + p.name + '. ' + gone + ' soldiers desert.';
    },

    monthStart: function (s) {
      var rng = W.rng(s), out = [];
      var season = W.season(s), m = s.month;

      s.prefs.forEach(function (p) { p.snowbound = false; });

      if (s.year >= s.endYear) {
        out.push(ev('invasion', 'The Northern Barbarians pour across the frontier. The Song empire falls, and the ' +
          'heroes of the marsh have run out of time.', { scene: 'defeat' }));
        return out;
      }

      if (m === 1) out = out.concat(this.january(s));

      if (m === 3 || m === 6 || m === 9 || m === 12) {
        out.push(ev('season', season + ' has come.', { scene: 'idle', global: true }));
        s.prefs.forEach(function (p) {
          p.beasts = rng.chance(0.07) ? rng.pick(['bears', 'tigers', 'leopards', 'wolves']) : false;
          if (p.beasts) out.push(ev('beasts', 'Wild ' + p.beasts + ' are terrorising the people of ' + p.name + '.', { pref: p.id, scene: 'beast' }));
          if ((m === 3 || m === 9) && p.support >= 40 && rng.chance(0.3)) {
            p.support += 4; p.wealth += 2;
            out.push(ev('festival', 'A festival is held in ' + p.name + '. The people are in good spirits.', { pref: p.id, scene: 'festival' }));
          }
          cap(p);
        });
        out = out.concat(this.arrivals(s));
      }

      s.prefs.forEach(function (p) {
        if (season === 'Winter' && rng.chance(isNorth(p.id) ? 0.2 : 0.05)) {
          p.snowbound = true;
          p.land -= 2; p.support -= 2; p.rate += 3;
          out.push(ev('snow', 'A snowstorm buries the roads of ' + p.name + '. No armies can march there this month.', { pref: p.id, scene: 'snow' }));
        }
        var t = BK.MapGeo.build().terrain[p.id];
        if (season === 'Summer' && (t.coast || t.river >= 2) && rng.chance(0.06)) {
          p.food *= 0.85; p.land -= 4; p.flood -= 3; p.rate += 4;
          var txt = 'A typhoon strikes ' + p.name + '.';
          if (p.flood < 50) {
            p.wealth -= 4; p.support -= 3;
            var lost = loseMen(s, p.id, 0.08);
            txt += ' The weak dikes give way' + (lost ? ' and ' + lost + ' soldiers are lost.' : '.');
          } else txt += ' The dikes hold.';
          out.push(ev('typhoon', txt, { pref: p.id, scene: 'typhoon' }));
        }
        if (rng.chance(0.015)) {
          var dead = loseMen(s, p.id, 0.12);
          p.support -= 4; p.wealth -= 3; p.rate += 3;
          W.heroesAt(s, p.id).forEach(function (c) { c.body = Math.max(5, c.body - 8); });
          out.push(ev('epidemic', 'An epidemic sweeps through ' + p.name + '.' + (dead ? ' ' + dead + ' soldiers die.' : ''), { pref: p.id, scene: 'epidemic' }));
        }
        var riot = p.support < 40 ? 0.08 : (p.support <= 55 ? 0.035 : 0);
        if (p.owner != null && riot && rng.chance(riot)) {
          var owner = W.faction(s, p.owner);
          // A player is offered the chance to buy the crowd off with gold.
          if (owner && owner.human) {
            out.push(ev('riotThreat', 'Angry crowds gather in the streets of ' + p.name + '.', { pref: p.id, scene: 'riot', cost: Math.max(20, Math.round(p.gold * 0.1)) }));
          } else out.push(ev('riot', BK.Econ.riot(s, p), { pref: p.id, scene: 'riot' }));
        }
        cap(p);
      });

      out = out.concat(this.gaoQiu(s));
      return out;
    },

    january: function (s) {
      var out = [], rng = W.rng(s);
      s.prefs.forEach(function (p) {
        if (p.owner == null) return;
        if (p.support >= 40) {
          var k = 0.5 + p.support / 100;
          var g = Math.round((p.wealth * 6 + p.land * 2 + 40) * k);
          var f = Math.round((p.land * 14 + p.flood * 4 + 60) * k);
          if (p.owner === s.imperial) { g = Math.round(g * 1.2); f = Math.round(f * 1.2); }
          var owner = W.faction(s, p.owner), dif = BK.Setup.DIFFICULTY[s.difficulty || 'normal'];
          if (owner && owner.kind === 'goodfellow') {
            var k2 = owner.human ? dif.tax : dif.rivalTax;
            g = Math.round(g * k2); f = Math.round(f * k2);
          }
          p.gold += g; p.food += f;
          out.push(ev('tax', p.name + ' collects ' + g + ' gold and ' + f + ' food in taxes.', { pref: p.id, quiet: true }));
          if (p.support >= 60) BK.Actions.earn(s, p.owner, 3);
        } else {
          out.push(ev('tax', 'The people of ' + p.name + ' refuse to pay taxes. (Support below 40)', { pref: p.id, quiet: true }));
        }
        // Depreciation: the year wears down drill, weapons, dikes, fields, trade and goodwill.
        ['arms', 'skill', 'flood', 'land', 'wealth'].forEach(function (k) { p[k] -= rng.int(1, 4); });
        p.support -= rng.int(1, 3);
        cap(p);
      });

      // Unrest: followers grow restless, more so under a leader unlike themselves.
      s.chars.forEach(function (c) {
        if (c.status !== 'served' || c.brother) return;
        var f = W.faction(s, c.faction);
        if (!f || f.leader === c.id) return;
        c.loyalty = Math.max(0, c.loyalty - Math.round((1.3 - BK.Actions.compat(s, c)) * 4));
      });

      // Treaties run for three years.
      s.factions.forEach(function (f) {
        f.treaties.slice().forEach(function (o) {
          var end = f.treatyEnd && f.treatyEnd[o];
          if (end == null || s.year < end) return;
          f.treaties = f.treaties.filter(function (x) { return x !== o; });
          if (f.alive && s.factions[o].alive) {
            out.push(ev('treaty', s.chars[f.leader].name + '\'s treaty with ' + s.chars[s.factions[o].leader].name + ' has expired.',
              { faction: f.id, scene: 'treaty' }));
          }
        });
      });

      // The empire levies fresh troops for its loyal governors, until an Edict turns the court
      // against Gao Qiu and the capital's purse is closed to him.
      var anyEdict = s.factions.some(function (f) { return f.edict; });
      W.factionHeroes(s, s.imperial).forEach(function (c) {
        if (anyEdict && c.loc === BK.MapData.capital) return;
        c.men = Math.min(W.menCap(c), Math.round(c.men * 1.06 + 3));
      });

      // Each January the Emperor looks for a champion.
      s.factions.forEach(function (f) {
        if (f.kind !== 'goodfellow' || !f.alive || f.edict) return;
        if (W.popularity(s, f.id) >= 250) {
          f.edict = true;
          var name = s.chars[f.leader].name;
          W.log(s, name + ' receives the Imperial Edict.');
          // Word of the Edict spreads through the capital and Gao Qiu's soldiers slip away.
          var cap = W.pref(s, BK.MapData.capital), deserted = 0;
          if (cap.owner === s.imperial) {
            W.heroesAt(s, cap.id).forEach(function (c) { var d = Math.round(c.men * 0.3); c.men -= d; deserted += d; });
            cap.arms = Math.max(30, cap.arms - 10);
            cap.skill = Math.max(30, cap.skill - 10);
            cap.support = Math.max(0, cap.support - 15);
          }
          out.push(ev('edict', 'Emperor Huizong has heard of ' + name + '\'s virtue. He grants the Imperial Edict: ' +
            name + ' may now march on Gao Qiu\'s home prefecture.' +
            (deserted ? ' In Kaifeng, ' + deserted + ' of Gao Qiu\'s soldiers desert at the news.' : ''),
            { faction: f.id, global: true, scene: 'edict', music: 'edict' }));
        }
      });
      if (rng.chance(0.5)) {
        out.push(ev('news', 'Emperor Huizong paints birds and flowers while Gao Qiu rules the court.', { global: true, quiet: true }));
      }
      return out;
    },

    // Townspeople drift between prefectures at the turn of each season; some ask to join.
    arrivals: function (s) {
      var out = [], rng = W.rng(s);
      s.chars.forEach(function (c) {
        if (c.status !== 'free' || !rng.chance(0.25)) return;
        var nb = W.neighbors(c.loc);
        c.loc = rng.pick(nb);
        var p = W.pref(s, c.loc), f = W.faction(s, p.owner);
        if (f && f.kind === 'goodfellow' && W.heroesAt(s, p.id).length < p.castles * 5) {
          var want = 0.15 + W.popularity(s, f.id) / 1200 + (c.int + c.mercy) / 1000;
          if (rng.chance(want)) out.push(ev('arrival', c.name + ', a ' + (c.cls || 'traveller').toLowerCase() +
            ', has arrived in ' + p.name + ' and wishes to join ' + s.chars[f.leader].name + '.',
            { pref: p.id, faction: f.id, char: c.id, scene: 'travel' }));
        }
      });
      return out;
    },

    // Gao Qiu squeezes rebels for silver and arms the governors who face them.
    gaoQiu: function (s) {
      var out = [], rng = W.rng(s), imp = s.imperial;
      var edict = s.factions.some(function (f) { return f.edict; });
      s.prefs.forEach(function (p) {
        if (p.owner !== imp) return;
        if (edict && p.id === BK.MapData.capital) return;
        W.neighbors(p.id).forEach(function (n) {
          var q = W.pref(s, n), f = W.faction(s, q.owner);
          if (!f || f.kind !== 'goodfellow' || q.support < 40) return;
          if (q.arms > p.arms) p.arms += Math.min(2, q.arms - p.arms);
          if (q.skill > p.skill) p.skill += Math.min(2, q.skill - p.skill);
        });
      });
      s.gaoDemandCooldown = (s.gaoDemandCooldown || 0) - 1;
      if (s.gaoDemandCooldown <= 0 && s.month !== 1 && rng.chance(0.12)) {
        var targets = s.prefs.filter(function (p) {
          var f = W.faction(s, p.owner);
          return f && f.kind === 'goodfellow' && p.gold >= 100 && W.neighbors(p.id).some(function (n) { return W.pref(s, n).owner === imp; });
        });
        if (targets.length) {
          var t = rng.pick(targets);
          var amount = Math.round(t.gold * rng.range(0.25, 0.34));
          s.gaoDemandCooldown = rng.int(5, 10);
          out.push(ev('demand', 'An envoy of Gao Qiu arrives in ' + t.name + ' demanding ' + amount + ' gold "for the Emperor".',
            { pref: t.id, faction: t.owner, amount: amount, scene: 'edict' }));
        }
      }
      return out;
    },

    monthEnd: function (s) {
      var out = [], rng = W.rng(s);
      s.prefs.forEach(function (p) {
        if (p.owner != null) {
          var men = W.menAt(s, p.id);
          var eat = Math.ceil(men * 2 / 3);
          if (p.food >= eat) p.food -= eat;
          else {
            var short = (eat - p.food) / Math.max(1, eat);
            p.food = 0;
            var lost = loseMen(s, p.id, Math.min(0.5, short * 0.4 + 0.05));
            p.support -= 3;
            if (lost) out.push(ev('hunger', 'Food has run out in ' + p.name + '. ' + lost + ' soldiers desert.', { pref: p.id, scene: 'defeat' }));
          }
        }
        if (p.owner != null) {
          // Every follower draws a little pay; unpaid ones grumble.
          var paid = W.heroesAt(s, p.id).filter(function (c) { return W.faction(s, c.faction).leader !== c.id; });
          if (p.gold >= paid.length) p.gold -= paid.length;
          else paid.forEach(function (c) { if (!c.brother) c.loyalty = Math.max(0, c.loyalty - 1); });
        }
        if (p.beasts) { p.food *= 0.97; p.support -= 1; }
        p.rate += rng.int(-6, 6) + Math.round((50 - p.rate) * 0.15);
        p.rate = BK.clamp(p.rate, 20, 100);
        cap(p);
      });

      s.chars.forEach(function (c) {
        if (c.status === 'dead') return;
        c.body = Math.min(c.bodyMax, c.body + 5);
        if (c.status === 'served') {
          var f = W.faction(s, c.faction);
          if (f && f.leader !== c.id && c.loyalty < 25 && rng.chance(0.06)) {
            BK.Actions.release(s, c);
            out.push(ev('desert', c.name + ' has lost faith in ' + s.chars[f.leader].name + ' and left.', { faction: f.id, pref: c.loc }));
          }
        } else if (c.status === 'prisoner' && rng.chance(0.04)) {
          BK.Actions.release(s, c);
          out.push(ev('escape', c.name + ' has escaped from prison.', { pref: c.loc, quiet: true }));
        }
      });
      return out;
    },

    advance: function (s) {
      s.month++;
      if (s.month > 12) { s.month = 1; s.year++; }
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = BK.Econ;
})(typeof window !== 'undefined' ? window : globalThis);
