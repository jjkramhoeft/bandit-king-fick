/* Computer-controlled prefectures and exile bands. decide() applies peaceful actions at once and
   returns a war plan when it wants to attack, so the game loop can run the battle. */
(function (root) {
  'use strict';
  var BK = root.BK = root.BK || {};
  var W = BK.World, A = BK.Actions;

  function best(list, score) {
    var top = null, ts = -Infinity;
    list.forEach(function (x) { var v = score(x); if (v > ts) { ts = v; top = x; } });
    return top;
  }

  // How eager a prefecture is to fight, from its faction and standing orders.
  function aggression(s, p, f) {
    if (f.kind === 'local') return 0;
    // Gao Qiu's governors sit tight: they squeeze tribute and only strike at easy prey. The
    // capital's guard never leaves Kaifeng.
    if (f.kind === 'imperial') return p.id === BK.MapData.capital ? 0 : 0.05;
    if (f.kind === 'boss') return 0.15;
    if (f.human) return { develop: 0, expand: 0.7, entrust: 0.35 }[p.orders] || 0;
    return W.isDirect(s, p.id) ? 0.55 : ({ develop: 0.15, expand: 0.6, entrust: 0.45 }[p.orders] || 0.4);
  }

  function threshold(s, f, p) {
    if (f.kind === 'imperial') return 2.2;
    if (f.kind === 'boss') return 1.8;
    if (f.human) return p.orders === 'expand' ? 1.3 : 1.6;
    return 1.45 + BK.Setup.DIFFICULTY[s.difficulty || 'normal'].rivalCaution;
  }

  BK.AI = {
    // A plan for a war from prefecture p, or null.
    warPlan: function (s, p, f) {
      var rng = W.rng(s);
      if (!rng.chance(aggression(s, p, f))) return null;
      var heroes = W.heroesAt(s, p.id).filter(function (c) { return c.men > 5 && c.body > 30 && c.key !== 'Gao Qiu'; });
      if (heroes.length < 2 && W.heroesAt(s, p.id).length < 2) return null;
      heroes.sort(function (a, b) { return b.men - a.men; });
      var keeper = W.heroesAt(s, p.id).filter(function (c) { return c.key === 'Gao Qiu'; })[0] || heroes[heroes.length - 1];
      var army = heroes.filter(function (c) { return c !== keeper; }).slice(0, 10);
      if (!army.length) return null;
      var power = W.prefPower(s, p.id, army);
      var plan = null, bestRatio = threshold(s, f, p);
      var elapsed = (s.year - BK.Scenarios[s.scenarioId - 1].year) * 12 + s.month - 1;
      W.neighbors(p.id).forEach(function (n) {
        if (W.attackBlock(s, f.id, p.id, n)) return;
        var t = W.pref(s, n), tf = W.faction(s, t.owner);
        // New players get their first year to find their feet.
        if (tf && tf.human && elapsed < 12) return;
        if (f.kind === 'imperial' && tf && tf.kind === 'imperial') return;
        // The court keeps to its cities and leaves wild land to the bandits.
        if (f.kind === 'imperial' && !tf) return;
        var ratio = power / W.defenseValue(s, n);
        if (tf && tf.human) ratio /= 1 + BK.Setup.DIFFICULTY[s.difficulty || 'normal'].caution;
        if (tf && tf.kind === 'goodfellow' && f.kind === 'goodfellow' && !f.human) ratio *= 0.85;
        if (n === BK.MapData.capital) ratio *= 0.8;
        if (ratio > bestRatio) { bestRatio = ratio; plan = n; }
      });
      if (!plan) return null;
      var ids = army.map(function (c) { return c.id; });
      var need = BK.War.foodNeed(s, ids);
      if (p.food < need * 0.7 || p.gold < BK.War.provisions(s, ids)) return null;
      return { fid: f.id, source: p.id, target: plan, heroes: ids, food: Math.min(p.food, need) };
    },

    decide: function (s, prefId) {
      var p = W.pref(s, prefId), f = W.faction(s, p.owner), rng = W.rng(s);
      var hs = W.heroesAt(s, prefId);
      if (!f || !hs.length) return { type: 'idle' };
      var ruler = W.char(s, p.ruler) || hs[0];
      var fit = hs.filter(function (c) { return c.body > 25; });
      var strongest = best(fit.length ? fit : hs, function (c) { return c.str + c.courage; });
      var wisest = best(fit.length ? fit : hs, function (c) { return c.wis + c.mercy / 2; });
      var men = W.menAt(s, prefId);
      var winter = W.season(s) === 'Winter';
      var act = function (r) { return { type: 'action', result: r }; };
      // Going into town tires the chieftain.
      var travel = function (r) { if (r.ok && ruler.body > 10) ruler.body -= 10; return act(r); };

      if (p.beasts) {
        var hunter = best(fit.length ? fit : hs, function (c) { return c.dex + c.men * 0.6; });
        if (hunter.body > 40) return act(A.fightBeasts(s, prefId, hunter.id));
      }

      if (f.kind === 'goodfellow' && !f.human) {
        var sworn = hs.filter(function (c) { return c.loyalty >= 95 && !c.brother && c.id !== f.leader; })[0];
        if (sworn && rng.chance(0.3)) return act(A.brother(s, sworn.id));
      }

      var war = this.warPlan(s, p, f);
      if (war) return { type: 'war', plan: war };

      var hunter2 = best(fit.length ? fit : hs, function (c) { return c.dex; });
      if (p.food < men * 4.8) {
        if (!winter && hunter2.body > 20) return act(A.hunt(s, prefId, hunter2.id, 'food'));
        if (p.gold > 100 && ruler.body > 10) return travel(A.trade(s, prefId, 'food', Math.floor(p.gold * 0.5 / A.prices(p).foodBuy), true));
      }
      var worker = best(fit.length ? fit : hs, function (c) { return c.str; });
      if (p.support < 42) {
        if (p.food > 300) return act(A.giveCitizens(s, prefId, Math.round(p.food * 0.25)));
        if (worker.body > 15) return act(A.service(s, prefId, worker.id, rng.pick(['farm', 'build'])));
      }
      // Freshly settled wild land has bare fields and markets; build them up before an army,
      // or the prefecture never earns the taxes to pay one.
      if (Math.min(p.land, p.wealth) < 35 && worker.body > 15) {
        return act(A.service(s, prefId, worker.id, p.land < p.wealth ? 'farm' : 'build'));
      }
      var room = hs.reduce(function (a, c) { return a + W.menCap(c) - c.men; }, 0);
      // Once an Edict turns the court against Gao Qiu, the capital's purse is closed to him and
      // Kaifeng can no longer hire fresh men (see Econ.january for the yearly levy).
      var closed = f.kind === 'imperial' && prefId === BK.MapData.capital && s.factions.some(function (x) { return x.edict; });
      if (!closed && room > 20 && p.gold > A.hireCost(p) * 10 && men < hs.length * 65) {
        var recruit = best(hs, function (c) { return W.menCap(c) - c.men; });
        var n = Math.floor(Math.min(W.menCap(recruit) - recruit.men, p.gold * 0.6 / A.hireCost(p)));
        if (n > 5) return act(A.hireMen(s, prefId, recruit.id, n));
      }
      var drill = best(fit.length ? fit : hs, function (c) { return c.str + c.dex; });
      if (p.skill < 60 && drill.body > 10 && men && rng.chance(0.7)) return act(A.train(s, prefId, drill.id));
      if (p.arms < 55 && men) {
        var smith = best(hs.filter(A.canForge), function (c) { return c.dex + c.wis; });
        if (p.metal >= 10 && smith && smith.body > 15) return act(A.makeWeapons(s, prefId, smith.id, p.metal));
        if (p.smithy && p.gold > 300 && ruler.body > 10) return travel(A.buyArms(s, prefId, Math.round(p.gold * 0.3)));
        if (p.support > 45 && strongest.body > 15) return act(A.solicit(s, prefId, strongest.id, 'metal'));
      }
      if (f.kind === 'goodfellow' && hs.length < p.castles * 5 && ruler.body > 10 && rng.chance(0.5)) {
        var towns = W.townsAt(s, prefId);
        if (towns.length) {
          var target = best(towns, function (c) { return c.str + c.dex + c.wis + c.courage; });
          if (A.willJoin(s, f.id, target, ruler)) return travel(A.recruit(s, f.id, prefId, ruler, target));
        }
      }
      var low = best(['flood', 'land', 'wealth'], function (k) { return -p[k]; });
      if (p[low] < 70 && worker.body > 15) {
        return act(A.service(s, prefId, worker.id, { flood: 'flood', land: 'farm', wealth: 'build' }[low]));
      }
      if (p.gold < 80 && p.support > 60 && wisest.body > 15) return act(A.solicit(s, prefId, wisest.id, 'gold'));
      if (p.fur > 30 && ruler.body > 10) return travel(A.trade(s, prefId, 'fur', p.fur, false));
      var avgLoy = hs.reduce(function (a, c) { return a + c.loyalty; }, 0) / hs.length;
      if (avgLoy < 60 && p.gold > A.feastCost(s, prefId) + 100) return act(A.feast(s, prefId));
      if (p.skill < 100 && drill.body > 10 && men) return act(A.train(s, prefId, drill.id));
      return act(A.rest(s, prefId));
    },

    decideExile: function (s, fid) {
      var f = W.faction(s, fid), rng = W.rng(s), lead = W.leader(s, fid);
      var band = W.exileBand(s, fid);
      var here = W.pref(s, f.exileAt);
      var act = function (r) { return { type: 'action', result: r }; };
      var power = band.reduce(function (a, c) { return a + W.unitPower(c.men, 25, 35, c); }, 0);
      if (!W.attackBlock(s, fid, f.exileAt, f.exileAt) || here.owner == null) {
        if (here.owner == null || power > W.defenseValue(s, here.id) * 1.15) {
          return { type: 'war', plan: { fid: fid, source: here.id, target: here.id, heroes: band.map(function (c) { return c.id; }), food: 0 } };
        }
      }
      if (lead.body < 30) return act(A.rest(s, here.id));
      var towns = W.townsAt(s, here.id);
      if (towns.length && rng.chance(0.4)) {
        var t = towns[0];
        if (A.willJoin(s, fid, t, lead)) return act(A.recruit(s, fid, here.id, lead, t));
      }
      if (lead.men < W.menCap(lead) - 5 && rng.chance(0.7)) return act(A.gather(s, fid));
      var softer = W.neighbors(here.id).filter(function (n) {
        return !W.pref(s, n).snowbound && W.defenseValue(s, n) < W.defenseValue(s, here.id);
      });
      if (softer.length && !here.snowbound && rng.chance(0.5)) return act(A.wander(s, fid, rng.pick(softer)));
      return act(A.gather(s, fid));
    },

    // How an AI Good Fellow answers Gao Qiu's demand for gold.
    paysDemand: function (s, prefId) {
      var p = W.pref(s, prefId), mine = W.defenseValue(s, prefId);
      var threat = Math.max.apply(null, W.neighbors(prefId).map(function (n) {
        var q = W.pref(s, n);
        return q.owner === s.imperial ? W.prefPower(s, n) : 0;
      }));
      return threat > mine * 0.9;
    },
    // The imperial prefecture that punishes a refusal.
    punisher: function (s, prefId) {
      var cands = W.neighbors(prefId).filter(function (n) { return W.pref(s, n).owner === s.imperial && n !== BK.MapData.capital; });
      return best(cands, function (n) { return W.prefPower(s, n); });
    },
    punishPlan: function (s, prefId) {
      var src = this.punisher(s, prefId);
      if (!src) return null;
      var army = W.heroesAt(s, src).filter(function (c) { return c.key !== 'Gao Qiu' && c.men > 5; });
      if (!army.length) return null;
      var ids = army.slice(0, 10).map(function (c) { return c.id; });
      var p = W.pref(s, src);
      return { fid: s.imperial, source: src, target: prefId, heroes: ids, food: Math.min(p.food, BK.War.foodNeed(s, ids)) };
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = BK.AI;
})(typeof window !== 'undefined' ? window : globalThis);
