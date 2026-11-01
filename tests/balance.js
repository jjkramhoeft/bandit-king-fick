// Plays many computer-only games and summarises who wins and when.
const BK = require('./load.js');
const headless = require('./headless-io.js');
const W = BK.World;
const runs = +process.argv[2] || 10;
(async () => {
  for (const sc of [1, 2, 3, 4]) {
    let wins = 0, years = [], gfAlive = 0, gfPrefs = 0, edicts = 0, imp = 0;
    for (let i = 0; i < runs; i++) {
      const s = BK.Setup.newGame({ scenarioId: sc, seed: 1000 * sc + i, players: [] });
      await new BK.Game(s, headless()).run();
      if (s.winner != null) { wins++; years.push(s.year); }
      const gfs = s.factions.filter(f => f.kind === 'goodfellow' && f.alive);
      gfAlive += gfs.length;
      gfPrefs += gfs.reduce((a, f) => a + W.factionPrefs(s, f.id).length, 0);
      edicts += s.factions.filter(f => f.edict).length;
      imp += W.factionPrefs(s, s.imperial).length;
    }
    console.log('S' + sc, 'wins', wins + '/' + runs, 'avgYear', years.length ? Math.round(years.reduce((a, b) => a + b) / years.length) : '-',
      'GF alive', (gfAlive / runs).toFixed(1), 'GF prefs', (gfPrefs / runs).toFixed(1), 'edicts', (edicts / runs).toFixed(1), 'imperial prefs', (imp / runs).toFixed(1));
  }
})();
