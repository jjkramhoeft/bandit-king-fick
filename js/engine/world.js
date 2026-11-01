/* Read-side helpers over the game state: lookups, ownership, popularity and strength estimates. */
(function (root) {
  'use strict';
  var BK = root.BK = root.BK || {};

  var W = BK.World = {
    rng: function (s) {
      if (!(s._rng instanceof BK.Rng)) s._rng = Object.assign(new BK.Rng(1), s._rng || { s: s.seed });
      return s._rng;
    },

    pref: function (s, id) { return s.prefs[id - 1]; },
    char: function (s, id) { return s.chars[id]; },
    faction: function (s, id) { return id == null ? null : s.factions[id]; },
    leader: function (s, fid) { var f = W.faction(s, fid); return f ? s.chars[f.leader] : null; },

    neighbors: function (prefId) { return BK.MapGeo.build().adj[prefId]; },
    isAdjacent: function (a, b) { return W.neighbors(a).indexOf(b) >= 0; },

    // Heroes serving the owner of a prefecture and stationed there.
    heroesAt: function (s, prefId) {
      var p = W.pref(s, prefId), out = [];
      if (p.owner == null) return out;
      for (var i = 0; i < s.chars.length; i++) {
        var c = s.chars[i];
        if (c.status === 'served' && c.loc === prefId && c.faction === p.owner) out.push(c);
      }
      return out;
    },
    townsAt: function (s, prefId) {
      return s.chars.filter(function (c) { return c.status === 'free' && c.loc === prefId; });
    },
    prisonersAt: function (s, prefId) {
      return s.chars.filter(function (c) { return c.status === 'prisoner' && c.loc === prefId; });
    },
    menAt: function (s, prefId) {
      return W.heroesAt(s, prefId).reduce(function (a, c) { return a + c.men; }, 0);
    },
    factionPrefs: function (s, fid) {
      return s.prefs.filter(function (p) { return p.owner === fid; });
    },
    factionHeroes: function (s, fid) {
      return s.chars.filter(function (c) { return c.status === 'served' && c.faction === fid; });
    },
    exileBand: function (s, fid) {
      var f = W.faction(s, fid);
      return s.chars.filter(function (c) { return c.status === 'served' && c.faction === fid && c.loc === f.exileAt; });
    },
    isExiled: function (s, fid) {
      var f = W.faction(s, fid);
      return !!(f && f.alive && f.kind === 'goodfellow' && W.factionPrefs(s, fid).length === 0);
    },

    // As in the PC and Amiga manuals: every hero leads at most 100 men, so a prefecture holds
    // at most heroes × 100.
    MEN_MAX: 100,
    menCap: function () { return W.MEN_MAX; },

    // Popularity of a Good Fellow: earned deeds plus standing in the prefectures they hold.
    popularity: function (s, fid) {
      var f = W.faction(s, fid);
      if (!f) return 0;
      var lead = s.chars[f.leader];
      var pop = lead.popEarned;
      W.factionPrefs(s, fid).forEach(function (p) {
        if (p.support >= 40) pop += 12;
        if (p.id === BK.MapData.liangshan) pop += 100;
      });
      return BK.clamp(Math.round(pop), 0, 999);
    },
    charPopularity: function (s, c) {
      var f = W.faction(s, c.faction);
      if (f && f.leader === c.id && f.kind === 'goodfellow') return W.popularity(s, f.id);
      return BK.clamp(Math.round(c.popEarned), 0, 999);
    },

    // Who issues orders for a prefecture: the faction's player directly (home and sworn brothers)
    // or the governing chieftain acting on standing orders.
    isDirect: function (s, prefId) {
      var p = W.pref(s, prefId);
      var f = W.faction(s, p.owner);
      if (!f || p.ruler == null) return false;
      var r = s.chars[p.ruler];
      if (r.id === f.leader || r.brother) return true;
      // The Good Fellow commands wherever he is, even in a prefecture a chieftain ran before.
      var lead = s.chars[f.leader];
      return lead.status === 'served' && lead.faction === f.id && lead.loc === prefId;
    },
    humanOf: function (s, fid) {
      var f = W.faction(s, fid);
      return f && f.human ? f.player : -1;
    },

    unitPower: function (men, arms, skill, c) {
      var hero = 1 + ((c ? c.str : 50) - 50) / 250 + ((c ? c.courage : 50) - 50) / 400;
      return men * (0.6 + arms / 125) * (0.6 + skill / 125) * hero;
    },
    prefPower: function (s, prefId, heroes) {
      var p = W.pref(s, prefId);
      heroes = heroes || W.heroesAt(s, prefId);
      var sum = 0;
      heroes.forEach(function (c) { sum += W.unitPower(c.men, p.arms, p.skill, c); });
      return sum;
    },
    defenseValue: function (s, prefId) {
      var p = W.pref(s, prefId);
      return W.prefPower(s, prefId) * (1 + p.castles * 0.09) + 8;
    },

    // Whether faction fid may attack prefecture target from source.
    attackBlock: function (s, fid, sourceId, targetId) {
      var t = W.pref(s, targetId), f = W.faction(s, fid);
      // An exile band strikes at the prefecture it is hiding in.
      var fromExile = sourceId === targetId && W.isExiled(s, fid) && f.exileAt === targetId;
      if (!fromExile && !W.isAdjacent(sourceId, targetId)) return 'That prefecture does not border yours.';
      if (t.owner === fid) return 'That prefecture is already yours.';
      if (W.pref(s, sourceId).snowbound || t.snowbound) return 'Snow blocks the roads this month.';
      if (t.owner != null && f.treaties.indexOf(t.owner) >= 0) return 'You have a treaty with its ruler.';
      if (targetId === BK.MapData.capital && t.owner === s.imperial && !f.edict) {
        return 'Only the Imperial Edict permits an attack on Gao Qiu\'s home prefecture.';
      }
      return null;
    },

    dateText: function (s) {
      return BK.MONTHS[s.month - 1] + ' ' + s.year + ' A.D.';
    },
    season: function (s) { return BK.seasonOf(s.month); },

    factionName: function (s, fid) {
      var f = W.faction(s, fid);
      if (!f) return 'Nobody';
      return s.chars[f.leader].name;
    },

    log: function (s, text) {
      s.log.push(BK.MONTHS[s.month - 1].slice(0, 3) + ' ' + s.year + ': ' + text);
      if (s.log.length > 400) s.log.splice(0, s.log.length - 400);
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = W;
})(typeof window !== 'undefined' ? window : globalThis);
