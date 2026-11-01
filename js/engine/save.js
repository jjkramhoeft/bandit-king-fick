/* Saved games in browser storage: ten slots plus a January autosave. */
(function (root) {
  'use strict';
  var BK = root.BK = root.BK || {};

  var PREFIX = 'bandit-king-save-';

  function store() {
    try { return root.localStorage || null; } catch (e) { return null; }
  }

  BK.Save = {
    // Like the Amiga save disk, which held up to 10 games, plus a January autosave.
    SLOTS: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'auto'],

    serialize: function (s) {
      var copy = Object.assign({}, s);
      copy._rng = { s: BK.World.rng(s).s };
      return JSON.stringify(copy);
    },
    deserialize: function (text) {
      var s = JSON.parse(text);
      s._rng = Object.assign(new BK.Rng(1), s._rng || { s: s.seed });
      // Version 2 moved to the manual's 100 men per hero, a quarter of the old troop counts,
      // and gave steersmen their own ships.
      if ((s.v || 1) < 2) {
        s.chars.forEach(function (c) {
          c.men = Math.min(100, Math.round(c.men / 4));
          if (c.steersman) c.ship = true;
        });
        s.v = 2;
      }
      return s;
    },
    summary: function (s) {
      var names = s.players.map(function (p) { return s.chars[s.factions[p.faction].leader].name; });
      return {
        date: BK.MONTHS[s.month - 1] + ' ' + s.year,
        scenario: s.scenarioId,
        players: names.join(', ') || 'Demo',
        saved: new Date().toISOString()
      };
    },
    write: function (slot, s) {
      var st = store();
      if (!st) return false;
      try {
        st.setItem(PREFIX + slot, BK.Save.serialize(s));
        st.setItem(PREFIX + slot + '-meta', JSON.stringify(BK.Save.summary(s)));
        return true;
      } catch (e) { return false; }
    },
    read: function (slot) {
      var st = store();
      if (!st) return null;
      try {
        var t = st.getItem(PREFIX + slot);
        return t ? BK.Save.deserialize(t) : null;
      } catch (e) { return null; }
    },
    meta: function (slot) {
      var st = store();
      if (!st) return null;
      try { return JSON.parse(st.getItem(PREFIX + slot + '-meta') || 'null'); } catch (e) { return null; }
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = BK.Save;
})(typeof window !== 'undefined' ? window : globalThis);
