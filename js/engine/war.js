/* Starting a war and applying a finished battle to the world: casualties, prisoners,
   fleeing defenders, conquest, and the fall of Gao Qiu. */
(function (root) {
  'use strict';
  var BK = root.BK = root.BK || {};
  var W = BK.World, A = BK.Actions;

  function nearestOwn(s, fid, fromId, exclude) {
    var seen = {}, q = [fromId];
    seen[fromId] = true;
    while (q.length) {
      var cur = q.shift();
      var nb = W.neighbors(cur);
      for (var i = 0; i < nb.length; i++) {
        var n = nb[i];
        if (seen[n]) continue;
        seen[n] = true;
        var p = W.pref(s, n);
        if (p.owner === fid && n !== exclude) return n;
        q.push(n);
      }
    }
    return 0;
  }

  BK.War = {
    // Food an army needs for the whole month.
    foodNeed: function (s, heroIds) {
      var men = heroIds.reduce(function (a, id) { return a + W.char(s, id).men; }, 0);
      return Math.ceil(men / 10) * 30;
    },
    // Gold for provisions: 34 for every hero with 100 men, less for smaller companies.
    provisions: function (s, heroIds) {
      return heroIds.reduce(function (a, id) { return a + Math.ceil(34 * Math.max(10, W.char(s, id).men) / 100); }, 0);
    },

    start: function (s, o) {
      var exile = W.isExiled(s, o.fid);
      var f = W.faction(s, o.fid);
      var source = exile ? f.exileAt : o.source;
      var food = o.food;
      if (exile) food = BK.War.foodNeed(s, o.heroes);
      else {
        var sp = W.pref(s, source);
        food = Math.min(food, sp.food);
        sp.food -= food;
        sp.gold -= Math.min(sp.gold, BK.War.provisions(s, o.heroes));
      }
      var tp = W.pref(s, o.target);
      if (tp.owner != null && f.treaties.indexOf(tp.owner) >= 0) A.breakTreaty(s, o.fid, tp.owner);
      var leader = o.heroes.indexOf(f.leader) >= 0 ? f.leader : o.heroes[0];
      // Going to war costs its commander 10 Body.
      var lc = W.char(s, leader);
      lc.body = Math.max(1, lc.body - 10);
      var b = BK.Battle.create(s, { atkFid: o.fid, source: source, target: o.target, heroes: o.heroes, food: food, leader: leader });
      if (!b.live('def').length) b.finish('atk', W.pref(s, o.target).name + ' is undefended.');
      return b;
    },

    // Apply a finished battle. Returns { text, captured: [{ cid, captor }], conquered, victory }.
    apply: function (s, b) {
      var r = b.result, atkWin = r.winner === 'atk';
      var tp = W.pref(s, b.target), oldOwner = b.defFid;
      var exile = W.isExiled(s, b.atkFid);
      var captured = [], lines = [];
      var gao = s.chars.filter(function (c) { return c.key === 'Gao Qiu'; })[0];

      // A victorious attacker captures every defender still on the field.
      var taken = 0;
      if (atkWin) b.units.forEach(function (u) {
        if (u.side === 'def' && !u.gone) { u.gone = 'captured'; taken++; }
      });
      if (taken) lines.push(taken + (taken > 1 ? ' defenders are' : ' defender is') + ' taken prisoner.');
      // Heroes who fled or were swept downriver keep the men they had left.
      b.units.forEach(function (u) {
        var c = W.char(s, u.cid);
        c.men = u.gone && u.gone !== 'fled' && u.gone !== 'swept' ? 0 : u.men;
      });
      var gaoFell = null;
      b.units.forEach(function (u) {
        var c = W.char(s, u.cid);
        var captor = u.side === 'atk' ? oldOwner : b.atkFid;
        if (c.id === gao.id && (u.gone === 'captured' || u.gone === 'killed')) { gaoFell = { by: captor, how: u.gone }; return; }
        if (u.gone === 'captured') {
          captured.push({ cid: c.id, captor: captor });
          A.capture(s, c, captor, b.target);
        } else if (u.gone === 'killed') {
          var fid = c.faction;
          var p = c.loc ? W.pref(s, c.loc) : null;
          c.status = 'dead'; c.men = 0;
          if (p && p.ruler === c.id) A.pickRuler(s, p.id, c.id);
          A.checkLeader(s, fid, c.id);
          lines.push(c.name + ' has fallen.');
        }
      });

      var result = { conquered: false, victory: false, captured: captured };
      if (atkWin) {
        var gaoHere = gao.status === 'served' && gao.loc === b.target;
        // Defenders who survived scatter to friendly ground or into the hills.
        var defenders = s.chars.filter(function (c) { return c.status === 'served' && c.loc === b.target && c.faction === oldOwner; });
        var of = W.faction(s, oldOwner);
        var refuge = of ? nearestOwn(s, oldOwner, b.target, b.target) : 0;
        defenders.forEach(function (c) {
          if (c.id === gao.id) return;
          if (refuge) {
            c.loc = refuge;
            if (of.leader === c.id) W.pref(s, refuge).ruler = c.id;
            return;
          }
          if (of && of.kind === 'goodfellow') {
            c.loc = W.rng(s).pick(W.neighbors(b.target));
            return;
          }
          A.release(s, c);
        });
        b.units.forEach(function (u) {
          var c = W.char(s, u.cid);
          if (u.side === 'atk' && c.status === 'served') c.loc = b.target;
        });
        var atkF = W.faction(s, b.atkFid);
        tp.owner = b.atkFid;
        var survivors = W.heroesAt(s, b.target);
        var lead = survivors.filter(function (c) { return c.id === atkF.leader; })[0];
        if (lead) tp.ruler = lead.id; else A.pickRuler(s, b.target);
        if (tp.ruler == null && survivors.length) tp.ruler = survivors[0].id;
        tp.food += Math.max(0, b.food.atk);
        tp.support = Math.max(10, tp.support - 8);
        tp.wealth = Math.max(0, tp.wealth - 3);
        tp.orders = 'develop';
        if (exile) atkF.exileAt = 0;
        A.earn(s, b.atkFid, of && of.kind === 'imperial' ? 15 : 10);
        if (of) {
          if (of.kind === 'goodfellow' && of.alive && !W.factionPrefs(s, oldOwner).length) {
            var gl = s.chars[of.leader];
            if (gl.status === 'served') {
              of.exileAt = gl.loc;
              W.factionHeroes(s, oldOwner).forEach(function (c) { c.loc = gl.loc; });
            }
          }
          A.noteFactionLoss(s, oldOwner);
        }
        result.conquered = true;
        lines.unshift(W.leader(s, b.atkFid).name + ' takes ' + tp.name + '!');
        if (gaoHere) {
          gao.status = 'prisoner'; gao.captor = b.atkFid; gao.faction = null;
          lines.push('Gao Qiu is dragged from his hiding place and brought before ' + W.leader(s, b.atkFid).name + '.');
          A.victory(s, b.atkFid);
          result.victory = true;
        }
      } else {
        if (!exile) {
          var sp = W.pref(s, b.source);
          sp.food += Math.max(0, b.food.atk);
          BK.Econ.cap(sp);
        }
        A.earn(s, oldOwner, 3);
        lines.unshift(W.pref(s, b.target).name + ' holds out against ' + W.leader(s, b.atkFid).name + '.');
      }
      if (gaoFell && !result.victory) {
        gao.status = gaoFell.how === 'killed' ? 'dead' : 'prisoner';
        gao.faction = null;
        lines.push(gaoFell.how === 'killed' ? 'Gao Qiu has been slain on the field!' : 'Gao Qiu has been taken alive!');
        A.victory(s, gaoFell.by);
        result.victory = true;
      }
      tp.food = Math.max(0, Math.min(tp.food, atkWin ? tp.food : b.food.def));
      BK.Econ.cap(tp);
      W.log(s, lines[0]);
      result.text = lines.join(' ');
      return result;
    },

    // AI captors decide on prisoners at once.
    aiPrisoners: function (s, list) {
      var rng = W.rng(s), out = [];
      list.forEach(function (x) {
        var c = W.char(s, x.cid), f = W.faction(s, x.captor);
        if (!f || !f.alive || c.status !== 'prisoner') return;
        var home = c.loc;
        if (W.heroesAt(s, home).length < W.pref(s, home).castles * 5 && rng.chance(A.prisonerChance(s, x.captor, c))) {
          A.enlist(s, c, x.captor, home, rng.int(45, 70));
          out.push(c.name + ' now serves ' + W.leader(s, x.captor).name + '.');
        } else if (W.leader(s, x.captor).mercy > 60) {
          A.release(s, c);
          out.push(c.name + ' is set free.');
        } else out.push(c.name + ' is thrown into prison.');
      });
      return out;
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = BK.War;
})(typeof window !== 'undefined' ? window : globalThis);
