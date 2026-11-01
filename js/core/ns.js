/* Bandit King of Ancient China - shared namespace, palette and small utilities.
   Every script in the game is a classic script that attaches to the global BK object,
   so the game runs straight from file:// and the engine also loads under Node for tests. */
(function (root) {
  'use strict';
  var BK = root.BK = root.BK || {};

  BK.VERSION = '1.0';
  BK.COMPANY = 'Fick';
  BK.TITLE = 'Bandit King of Ancient China';

  // 32-colour master palette (Amiga OCS lowres had 32 registers). All game art uses these.
  BK.PAL = [
    '#000000', '#FFFFFF', '#F2E8C9', '#C9B78A', '#8C6A3F', '#5A3B22', '#F0C8A0', '#D9A06E',
    '#A86A3E', '#6E4426', '#E03C2C', '#A0201C', '#F08A24', '#F6D63E', '#B5C95A', '#5DAA45',
    '#2E6B3A', '#2FB8B0', '#64D4F0', '#3A78D8', '#1F3C8C', '#7A4BC2', '#D24FB4', '#F2A0B8',
    '#C8CCD4', '#8A909C', '#4C525E', '#23262E', '#CFE0A5', '#9DBB6E', '#E8F2F8', '#9FC8DE'
  ];
  BK.C = {
    black: 0, white: 1, parchment: 2, tan: 3, brown: 4, darkBrown: 5, skin0: 6, skin1: 7,
    skin2: 8, skin3: 9, red: 10, darkRed: 11, orange: 12, yellow: 13, yellowGreen: 14,
    green: 15, darkGreen: 16, teal: 17, cyan: 18, blue: 19, darkBlue: 20, purple: 21,
    magenta: 22, pink: 23, lightGrey: 24, grey: 25, darkGrey: 26, nearBlack: 27,
    land: 28, landShade: 29, snow: 30, ice: 31
  };

  BK.clamp = function (v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); };

  // 32-bit string hash (FNV-1a) for seeding per-character art and data.
  BK.hash = function (str) {
    var h = 0x811c9dc5;
    str = String(str);
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  };

  // Small deterministic generator. State is a single uint32 so it can be saved with the game.
  BK.Rng = function (seed) {
    this.s = (seed >>> 0) || 0x9e3779b9;
  };
  BK.Rng.prototype.next = function () {
    var t = (this.s = (this.s + 0x6D2B79F5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  BK.Rng.prototype.int = function (lo, hi) { return lo + Math.floor(this.next() * (hi - lo + 1)); };
  BK.Rng.prototype.chance = function (p) { return this.next() < p; };
  BK.Rng.prototype.pick = function (arr) { return arr[Math.floor(this.next() * arr.length)]; };
  BK.Rng.prototype.shuffle = function (arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(this.next() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  };
  BK.Rng.prototype.range = function (lo, hi) { return lo + this.next() * (hi - lo); };

  BK.MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
    'September', 'October', 'November', 'December'];
  BK.seasonOf = function (month) {
    if (month >= 3 && month <= 5) return 'Spring';
    if (month >= 6 && month <= 8) return 'Summer';
    if (month >= 9 && month <= 11) return 'Autumn';
    return 'Winter';
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = BK;
})(typeof window !== 'undefined' ? window : globalThis);
