/* Bandit King of Ancient China - music and sound effects.
   Everything is synthesized with Web Audio: a small four-voice "tracker" (plucked lead, flute or
   bowed pad, bass, percussion) read by a lookahead scheduler, plus one-shot effects.
   All melodies are original. They are written in jianpu-style text, one token per eighth note:
     1..7  degree of the track key (the pentatonic modes use 1 2 3 5 6)
     ' ,   octave up / down        -  hold one more step       0  rest
     a_b   split the step evenly   ^5 slide into the note      5~ tremolo (plucked voices)
     > <   following notes an octave up / down     v6 velocity 0.6     | bar line
   Drum tokens hold one letter per hit: k drum, t tom, s snare, h tick, w woodblock, c cymbal,
   g small gong, o big gong; upper case is accented and . is silence. */
(function (root) {
  'use strict';
  var BK = root.BK = root.BK || {};

  var LOOKAHEAD = 0.12, HIDDEN_AHEAD = 1.5, TICK_MS = 25, FADE = 0.4, TAIL = 2.0;
  var PAN = [-0.3, 0.3, 0.12, -0.12];
  var DEG = [0, 2, 4, 5, 7, 9, 11];
  var NOTE_RE = /^(\^?)([#b]?)([1-7])([',]*)(~?)$/;
  var KIT = 'kKtTsShHwWcCgGoO';

  var ctx = null, master = null, musicBus = null, sfxBus = null, sfxWet = null, revIn = null;
  var noiseBuf = null, waves = null;
  var enabled = true, volume = 0.5;
  var songs = [], cur = null, want = null, timer = null, unlockArmed = false;
  var lastSfx = {}, compiled = {};

  function noop() {}
  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  // ---------------------------------------------------------------- pattern helpers
  function cat() { return Array.prototype.slice.call(arguments).join(' | '); }
  function rep(s, n) { var a = []; for (var i = 0; i < n; i++) a.push(s); return a.join(' | '); }
  function seq(cells, order) { return order.split(' ').map(function (k) { return cells[k]; }).join(' | '); }
  var REST = '0 0 0 0 0 0 0 0';

  // ---------------------------------------------------------------- tracks
  // ins: lead, pad, bass, percussion. oct: octave offset (semitones) of each melodic voice.
  var T = {};

  // Grand: D gong mode, pipa tremolo over erhu, big drum and gongs.
  T.title = {
    bpm: 76, key: 62, ins: ['pipa', 'erhu', 'bass', 'kit'], oct: [0, -12, -24], rev: 0.3,
    v: [
      `0 0 0 0 0 0 0 0 | 0 0 0 0 0 0 5, 6, |
       1 - 2 3 ^5 - - 6 | 5 3 2 - 3 - - - | 5 - 6 1' 2' - 1' 6 | 5~ - - - - - 5, 6, |
       1 - 2 3 5 - - 6 | 5 3 2 - 1 - 2 3 | 2 - 3 2 1 - 6, - | 1~ - - - - - 5 6 |
       1' - - 2' 3' - 2' 1' | 6 - 5 6 ^1' - - - | 2' - 1' 6 5 - 6 1' | 3'~ - - - 2' - 1' - |
       6 - 5 3 5 - 6 1' | 5 - 3 2 3 - - - | 2 - 3 5 6 5 3 2 | 1~ - - - - - - -`,
      `0 0 0 0 0 0 0 0 | 0 0 0 0 0 0 0 0 |
       3 - - - 5 - - - | 2 - - - 3 - - - | 5 - - - 6 - - - | 5 - - - 3 - 2 - |
       3 - - - 5 - - - | 2 - - - 5 - - - | 6, - - - 5, - - - | 1 - - - - - 3 - |
       5 - - - 1' - - - | 6 - - - 3 - - - | 5 - - - 3 - - - | 1' - - - 6 - 5 - |
       3 - - - 2 - - - | 1 - - - 6, - - - | 5, - - - 5 - - - | 1 - - - 5, - - -`,
      `1 - - - - - - - | 1 - - - 5, - 6, - |
       1 - - 5, 1 - - - | 6, - - - 1 - - - | 5, - - - 6, - - - | 1 - - 5, 1 - 5, - |
       1 - - 5, 1 - - - | 6, - - - 5, - - - | 2 - - - 5, - - - | 1 - - 5, 1 - - - |
       6, - - - 1 - - - | 2 - - - 1 - - - | 5, - - - 6, - - - | 1 - - 5, 1 - - - |
       6, - - - 5, - - - | 1 - - - 6, - - - | 2 - - - 5, - - - | 1 - - 5, 1 - - -`,
      `o . . . k . . k | K . . k K . k_k k_k |
       K . . . k . . . | K . . k k . . . | K . . . k . . . | K . . . g . k k |
       K . . . k . . . | K . . k k . . . | K . . . k . . . | K . . . c . k_k k_k |
       Kc . . . k . . . | K . . k k . . . | K . . . k . . . | K . . . g . k k |
       K . . . k . . . | K . . k k . . . | K . . . k . k . | K . . . g . k_k k_k`
    ]
  };

  // Calm and deliberate: F key, zhi mode on C; guzheng with a low xiao.
  T.setup = {
    bpm: 92, key: 65, ins: ['zheng', 'xiao', 'bass', 'kit'], oct: [0, 0, -24], rev: 0.3,
    v: [
      `5 - - 6 5 3 2 - | 3 - 5 - 2 - 1 - | 2 - 3 5 6 - 5 3 | 5 - - - - - 0 0 |
       6 - - 1' 6 5 3 - | 5 6 3 2 1 - 2 - | 3 - 2 1 6, - 1 2 | 5, - - - - - 0 0 |
       1 - 2 - 3 5 3 2 | 1 - 6, - 5, - - - | 6, - 1 2 3 - 5 - | 6 - 5 3 2 - - - |
       3 - 5 6 1' - 6 5 | 3 - 2 3 5 - - - | 6 - 5 3 2 3 2 1 | 6, - 1 2 3 - 2 3`,
      `3 - - - - - - - | 1 - - - 6, - - - | 6, - - - 1 - - - | 2 - - - 3 - - - |
       3 - - - 1 - - - | 1 - - - 6, - - - | 5, - - - 6, - - - | 3, - - - - - 0 0 |
       5 - - - 3 - - - | 3 - - - 1 - - - | 1 - - - 2 - - - | 3 - - - 5, - - - |
       5 - - - 3 - - - | 1 - - - 2 - - - | 3 - - - 5, - - - | 6, - - - 5, - - -`,
      `5, - - - 2 - - - | 1 - - - 6, - - - | 6, - - - 1 - - - | 5, - - - 5, - 2 - |
       6, - - - 1 - - - | 1 - - - 6, - - - | 5, - - - 6, - - - | 5, - - - 5, - 2 - |
       1 - - - 5 - - - | 1 - - - 5, - - - | 6, - - - 2 - - - | 6, - - - 5, - - - |
       1 - - - 5, - - - | 1 - - - 2 - - - | 6, - - - 5, - - - | 6, - - - 5, - 2 -`,
      cat(rep('k . . . w . . . | k . . k w . . .', 3), 'k . . . w . . . | k . . . t . . .',
        rep('k . . . w . . . | k . . k w . . .', 3), 'k . . . w . . . | k . . . w . w w')
    ]
  };

  // Light and hopeful: G gong mode. The dizi sings the middle section over zheng arpeggios.
  var springA = `1 2 3 5 3 - 2 1 | 2 - 3 5 6 - - - | 5 6 1' 6 5 3 2 3 | 5 - - - - - 3 5 |
     6 - 5 6 1' - 6 5 | 3 5 2 3 1 - - 6, | 1 2 3 2 1 6, 5, 6,`;
  var springArp = { G: "1, 5, 1 5, 3 5, 1 5,", A: "2, 6, 2 6, 3 6, 2 6,",
    E: "6,, 3, 6, 3, 1 3, 6, 3,", D: "5,, 2, 5, 2, 6, 2, 5, 2," };
  var springBass = { G: "1 - 5, - 1 - 5, -", A: "2 - 6, - 2 - 6, -",
    E: "6, - 3 - 6, - 3 -", D: "5, - 2 - 5, - 2 -" };
  var springBassA = `1 - 5, - 1 - 5, - | 6, - 3 - 2 - 6, - | 1 - 5, - 1 - 3 - | 5, - 2 - 5, - 2 - |
     6, - 3 - 6, - 3 - | 1 - 5, - 1 - 5, - | 6, - 3 - 5, - 2 - | 1 - 5, - 1 - - -`;
  T['main-spring'] = {
    bpm: 104, key: 67, ins: ['zheng', 'dizi', 'bass', 'kit'], oct: [0, 12, -24], rev: 0.28,
    v: [
      cat(springA, '1 - - - - - 0 0', 'v5 ' + seq(springArp, 'G A E G E G A D') + ' v8',
        springA, "1 - - - 0 0 5, 6,"),
      cat(rep(REST, 4), `3 - - - - - - - | 2 - - - 1 - - - | 6, - - - 5, - - - | 1 - - - - - 0 0`,
        `3 - - 5 6 - 5 3 | 2 - 3 5 3 - - - | 6, - 1 2 3 5 3 2 | 1 - - - 2 - - - |
         5 - 6 5 3 - 2 3 | 5 - - - 6 - 5 3 | 2 - 3 2 1 - 6, 1 | 5, - - - - - - -`,
        `3 - - - - - - - | 2 - - - 3 - - - | 1 - - - 3 - - - | 2 - - - 1 - 2 3 |
         3 - - - - - - - | 2 - - - 1 - - - | 6, - - - 5, - - - | 1 - - - - - 0 0`),
      cat(springBassA, seq(springBass, 'G A E G E G A D'), springBassA),
      rep(cat(rep('k . h . w . h . | k . h k w . h h', 3), 'k . h . w . h . | k . h . w . w_w w'), 3)
    ]
  };

  // Lively: C key, zhi mode on G. Bright pipa, bouncing bass, dizi solo in the middle.
  var summerPipa = { C: "1 5, 1 5, 1 5, 2 3", D: "2 6, 2 6, 2 6, 3 5",
    G: "5, 2 5, 2 5, 2 3 2", A: "6, 3 6, 3 6, 3 5 3" };
  var summerBass = { G: "5, - 5 5, 2 - 5, -", C: "1 - 1' 1 5, - 1 -",
    A: "6, - 6 6, 3 - 6, -", D: "2 - 2' 2 6, - 2 -" };
  var summerPadA = `3 - - - 5 - - - | 3 - - - 2 - - - | 1 - - - 6, - - - | 5, - - - 0 0 5 6 |
     1' - - - 5 - - - | 6 - - - 5 - - - | 3 - - - 2 - - - | 5, - - - 0 0 0 0`;
  T['main-summer'] = {
    bpm: 120, key: 72, ins: ['pipa', 'dizi', 'bass', 'kit'], oct: [0, -12, -24], rev: 0.22,
    v: [
      cat(`5 - 6 5 3 5 6 1' | 5 - 3 2 3 - 5 - | 6 5 3 2 1 2 3 5 | 2 - - 3 2 - 0 0 |
           5 - 6 5 3 5 6 1' | 2' - 1' 6 5 - 6 - | 1' 6 5 3 2 3 5 6 | 5 - - - 0 0 0 0`,
        'v6 ' + seq(summerPipa, 'C D G A C A D G') + ' v8',
        `5 - 6 5 3 5 6 1' | 5 - 3 2 3 - 5 6 | 1' 6 5 3 2 3 5 6 | 5 - - 3 2 - 0 0 |
         5 - 6 5 3 5 6 1' | 2' - 3' 2' 1' 6 5 6 | 1' - 6 5 3 5 2 3 | 5 - - - 0 0 0 0`),
      cat(summerPadA,
        `> 1' - - 6 5 - 6 1' | 2' - 3' 2' 1' - 6 - | 5 - 6 1' 6 5 3 5 | 6 - - - - - 0 0 |
         1' - - 2' 3' - 2' 1' | 6 - 1' 6 5 - 3 - | 2 - 3 5 6 - 1' 6 | 5 - - - - - 0 0 <`,
        summerPadA),
      cat(seq(summerBass, 'G C A D G D C G'), seq(summerBass, 'C D G A C A D G'),
        seq(summerBass, 'G C A D G D C G')),
      rep(cat(rep('k . w h s . w h | k k w h s . w_w h', 3), 'k . w h s . w h | k . w . s . w_w w_w'), 3)
    ]
  };

  // Melancholy: yu mode on A. Slow guzheng, erhu lament in the middle, a distant gong.
  var autumnA = `6, - - 1 2 - 3 - | 2 1 6, - 5, - - - | 6, - 1 2 3 - 5 3 | 2 - - - - - 0 0 |
     3 - 5 6 5 - 3 2 | 1 - 2 3 2 1 6, - | 5, - 6, 1 2 - 1 6, | 6, - - - - - 0 0`;
  var autumnArp = { A: "6,, 3, 6, 1 3 1 6, 3,", C: "1, 5, 1 2 3 2 1 5,", G: "5,, 2, 5, 6, 2 6, 5, 2," };
  var autumnPad = `6 - - - 1' - - - | 5 - - - 3 - - - | 2 - - - 3 - - - | 6, - - - - - 0 0`;
  var autumnBassA = `6, - - - 3 - - - | 1 - - - 5, - - - | 6, - - - 1 - - - | 2 - - - 5, - - - |
     1 - - - 3 - - - | 6, - - - 1 - - - | 5, - - - 2 - - - | 6, - - - 3 - 6, -`;
  T['main-autumn'] = {
    bpm: 80, key: 72, ins: ['zheng', 'erhu', 'bass', 'kit'], oct: [0, -12, -24], rev: 0.32,
    v: [
      cat(autumnA, 'v5 ' + seq(autumnArp, 'C G A A A C G A') + ' v8', autumnA),
      cat(rep(REST, 4), autumnPad,
        `> 3 - - 2 3 5 6 - | 5 - 3 - 2 - - - | 1 - 2 3 5 - 3 2 | 3 - - - - - - - |
         6 - 5 3 2 - 3 5 | 3 - 2 1 6, - - - | 2 - 3 2 1 - 6, 1 | 6, - - - - - - - <`,
        `3 - - - 5 - - - | 1 - - - 6, - - - | 3 - - - 2 - - - | 5, - - - 6, - - -`, autumnPad),
      cat(autumnBassA,
        `1 - - - 5, - - - | 5, - - - 2 - - - | 6, - - - 3 - - - | 6, - - - 5, - - - |
         6, - - - 3 - - - | 1 - - - 5, - - - | 5, - - - 2 - - - | 6, - - - 3 - 6, -`,
        autumnBassA),
      rep(cat('o . . . t . . . | k . . . . . . .', 'k . . . t . . . | k . . . . . . .',
        'k . . . t . . . | k . . . . . . .', 'k . . . t . . . | k . . . t . t .'), 3)
    ]
  };

  // Sparse and cold: jue mode on A. Lone guzheng notes, low xiao, drone bass, faint ticks.
  T['main-winter'] = {
    bpm: 66, key: 65, ins: ['zheng', 'xiao', 'bass', 'kit'], oct: [0, -12, -24], rev: 0.45,
    lvl: [1, 1, 0.8, 0.8],
    v: [
      `3 - - - 5 - 6 - | 3 - - - - - 0 0 | 2' - - 1' 6 - - - | 5 - - - - - 0 0 |
       3 - - - 5 - 6 - | 1' - - - 6 - 5 - | 6 - - 5 3 - - - | 3 - - - - - 0 0 |
       6 - - - 1' - 2' - | 3' - - - - - 0 0 | 2' - 1' - 6 - 5 - | 6 - - - - - 0 0 |
       3' - - 2' 1' - 6 - | 5 - - - 6 - - - | 5 - 6 - 5 - 2 - | 3 - - - - - 0 0`,
      `0 0 0 0 0 0 0 0 | 0 0 0 0 0 0 0 0 | 6 - - - - - - - | 5 - - - 3 - - - |
       0 0 0 0 0 0 0 0 | 3 - - - 2 - - - | 1 - - - 2 - - - | 3 - - - - - - - |
       6 - - - - - - - | 5 - - - 6 - - - | 5 - - - 3 - - - | 2 - - - 3 - - - |
       1' - - - - - - - | 6 - - - 2 - - - | 3 - - - 2 - - - | 3 - - - - - - -`,
      `3 - - - - - - - | - - - - - - - - | 6, - - - - - - - | 5, - - - - - - - |
       3 - - - - - - - | 1 - - - - - - - | 6, - - - - - - - | 3 - - - - - - - |
       6, - - - - - - - | 3 - - - - - - - | 5, - - - - - - - | 6, - - - - - - - |
       1 - - - - - - - | 5, - - - - - - - | 6, - - - - - - - | 3 - - - - - - -`,
      rep(cat('k . . . . . . . | . . . . . . h . | . . . . h . . . | . . . . . . h .',
        'k . . . . . . . | . . . . . . h . | . . . . h . . . | . . . . . . . .'), 2)
    ]
  };

  // Battle themes: faster, drum-driven, one mode and colour per season.
  T['war-spring'] = {
    bpm: 132, key: 65, ins: ['pipa', 'dizi', 'bass', 'kit'], oct: [0, -12, -24], rev: 0.18,
    v: [
      `5 - 5 6 1' - 6 5 | 3 - 5 3 2 - 1 2 | 3 5 6 5 3 2 1 6, | 5,~ - - - 5, 6, 1 2 |
       5 - 5 6 1' - 6 5 | 2' - 1' 6 1' - 6 5 | 3 5 6 1' 6 5 3 2 | 5~ - - - - - 0 0 |
       1' - 1' 6 5 - 6 1' | 2' - 2' 1' 6 - 5 - | 3 5 3 2 1 - 2 3 | 5~ - - - 6 - 1' - |
       2' - 1' 6 5 6 1' 2' | 3' - 2' 1' 6 - 5 - | 6 5 3 2 1 2 3 5 | 5~ - - - 5,_6, 1 2 3`,
      `1' - - - 6 - - - | 5 - - - 2 - - - | 1' - - - 6 - - - | 5 - - - - - 0 0 |
       1' - - - 6 - - - | 2' - - - 1' - - - | 6 - - - 5 - - - | 5 - - - - - 0 0 |
       3' - - - 2' - - - | 2' - - - 1' - - - | 6 - - - 1' - - - | 5 - - - - - - - |
       2' - - - 1' - - - | 1' - - - 6 - - - | 6 - - - 5 - - - | 5 - - - - - 0 0`,
      seq({ C: "5, - 5, 5, 2 - 5, 5,", F: "1 - 1 1 5 - 1 1", D: "6, - 6, 6, 3 - 6, 6,", G: "2 - 2 2 6 - 2 2" },
        'C F D C C G F C F G D C G F D C'),
      rep(cat('Kc h s h k k s h | K h s h k h s k', 'K h s h k k s h | K h s h k h s k',
        'K h s h k k s h | K h s h k h s k', 'K h s h k k s h | K k s k s_s s_s S S'), 2)
    ]
  };

  T['war-summer'] = {
    bpm: 144, key: 70, ins: ['pipa', 'dizi', 'bass', 'kit'], oct: [0, -12, -24], rev: 0.15,
    v: [
      `2 - 2_2 3 5 - 3 2 | 1 - 6, 1 2 - - - | 5 - 5_5 6 1' - 6 5 | 3 - 5 3 2 - - - |
       2' - 2'_2' 1' 6 - 5 6 | 1' - 6 5 3 - 5 - | 6 5 3 2 1 2 3 5 | 2~ - - - - - 0 0 |
       5 - 6 1' 2' - 1' 6 | 5 - 3 5 6 - - - | 5 - 6 1' 2' - 3' 2' | 1'~ - - - 6 - 5 - |
       3 - 5 6 5 3 2 1 | 2 - 3 5 3 - - - | 1 - 2 3 5 - 3 5 | 2~ - - - - - 1 6,`,
      `5 - - - 6 - - - | 5 - - - 3 - - - | 3 - - - 5 - - - | 6 - - - 5 - - - |
       5 - - - 6 - - - | 3 - - - 2 - - - | 1 - - - 3 - - - | 2 - - - - - 0 0 |
       3 - - - 5 - - - | 1 - - - 3 - - - | 3 - - - 5 - - - | 6 - - - 5 - - - |
       5 - - - 3 - - - | 6 - - - 5 - - - | 3 - - - 5 - - - | 6 - - - 5 - - -`,
      seq({ C: "2 2 6 2 2 2 6 2", B: "1 1 5 1 1 1 5 1", F: "5, 5, 2 5, 5, 5, 2 5,", G: "6, 6, 3 6, 6, 6, 3 6," },
        'C B F C C B G C F B F G B C B C'),
      rep(cat('Kc w s w k w_w s w | K w s k t w s t', 'K w s w k w_w s w | K w s k t w s t',
        'K w s w k w_w s w | K w s k t w s t', 'K w s w k w_w s w | K t t s t_t s_s T S'), 2)
    ]
  };

  T['war-autumn'] = {
    bpm: 126, key: 67, ins: ['pipa', 'erhu', 'bass', 'kit'], oct: [0, -12, -24], rev: 0.2,
    v: [
      `6, - 6, 1 2 - 3 2 | 1 - 6, 5, 6, - - - | 3 - 3 5 6 - 5 3 | 2 - 3 2 1 - 6, - |
       6 - 6 5 6 1' 2' 1' | 6 - 5 3 5 - - - | 3 5 6 5 3 2 1 2 | 6,~ - - - - - 0 0 |
       3 - - 5 6 - 1' 6 | 5 - 3 5 6 - - - | 2' - 1' 6 5 - 3 5 | 6~ - - - - - 0 0 |
       1' - 6 5 3 - 2 3 | 5 - 3 2 1 - 6, - | 1 - 2 3 2 1 6, 5, | 6,~ - - - 0 0 3, 5,`,
      `6 - - - 3 - - - | 3 - - - 2 - - - | 6 - - - 1' - - - | 6 - - - 5 - - - |
       3' - - - 2' - - - | 1' - - - 2' - - - | 6 - - - 5 - - - | 6 - - - - - 0 0 |
       6 - - - 1' - - - | 1' - - - 6 - - - | 2' - - - 6 - - - | 3' - - - 2' - 1' - |
       1' - - - 6 - - - | 5 - - - 6 - - - | 2' - - - 6 - - - | 6 - - - - - 0 0`,
      seq({ E: "6, - - 6, 3 - 6, -", D: "5, - - 5, 2 - 5, -", A: "2 - - 2 6 - 2 -", G: "1 - - 1 5 - 1 -" },
        'E D E A E G D E E G A E G D A E'),
      rep(cat('Kc . s h k . s h | K k s h k . s g', 'K . s h k . s h | K k s h k . s g',
        'K . s h k . s h | K k s h k . s g', 'K . s h k . s h | K . s s K k S_S S'), 2)
    ]
  };

  T['war-winter'] = {
    bpm: 116, key: 63, ins: ['pipa', 'erhu', 'bass', 'kit'], oct: [0, -12, -24], rev: 0.25,
    v: [
      `6, - 6, - 1 - 2 - | 3 - 2 1 6, - - - | 6, - 6, - 1 - 2 3 | 5 - 3 2 3 - - - |
       6 - - 5 3 - 2 1 | 2 - 3 2 1 - 6, - | 1 - 2 3 5 3 2 1 | 6,~ - - - - - 0 0 |
       3 - 3 5 6 - 6 - | 1' - 6 5 6 - - - | 3 - 3 5 6 - 1' 2' | 3'~ - - - 2' - 1' - |
       6 - 5 3 5 - 6 5 | 3 - 2 1 2 - - - | 3 - 2 1 6, - 5, 3, | 6,~ - - - - - 0 0`,
      `3 - - - - - - - | 1 - - - 6, - - - | 3 - - - - - - - | 5 - - - 3 - - - |
       6 - - - 5 - - - | 5 - - - 3 - - - | 3 - - - 5 - - - | 3 - - - - - 0 0 |
       6 - - - - - - - | 6 - - - 5 - - - | 6 - - - 1' - - - | 1' - - - 6 - 5 - |
       3 - - - 5 - - - | 5 - - - 3 - - - | 1 - - - 2 - - - | 3 - - - - - 0 0`,
      seq({ C: "6, - - 6, 6, - 3 -", B: "5, - - 5, 5, - 2 -", E: "1 - - 1 1 - 5 -", F: "2 - - 2 2 - 6 -" },
        'C C C B F B E C C F C E C B E C'),
      rep(cat('Ko . . k s . k . | K . k . s . k k', 'K . . k s . k . | K . k . s . k k',
        'K . . k s . k . | K . k . s . k k', 'K . . k s . k . | K k K k S_S S_S K_K K_K'), 2)
    ]
  };

  // Triumphant and warm: Eb gong mode. Zheng tune, dizi solo, then the dizi doubles it high.
  var endA = `5, - 1 2 3 - 5 - | 6 - 5 3 5 - - - | 6 - 1' 6 5 3 2 3 | 5 - - - 3 - 5 - |
     6 - 1' 2' 3' - 2' 1' | 6 - 1' 6 5 - - - | 3 - 5 6 5 3 2 3 | 1 - - - - - 0 0`;
  var endArp = { E: "1, 5, 1 3 5 3 1 5,", F: "2, 6, 2 3 6 3 2 6,",
    C: "6,, 3, 6, 1 3 1 6, 3,", B: "5,, 2, 5, 6, 2 6, 5, 2," };
  var endBass = { E: "1 - - 5, 1 - 5, -", F: "2 - - 6, 2 - 6, -", C: "6, - - 3 6, - 3 -", B: "5, - - 2 5, - 2 -" };
  var endBassA = `1 - - 5, 1 - 5, - | 6, - - 6, 1 - 6, - | 6, - - 3 6, - 3 - | 5, - - 2 5, - 2 - |
     1 - - 5, 1 - 5, - | 6, - - 3 6, - 3 - | 5, - - 2 5, - 2 - | 1 - - 5, 1 - - -`;
  T.ending = {
    bpm: 88, key: 63, ins: ['zheng', 'dizi', 'bass', 'kit'], oct: [0, 0, -12], rev: 0.32,
    v: [
      cat(endA, 'v5 ' + seq(endArp, 'E F C B E F B E') + ' v8', endA),
      cat(`1' - - - 2' - - - | 3' - - - 2' - - - | 1' - - - 6 - - - | 5 - - - 6 - 1' - |
           3' - - - 5' - - - | 3' - - - 2' - - - | 1' - - - 6 - - - | 1' - - - - - 0 0`,
        `3 - - 5 6 - 1' - | 2' - 1' 6 1' - - - | 6 - 5 3 5 - 6 1' | 5 - - - - - - - |
         3 - 5 6 1' - 2' 3' | 2' - 1' 6 5 - 6 - | 1' - 6 5 3 - 2 3 | 1 - - - - - - -`,
        '> v7 ' + endA + ' v8 <'),
      cat(endBassA, seq(endBass, 'E F C B E F B E'), endBassA),
      rep(cat('Kc . h . s . h . | K . h k s . h .', 'K . h . s . h . | K . h k s . h .',
        'K . h . s . h . | K . h k s . h .', 'K . h . s . h . | K . . . g . k_k k_k'), 3)
    ]
  };

  // Liangshan Marsh: the outlaws' own theme, played on turns in the marsh fortress. D shang mode,
  // zheng over reeds of dizi, a rocking bass like a boat on the water.
  T.liangshan = {
    bpm: 96, key: 62, ins: ['zheng', 'dizi', 'bass', 'kit'], oct: [0, 12, -24], rev: 0.34,
    v: [
      `6, 1 2 3 5 - 3 5 | 6 - 5 6 1' - - - | 2' 1' 6 5 6 - 5 3 | 2 - 3 5 3 - - - |
       5 - 6 1' 2' - 1' 6 | 5 - 3 5 6 - 5 3 | 2 - 3 2 1 - 6, 1 | 2~ - - - - - 0 0`,
      `0 0 0 0 0 0 0 0 | 3 - - - 5 - - - | 6 - - - 5 - - - | 6 - - - 5 - - - |
       2 - - - 3 - - - | 2 - - - 1 - - - | 6, - - - 1 - - - | 2 - - - - - 0 0`,
      `6, - - 3 6, - 3 - | 5, - - 2 5, - 2 - | 2 - - 6, 2 - 6, - | 5, - - 2 5, - 2 - |
       1 - - 5, 1 - 5, - | 6, - - 3 6, - 3 - | 5, - - 2 5, - 2 - | 2 - - 6, 2 - - -`,
      cat(rep('k . h . w . h . | k . h k w . h h', 3), 'k . h . w . h . | k . . . g . . .')
    ]
  };

  // After the battle: counting the fallen and deciding on prisoners. F, quiet zheng and erhu.
  T.aftermath = {
    bpm: 80, key: 65, ins: ['zheng', 'erhu', 'bass', 'kit'], oct: [0, -12, -24], rev: 0.38,
    v: [
      `3 - 5 6 5 3 2 - | 1 - 2 3 2 - - - | 5 - 6 1' 6 5 3 - | 2 - 3 2 1 - - - |
       6, - 1 2 3 - 5 3 | 2 - 1 6, 5, - - - | 6, - 1 2 3 5 3 2 | 1 - - - - - 0 0`,
      `1 - - - - - - - | 6, - - - 5, - - - | 3 - - - 1 - - - | 5, - - - 6, - - - |
       1 - - - 3 - - - | 5, - - - 3, - - - | 6, - - - 5, - - - | 1 - - - - - 0 0`,
      `1 - - - 5, - - - | 6, - - - 5, - - - | 1 - - - 5, - - - | 5, - - - 6, - - - |
       6, - - - 1 - - - | 5, - - - 3, - - - | 6, - - - 5, - - - | 1 - - - - - - -`,
      cat(rep('k . . . w . . . | . . . . w . . .', 3), 'k . . . w . . . | . . . . g . . .')
    ]
  };

  // Jingles: play once.
  // Dispatch: an army sets out, to drums and a rising pipa call.
  T.dispatch = {
    bpm: 132, key: 70, loop: false, ins: ['pipa', 'dizi', 'bass', 'kit'], oct: [0, 0, -24], rev: 0.22,
    v: [
      `5, 5, 1 - 2 - 3 - | 5 - 3 2 1 - 2 - | 3 5 6 5 3 2 1 2 | 1~ - - - - - - -`,
      `0 0 0 0 0 0 0 0 | 3 - - - 5 - - - | 6 - - - 5 - - - | 3 - - - - - - -`,
      `1 - 5, - 1 - 5, - | 1 - 5, - 6, - 5, - | 6, - 3, - 5, - 2 - | 1 - - - - - - -`,
      `k . k . k . k_k k_k | K . s . K . s . | K . s . K . s s_s | Kc . . . g . . .`
    ]
  };

  T.victory = {
    bpm: 120, key: 72, loop: false, ins: ['pipa', 'dizi', 'bass', 'kit'], oct: [0, 0, -24], rev: 0.3,
    v: [
      `5, 1 3 5 3 5 6 1' | 2' - 3' 2' 1' - 6 1' | 1'~ - - - - - - -`,
      `0 0 0 0 0 0 0 0 | 5 - - - 3 - 5 - | 3 - - - - - - -`,
      `1 - 5, - 1 - 5, - | 6, - - - 5, - - - | 1 - - - - - - -`,
      `k . k . k k k_k k_k | K . s . K . s s_s | Kc . . . g . . .`
    ]
  };

  T.defeat = {
    bpm: 84, key: 72, loop: false, ins: ['zheng', 'erhu', 'bass', 'kit'], oct: [0, -12, -24], rev: 0.35,
    v: [
      `3' - 2' 1' 6 - 5 - | 3 - - - 6, - - -`,
      `6 - - - 5 - 3 - | 2 - 1 - 6, - - -`,
      `6, - - - 5, - - - | 3, - - - 6, - - -`,
      `k . . . k . . . | o . . . . . . .`
    ]
  };

  T.edict = {
    bpm: 100, key: 63, loop: false, ins: ['pipa', 'dizi', 'bass', 'kit'], oct: [0, -12, -24], rev: 0.32,
    v: [
      `0 0 5, 1 2 - 1 2 | 5~ - - - - - - -`,
      `0 0 0 0 5 - 6 - | 5 - - - - - - -`,
      `5, - - - 1 - 2 - | 5, - - - - - - -`,
      `o . . . k . k_k k_k | K . . . g . . .`
    ]
  };

  T.gameover = {
    bpm: 76, key: 65, loop: false, ins: ['zheng', 'erhu', 'bass', 'kit'], oct: [0, 0, -24], rev: 0.4,
    v: [
      `6, 3 6 - 5 - 3 - | 6, - - - - - - -`,
      `3 - 2 1 2 - 1 6, | 6, - - - - - - -`,
      `6, - - - 1 - - - | 6, - - - - - - -`,
      `k . . . . . . . | o . . . . . . .`
    ]
  };

  // ---------------------------------------------------------------- pattern compiler
  function warnBar(name, v, bar, got, want) {
    if (root.console) root.console.warn('BK.Music: ' + name + ' voice ' + v + ' bar ' + bar + ' has ' + got + ' steps, expected ' + want);
  }

  function accent(step, sub, d) {
    if (sub) return 0.85;
    var b = step % d.bar;
    return b === 0 ? 1.1 : (b % d.spb === 0 ? 0.97 : 0.86);
  }

  function parseVoice(src, d, v, name) {
    var kit = d.ins[v] === 'kit', base = d.key + (d.oct[v] || 0);
    var toks = String(src || '').split(/\s+/), evs = [], step = 0, barStart = 0, bar = 0;
    var last = null, shift = 0, vel = 0.8;
    for (var i = 0; i < toks.length; i++) {
      var tk = toks[i];
      if (!tk) continue;
      if (tk === '|') {
        if (step - barStart !== d.bar) warnBar(name, v, bar, step - barStart, d.bar);
        barStart = step; bar++;
        continue;
      }
      if (tk === '>') { shift += 12; continue; }
      if (tk === '<') { shift -= 12; continue; }
      if (/^v\d+$/.test(tk)) { vel = parseInt(tk.slice(1), 10) / 10; continue; }
      if (tk === '-') { if (last) last.len += 1; step++; continue; }
      var parts = tk.split('_'), n = parts.length;
      for (var j = 0; j < n; j++) {
        var p = parts[j], off = j / n;
        if (kit) {
          for (var c = 0; c < p.length; c++) {
            if (KIT.indexOf(p.charAt(c)) >= 0) evs.push({ s: step, o: off, d: p.charAt(c), vel: vel * accent(step, j, d) });
          }
          continue;
        }
        if (p === '-') { if (last) last.len += 1 / n; continue; }
        var m = NOTE_RE.exec(p);
        if (!m) {
          if (p !== '0' && p !== '.' && root.console) root.console.warn('BK.Music: ' + name + ' voice ' + v + ' bad token ' + p);
          last = null;
          continue;
        }
        var oc = 0;
        for (var q = 0; q < m[4].length; q++) oc += m[4].charAt(q) === "'" ? 12 : -12;
        var midi = base + shift + oc + DEG[+m[3] - 1] + (m[2] === '#' ? 1 : (m[2] === 'b' ? -1 : 0));
        last = { s: step, o: off, len: 1 / n, m: midi, vel: vel * accent(step, j, d), sl: !!m[1], tr: !!m[5] };
        evs.push(last);
      }
      step++;
    }
    if (step > barStart && step - barStart !== d.bar) warnBar(name, v, bar, step - barStart, d.bar);
    return { evs: evs, len: step };
  }

  function compile(name) {
    if (compiled[name]) return compiled[name];
    var d = T[name];
    d.spb = d.spb || 2; d.bar = d.bar || 8; d.lvl = d.lvl || [1, 1, 1, 1];
    if (d.loop === undefined) d.loop = true;
    var voices = [], len = 0, v;
    for (v = 0; v < 4; v++) {
      voices.push(parseVoice(d.v[v], d, v, name));
      if (voices[v].len > len) len = voices[v].len;
    }
    var steps = new Array(len);
    for (v = 0; v < 4; v++) {
      var r = voices[v];
      if (!r.len) continue;
      for (var at = 0; at < len; at += r.len) {
        for (var i = 0; i < r.evs.length; i++) {
          var e = r.evs[i], s = at + e.s;
          if (s >= len) break;
          (steps[s] = steps[s] || []).push({ v: v, o: e.o, len: e.len, m: e.m, d: e.d, vel: e.vel, sl: e.sl, tr: e.tr });
        }
      }
    }
    return (compiled[name] = { d: d, steps: steps, len: len, stepDur: 60 / d.bpm / d.spb });
  }

  // ---------------------------------------------------------------- audio graph
  function makeWave(amps) {
    var re = new Float32Array(amps.length + 1), im = new Float32Array(amps.length + 1);
    for (var i = 0; i < amps.length; i++) im[i + 1] = amps[i];
    return ctx.createPeriodicWave(re, im);
  }

  function makeIR(sec, decay) {
    var rate = ctx.sampleRate, len = Math.floor(rate * sec), buf = ctx.createBuffer(2, len, rate);
    for (var c = 0; c < 2; c++) {
      var data = buf.getChannelData(c), lp = 0;
      for (var i = 0; i < len; i++) {
        lp += (Math.random() * 2 - 1 - lp) * 0.4;
        data[i] = lp * Math.pow(1 - i / len, decay);
      }
    }
    return buf;
  }

  function build() {
    master = ctx.createGain();
    master.gain.value = enabled ? volume : 0;
    var comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -10; comp.knee.value = 8; comp.ratio.value = 4;
    comp.attack.value = 0.004; comp.release.value = 0.2;
    master.connect(comp); comp.connect(ctx.destination);

    musicBus = gain(0.5); musicBus.connect(master);
    sfxBus = gain(1); sfxBus.connect(master);

    revIn = gain(1);
    var conv = ctx.createConvolver(), revOut = gain(0.7);
    conv.buffer = makeIR(1.6, 3);
    chain([revIn, conv, revOut, master]);
    sfxWet = gain(1); sfxWet.connect(sfxBus);
    var wetSend = gain(0.5); sfxWet.connect(wetSend); wetSend.connect(revIn);

    noiseBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 2), ctx.sampleRate);
    var nd = noiseBuf.getChannelData(0);
    for (var i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

    if (ctx.createPeriodicWave) {
      waves = {
        pluck: makeWave([1, 0.7, 0.55, 0.42, 0.3, 0.26, 0.18, 0.15, 0.1, 0.08, 0.06, 0.05]),
        zheng: makeWave([1, 0.5, 0.33, 0.2, 0.14, 0.08, 0.05, 0.03]),
        flute: makeWave([1, 0.22, 0.08, 0.04]),
        bass: makeWave([1, 0.55, 0.3, 0.18, 0.1, 0.06])
      };
    }
  }

  var WAVE_FALLBACK = { pluck: 'square', zheng: 'triangle', flute: 'sine', bass: 'triangle' };
  function osc(type, f, t) {
    var o = ctx.createOscillator();
    if (waves && waves[type]) o.setPeriodicWave(waves[type]);
    else o.type = WAVE_FALLBACK[type] || type;
    o.frequency.setValueAtTime(f, t);
    return o;
  }
  function gain(v) { var g = ctx.createGain(); g.gain.value = v; return g; }
  function filter(type, f, q) {
    var b = ctx.createBiquadFilter();
    b.type = type; b.frequency.value = f; b.Q.value = q;
    return b;
  }
  function noise(t, dur) {
    var s = ctx.createBufferSource();
    s.buffer = noiseBuf; s.loop = true;
    s.start(t, Math.random() * 1.5); s.stop(t + dur);
    return s;
  }
  function chain(list) { for (var i = 0; i < list.length - 1; i++) list[i].connect(list[i + 1]); return list; }
  // Disconnect a note's nodes once its source has finished.
  function cleanup(src, nodes) {
    src.onended = function () {
      src.onended = null;
      for (var i = 0; i < nodes.length; i++) { try { nodes[i].disconnect(); } catch (e) { /* already detached */ } }
    };
  }

  // ---------------------------------------------------------------- instruments
  var INST = {
    pipa: { kind: 'pluck', wave: 'pluck', gain: 0.3, decay: 0.16, bright: 10, floor: 2.5, ftau: 0.07, hold: 0, rel: 0.03, max: 1.4 },
    zheng: { kind: 'pluck', wave: 'zheng', gain: 0.3, decay: 0.42, bright: 7, floor: 1.8, ftau: 0.14, hold: 0.25, rel: 0.12, max: 2.8 },
    dizi: { kind: 'wind', wave: 'flute', gain: 0.13, att: 0.03, vib: 14, rate: 5.4, rel: 0.05, chiff: 0.5 },
    xiao: { kind: 'wind', wave: 'flute', gain: 0.15, att: 0.08, vib: 9, rate: 4.6, rel: 0.12, lp: 3, chiff: 0.2 },
    erhu: { kind: 'bow', gain: 0.1, att: 0.05, vib: 22, rate: 5.8, rel: 0.07 },
    bass: { kind: 'bass', wave: 'bass', gain: 0.32 }
  };

  function playNote(name, dest, t, midi, dur, vel, slide, trem, stepDur) {
    var P = INST[name], f = mtof(midi);
    if (P.kind === 'pluck') pluck(P, dest, t, f, dur, vel, slide, trem, stepDur || 0.15);
    else if (P.kind === 'wind' || P.kind === 'bow') sustain(P, dest, t, f, dur, vel, slide);
    else bassNote(P, dest, t, f, dur, vel);
  }

  // Pipa / guzheng: bright wave through a closing lowpass, fast decay; tremolo re-plucks.
  function pluck(P, dest, t, f, dur, vel, slide, trem, stepDur) {
    var o = osc(P.wave, slide ? f * 0.89 : f, t), fl = filter('lowpass', 1000, 1.1), g = gain(0);
    if (slide) o.frequency.exponentialRampToValueAtTime(f, t + 0.07);
    var hi = Math.min(f * P.bright, 9000), lo = Math.min(Math.max(f * P.floor, 450), hi), pk = vel * P.gain;
    var end = t + dur + P.hold, stopAt = end + P.rel * 6, hits = [t];
    if (trem && dur > stepDur * 1.5) {
      var iv = stepDur / Math.max(2, Math.round(stepDur / 0.075));
      for (var h = t + iv; h < t + dur - iv * 0.5; h += iv) hits.push(h);
    } else stopAt = Math.min(stopAt, t + P.max);
    g.gain.setValueAtTime(0, t);
    fl.frequency.setValueAtTime(hi, t);
    for (var i = 0; i < hits.length; i++) {
      var ht = hits[i];
      g.gain.setTargetAtTime(i ? pk * (0.55 + Math.random() * 0.2) : pk, ht, 0.0015);
      g.gain.setTargetAtTime(0, ht + 0.005, i ? P.decay * 0.6 : P.decay);
      if (i) fl.frequency.setTargetAtTime(hi * 0.8, ht, 0.002);
      fl.frequency.setTargetAtTime(lo, ht + 0.004, P.ftau);
    }
    if (end < stopAt) g.gain.setTargetAtTime(0, end, P.rel);
    chain([o, fl, g, dest]);
    o.start(t); o.stop(stopAt);
    cleanup(o, [o, fl, g]);
  }

  // Dizi / xiao (flute wave, breathy chiff) and erhu (bowed sawtooth): held notes with vibrato.
  function sustain(P, dest, t, f, dur, vel, slide) {
    var bow = P.kind === 'bow', pk = vel * P.gain;
    var end = t + Math.max(dur - 0.02, 0.06), stopAt = end + P.rel * 6;
    var o = bow ? ctx.createOscillator() : osc(P.wave, slide ? f * 0.92 : f, t);
    if (bow) {
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(f * (slide ? 0.89 : 0.97), t);
      o.frequency.setTargetAtTime(f, t, slide ? 0.05 : 0.025);
    } else if (slide) o.frequency.exponentialRampToValueAtTime(f, t + 0.09);
    var g = gain(0), lfo = ctx.createOscillator(), lg = gain(0), nodes = [o, g, lfo, lg];
    lfo.frequency.value = P.rate;
    lg.gain.setValueAtTime(0, t);
    lg.gain.setTargetAtTime(P.vib, t + 0.15, 0.2);
    lfo.connect(lg); lg.connect(o.detune);
    g.gain.setValueAtTime(0, t);
    g.gain.setTargetAtTime(pk, t, P.att);
    if (t + P.att * 4 < end) g.gain.setTargetAtTime(pk * 0.8, t + P.att * 4, 0.4);
    g.gain.setTargetAtTime(0, end, P.rel);
    var lp = bow ? clamp(f * 3.5, 700, 3400) : (P.lp ? clamp(f * P.lp, 700, 6000) : 0);
    if (lp) {
      var fl = filter('lowpass', lp, bow ? 2.2 : 0.7);
      chain([o, fl, g]); nodes.push(fl);
    } else o.connect(g);
    g.connect(dest);
    o.start(t); lfo.start(t); o.stop(stopAt); lfo.stop(stopAt);
    cleanup(o, nodes);
    if (P.chiff && dur > 0.12) {
      var n = noise(t, 0.09), bp = filter('bandpass', Math.min(f * 2, 8000), 1.2), ng = gain(0);
      ng.gain.setValueAtTime(0, t);
      ng.gain.setTargetAtTime(pk * P.chiff, t, 0.004);
      ng.gain.setTargetAtTime(0, t + 0.012, 0.02);
      chain([n, bp, ng, dest]);
      cleanup(n, [n, bp, ng]);
    }
  }

  function bassNote(P, dest, t, f, dur, vel) {
    var o = osc(P.wave, f, t), fl = filter('lowpass', 800, 1), g = gain(0);
    var pk = vel * P.gain, end = t + Math.max(dur - 0.015, 0.05);
    fl.frequency.setValueAtTime(Math.min(f * 10, 2600), t);
    fl.frequency.setTargetAtTime(clamp(f * 5, 320, 1200), t + 0.005, 0.09);
    g.gain.setValueAtTime(0, t);
    g.gain.setTargetAtTime(pk, t, 0.003);
    g.gain.setTargetAtTime(pk * 0.55, t + 0.012, 0.15);
    g.gain.setTargetAtTime(0, end, 0.03);
    chain([o, fl, g, dest]);
    o.start(t); o.stop(end + 0.2);
    cleanup(o, [o, fl, g]);
  }

  // ---------------------------------------------------------------- percussion
  function thump(dest, t, f0, f1, sweep, amp, tau) {
    var o = ctx.createOscillator(), g = gain(0);
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + sweep);
    g.gain.setValueAtTime(amp, t);
    g.gain.setTargetAtTime(0, t + 0.015, tau);
    chain([o, g, dest]);
    o.start(t); o.stop(t + 0.03 + tau * 6);
    cleanup(o, [o, g]);
  }

  function hiss(dest, t, type, f, q, amp, tau, len) {
    var n = noise(t, len), fl = filter(type, f, q), g = gain(0);
    g.gain.setValueAtTime(amp, t);
    g.gain.setTargetAtTime(0, t + 0.002, tau);
    chain([n, fl, g, dest]);
    cleanup(n, [n, fl, g]);
  }

  function wood(dest, t, v) {
    var o = ctx.createOscillator(), g = gain(0);
    o.frequency.setValueAtTime(1450, t);
    o.frequency.exponentialRampToValueAtTime(1150, t + 0.03);
    g.gain.setValueAtTime(v * 0.2, t);
    g.gain.setTargetAtTime(0, t + 0.002, 0.016);
    chain([o, g, dest]);
    o.start(t); o.stop(t + 0.12);
    cleanup(o, [o, g]);
  }

  // Small opera gong: its pitch bends upward after the strike.
  function gongSmall(dest, t, v) {
    var o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), g2 = gain(0.45), g = gain(0);
    o1.frequency.setValueAtTime(610, t); o1.frequency.setTargetAtTime(700, t + 0.02, 0.15);
    o2.frequency.setValueAtTime(897, t); o2.frequency.setTargetAtTime(1029, t + 0.02, 0.15);
    g.gain.setValueAtTime(0, t);
    g.gain.setTargetAtTime(v * 0.13, t, 0.002);
    g.gain.setTargetAtTime(0, t + 0.01, 0.3);
    o1.connect(g); o2.connect(g2); g2.connect(g); g.connect(dest);
    o1.start(t); o2.start(t); o1.stop(t + 1.9); o2.stop(t + 1.9);
    cleanup(o1, [o1, o2, g2, g]);
    hiss(dest, t, 'bandpass', 3000, 1, v * 0.05, 0.02, 0.1);
  }

  // Large gong: low inharmonic partials sagging in pitch, with a swell of filtered noise.
  function gongBig(dest, t, v) {
    var g = gain(0), nodes = [g], parts = [[1, 1], [1.52, 0.5], [2.31, 0.3], [3.1, 0.15]], first = null;
    g.gain.setValueAtTime(0, t);
    g.gain.setTargetAtTime(v * 0.26, t, 0.01);
    g.gain.setTargetAtTime(0, t + 0.08, 1.1);
    for (var i = 0; i < parts.length; i++) {
      var o = ctx.createOscillator(), pg = gain(parts[i][1]), f = 96 * parts[i][0];
      o.frequency.setValueAtTime(f, t);
      o.frequency.setTargetAtTime(f * 0.97, t + 0.05, 0.8);
      o.connect(pg); pg.connect(g);
      o.start(t); o.stop(t + 5.5);
      nodes.push(o, pg);
      if (!first) first = o;
    }
    g.connect(dest);
    cleanup(first, nodes);
    var n = noise(t, 2.6), bp = filter('bandpass', 380, 0.8), ng = gain(0);
    ng.gain.setValueAtTime(0, t);
    ng.gain.setTargetAtTime(v * 0.1, t, 0.08);
    ng.gain.setTargetAtTime(0, t + 0.25, 0.7);
    chain([n, bp, ng, dest]);
    cleanup(n, [n, bp, ng]);
  }

  function drum(c, t, vel, dest) {
    var v = vel * (c >= 'A' && c <= 'Z' ? 1.3 : 1);
    switch (c.toLowerCase()) {
      case 'k': thump(dest, t, 150, 50, 0.17, v * 0.6, 0.13); break;
      case 't': thump(dest, t, 250, 150, 0.12, v * 0.38, 0.08); break;
      case 's':
        hiss(dest, t, 'bandpass', 2400, 0.8, v * 0.3, 0.05, 0.3);
        thump(dest, t, 220, 160, 0.05, v * 0.14, 0.035);
        break;
      case 'h': hiss(dest, t, 'highpass', 7500, 0.6, v * 0.09, 0.012, 0.08); break;
      case 'w': wood(dest, t, v); break;
      case 'c': hiss(dest, t, 'bandpass', 5500, 0.45, v * 0.16, 0.3, 1.6); break;
      case 'g': gongSmall(dest, t, v); break;
      case 'o': gongBig(dest, t, v); break;
    }
  }

  // ---------------------------------------------------------------- sequencer
  function startSong(w, after) {
    var c = compile(w.name), d = c.d, now = ctx.currentTime;
    var out = gain(1), send = gain(d.rev || 0.25), nodes = [out, send], ch = [];
    for (var i = 0; i < 4; i++) {
      var g = gain(d.lvl[i]);
      nodes.push(g);
      if (ctx.createStereoPanner) {
        var p = ctx.createStereoPanner();
        p.pan.value = PAN[i];
        g.connect(p); p.connect(out); nodes.push(p);
      } else g.connect(out);
      ch.push(g);
    }
    out.connect(musicBus); out.connect(send); send.connect(revIn);
    var s = { name: w.name, want: w, c: c, loop: w.loop, out: out, ch: ch, nodes: nodes,
      step: 0, next: now + (after ? 0.22 : 0.05), done: false, endAt: 0, killAt: 0 };
    songs.push(s);
    cur = s;
    if (!timer) timer = setInterval(tick, TICK_MS);
    run(s, now, now + LOOKAHEAD);
  }

  function fadeOut(s, dur) {
    if (s.killAt) return;
    var now = ctx.currentTime, g = s.out.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(0, now + dur);
    s.killAt = now + dur + 0.05;
  }

  function dispose(s) {
    for (var i = 0; i < s.nodes.length; i++) { try { s.nodes[i].disconnect(); } catch (e) { /* ignore */ } }
    s.nodes = [];
  }

  function finished(s) {
    if (cur === s) cur = null;
    if (want === s.want) {
      want = null;
      if (s.want.onEnd) s.want.onEnd(s.name);
    }
  }

  function run(s, now, ahead) {
    var c = s.c, sd = c.stepDur;
    if (s.next < now - 0.2) {
      // Timer starved (background tab): skip ahead rather than burst out stale notes.
      var skip = Math.ceil((now - s.next) / sd);
      s.step += skip; s.next += skip * sd;
      if (s.step >= c.len) {
        if (s.loop) s.step %= c.len;
        else { s.done = true; s.endAt = now; return; }
      }
    }
    while (s.next < ahead) {
      if (s.step >= c.len) {
        if (!s.loop) { s.done = true; s.endAt = s.next + TAIL; return; }
        s.step = 0;
      }
      var evs = c.steps[s.step];
      if (evs) {
        for (var i = 0; i < evs.length; i++) {
          var e = evs[i], t = s.next + e.o * sd, ins = c.d.ins[e.v];
          if (ins === 'kit') drum(e.d, t, e.vel, s.ch[e.v]);
          else playNote(ins, s.ch[e.v], t, e.m, e.len * sd, e.vel, e.sl, e.tr, sd);
        }
      }
      s.step++;
      s.next += sd;
    }
  }

  function tick() {
    if (!ctx) return;
    try {
      var now = ctx.currentTime;
      var ahead = now + (root.document && root.document.hidden ? HIDDEN_AHEAD : LOOKAHEAD);
      for (var i = songs.length - 1; i >= 0; i--) {
        var s = songs[i];
        if (s.killAt && now >= s.killAt) { dispose(s); songs.splice(i, 1); continue; }
        if (s.done) {
          if (now >= s.endAt) { dispose(s); songs.splice(i, 1); finished(s); }
          continue;
        }
        run(s, now, ahead);
      }
    } catch (e) {
      if (root.console) root.console.warn('BK.Music: scheduler stopped', e);
      songs.forEach(dispose);
      songs = []; cur = null;
    }
    if (!songs.length && timer) { clearInterval(timer); timer = null; }
  }

  // ---------------------------------------------------------------- sound effects
  function tone(dest, t, type, f0, f1, dur, amp, lp) {
    var o = ctx.createOscillator(), g = gain(0), list = [o];
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.setTargetAtTime(amp, t, 0.003);
    g.gain.setTargetAtTime(0, t + dur * 0.35, dur * 0.22);
    if (lp) list.push(filter('lowpass', lp, 0.8));
    list.push(g, dest);
    chain(list);
    o.start(t); o.stop(t + dur * 1.6 + 0.05);
    cleanup(o, list.slice(0, -1));
  }

  function bell(dest, t, midi, dur, amp) {
    var f = mtof(midi), o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), g2 = gain(0.25), g = gain(0);
    o1.frequency.setValueAtTime(f, t);
    o2.frequency.setValueAtTime(f * 2.01, t);
    g.gain.setValueAtTime(0, t);
    g.gain.setTargetAtTime(amp, t, 0.002);
    g.gain.setTargetAtTime(0, t + 0.01, dur * 0.35);
    o1.connect(g); o2.connect(g2); g2.connect(g); g.connect(dest);
    o1.start(t); o2.start(t); o1.stop(t + dur * 2 + 0.05); o2.stop(t + dur * 2 + 0.05);
    cleanup(o1, [o1, o2, g2, g]);
  }

  var SFX = {
    click: function (t) { tone(sfxBus, t, 'square', 1800, 1400, 0.025, 0.09, 3500); },
    select: function (t) {
      playNote('pipa', sfxBus, t, 79, 0.07, 0.75);
      playNote('pipa', sfxBus, t + 0.065, 84, 0.16, 0.8);
    },
    error: function (t) {
      tone(sfxBus, t, 'square', 220, 208, 0.1, 0.13, 1200);
      tone(sfxBus, t + 0.12, 'square', 165, 156, 0.2, 0.13, 900);
    },
    coin: function (t) {
      bell(sfxBus, t, 95, 0.12, 0.14);
      bell(sfxBus, t + 0.07, 100, 0.4, 0.14);
      drum('h', t, 0.8, sfxBus);
    },
    hit: function (t) {
      drum('K', t, 0.9, sfxBus);
      drum('S', t, 0.9, sfxBus);
      tone(sfxBus, t, 'sawtooth', 320, 70, 0.14, 0.12, 1800);
    },
    arrow: function (t) {
      var n = noise(t, 0.35), bp = filter('bandpass', 3500, 2.5), g = gain(0);
      bp.frequency.setValueAtTime(4200, t);
      bp.frequency.exponentialRampToValueAtTime(700, t + 0.24);
      g.gain.setValueAtTime(0, t);
      g.gain.setTargetAtTime(0.45, t, 0.05);
      g.gain.setTargetAtTime(0, t + 0.15, 0.035);
      chain([n, bp, g, sfxBus]);
      cleanup(n, [n, bp, g]);
      drum('w', t + 0.23, 0.8, sfxBus);
      drum('t', t + 0.23, 0.5, sfxBus);
    },
    fire: function (t) {
      var n = noise(t, 1.3), lp = filter('lowpass', 300, 0.7), g = gain(0);
      lp.frequency.setValueAtTime(300, t);
      lp.frequency.setTargetAtTime(900, t, 0.2);
      lp.frequency.setTargetAtTime(400, t + 0.5, 0.3);
      g.gain.setValueAtTime(0, t);
      g.gain.setTargetAtTime(0.35, t, 0.08);
      g.gain.setTargetAtTime(0, t + 0.45, 0.25);
      chain([n, lp, g, sfxBus]);
      cleanup(n, [n, lp, g]);
      var c = noise(t, 1.1), hp = filter('highpass', 2500, 0.7), cg = gain(0), times = [];
      for (var i = 0; i < 14; i++) times.push(t + 0.03 + Math.random() * 0.9);
      times.sort(function (a, b) { return a - b; });
      cg.gain.setValueAtTime(0, t);
      for (i = 0; i < times.length; i++) {
        cg.gain.setTargetAtTime(0.15 + Math.random() * 0.25, times[i], 0.001);
        cg.gain.setTargetAtTime(0, times[i] + 0.004, 0.01);
      }
      chain([c, hp, cg, sfxBus]);
      cleanup(c, [c, hp, cg]);
    },
    magic: function (t) {
      var notes = [84, 86, 88, 91, 93, 96, 98];
      for (var i = 0; i < notes.length; i++) bell(sfxWet, t + i * 0.055, notes[i], 0.5, 0.09);
    },
    march: function (t) {
      var hits = [['k', 0], ['k', 0.2], ['s', 0.3], ['k', 0.4], ['s', 0.5], ['s', 0.55], ['K', 0.6], ['c', 0.6]];
      for (var i = 0; i < hits.length; i++) drum(hits[i][0], t + hits[i][1], 0.9, sfxBus);
    },
    victory: function (t) {
      var notes = [72, 76, 79, 84];
      for (var i = 0; i < notes.length; i++) {
        playNote('pipa', sfxBus, t + i * 0.085, notes[i], i === 3 ? 0.7 : 0.1, 0.85, false, i === 3, 0.15);
      }
      drum('K', t + 0.255, 0.9, sfxBus);
      drum('g', t + 0.255, 1, sfxWet);
      drum('c', t + 0.255, 0.6, sfxBus);
    },
    defeat: function (t) {
      playNote('erhu', sfxBus, t, 69, 0.28, 2.2, true);
      playNote('erhu', sfxBus, t + 0.3, 67, 0.28, 2);
      playNote('erhu', sfxBus, t + 0.6, 64, 0.8, 2, true);
      drum('o', t + 0.6, 0.8, sfxWet);
    },
    event: function (t) {
      drum('w', t, 1, sfxBus);
      drum('w', t + 0.09, 0.8, sfxBus);
      playNote('zheng', sfxBus, t + 0.18, 74, 0.2, 1);
      playNote('zheng', sfxBus, t + 0.3, 81, 0.5, 1);
    },
    edict: function (t) {
      drum('o', t, 0.9, sfxWet);
      playNote('pipa', sfxWet, t + 0.05, 74, 0.8, 0.8, false, true, 0.15);
      playNote('pipa', sfxWet, t + 0.05, 79, 0.8, 0.8, false, true, 0.15);
    },
    duel: function (t) {
      var ts = [0, 0.17, 0.31, 0.42, 0.51, 0.58, 0.64, 0.69, 0.73];
      for (var i = 0; i < ts.length; i++) drum('w', t + ts[i], 0.6 + i * 0.05, sfxBus);
      drum('K', t + 0.8, 1, sfxBus);
      drum('C', t + 0.8, 0.8, sfxBus);
      drum('g', t + 0.8, 1, sfxWet);
    }
  };

  // ---------------------------------------------------------------- public API
  function resume() {
    if (!ctx || ctx.state !== 'suspended' || !ctx.resume) return;
    try { var p = ctx.resume(); if (p && p.catch) p.catch(noop); } catch (e) { /* ignore */ }
  }

  // Browsers keep audio suspended until a gesture; retry resume on the next few gestures.
  function armUnlock() {
    if (unlockArmed || !root.addEventListener) return;
    unlockArmed = true;
    var evs = ['pointerdown', 'keydown', 'touchend'];
    var h = function () {
      resume();
      if (ctx.state === 'running') {
        evs.forEach(function (e) { root.removeEventListener(e, h, true); });
        unlockArmed = false;
      }
    };
    evs.forEach(function (e) { root.addEventListener(e, h, true); });
  }

  function init() {
    if (!ctx) {
      var AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return false;
      try { ctx = new AC(); build(); } catch (e) { ctx = null; return false; }
    }
    resume();
    if (ctx.state === 'suspended') armUnlock();
    if (enabled && want && !cur) startSong(want, false);
    return true;
  }

  function play(name, opts) {
    var d = T[name];
    if (!d) return;
    opts = opts || {};
    if (want && want.name === name) return;
    var loop = opts.loop != null ? !!opts.loop : d.loop !== false;
    var w = { name: name, loop: loop, onEnd: typeof opts.onEnd === 'function' ? opts.onEnd : null };
    if (!ctx || !enabled) {
      // Nothing audible: remember looping music for later, let a jingle "finish" at once.
      if (cur && ctx) { fadeOut(cur, FADE); cur = null; }
      want = loop ? w : null;
      if (!loop && w.onEnd) setTimeout(function () { w.onEnd(name); }, 0);
      return;
    }
    var after = !!cur;
    if (cur) { fadeOut(cur, FADE); cur = null; }
    want = w;
    startSong(w, after);
  }

  function stop() {
    want = null;
    if (cur && ctx) fadeOut(cur, FADE);
    cur = null;
  }

  function setEnabled(on) {
    on = !!on;
    if (on === enabled) return;
    enabled = on;
    if (!ctx) return;
    master.gain.setTargetAtTime(on ? volume : 0, ctx.currentTime, 0.04);
    if (!on) {
      if (cur) { fadeOut(cur, 0.15); cur = null; }
      if (want && !want.loop) want = null;
    } else if (want && !cur) startSong(want, false);
  }

  function setVolume(v) {
    volume = clamp(+v || 0, 0, 1);
    if (ctx && enabled) master.gain.setTargetAtTime(volume, ctx.currentTime, 0.03);
  }

  function sfx(name) {
    var fn = SFX[name];
    if (!ctx || !enabled || !fn) return;
    var now = ctx.currentTime;
    if (lastSfx[name] != null && now - lastSfx[name] < 0.035 && now >= lastSfx[name]) return;
    lastSfx[name] = now;
    resume();
    try { fn(now + 0.01); } catch (e) { if (root.console) root.console.warn('BK.Music: sfx ' + name, e); }
  }

  BK.Music = {
    init: init,
    play: play,
    stop: stop,
    setEnabled: setEnabled,
    isEnabled: function () { return enabled; },
    setVolume: setVolume,
    getVolume: function () { return volume; },
    current: function () { return want ? want.name : null; },
    sfx: sfx,
    TRACKS: Object.keys(T),
    SFX: Object.keys(SFX)
  };
})(typeof window !== 'undefined' ? window : globalThis);
