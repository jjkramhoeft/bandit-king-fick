// Engine tests: run with `node --test tests/`.
const test = require('node:test');
const assert = require('node:assert');
const BK = require('./load.js');
const headless = require('./headless-io.js');
const W = BK.World;

test('map has 49 connected prefectures with sensible borders', () => {
  const g = BK.MapGeo.build();
  const seen = new Set([1]);
  const q = [1];
  while (q.length) for (const n of g.adj[q.shift()]) if (!seen.has(n)) { seen.add(n); q.push(n); }
  assert.strictEqual(seen.size, 49);
  for (let i = 1; i <= 49; i++) {
    assert.ok(g.area[i] > 100, 'prefecture ' + i + ' has area');
    assert.ok(g.adj[i].length >= 1, 'prefecture ' + i + ' has a neighbour');
    for (const n of g.adj[i]) assert.ok(g.adj[n].includes(i), 'adjacency is symmetric');
  }
  assert.ok(g.terrain[BK.MapData.liangshan].lake, 'Liangshan Marsh lies in Yunzhou');
});

test('every scenario starts with 255 characters and every prefecture ruled but the empty ones', () => {
  for (const sc of BK.Scenarios) {
    const s = BK.Setup.newGame({ scenarioId: sc.id, seed: 7, players: [{ key: Object.keys(sc.goodFellows)[0] }] });
    assert.strictEqual(s.chars.length, 255);
    for (const p of s.prefs) {
      if ((sc.empty || []).includes(p.id)) { assert.strictEqual(p.owner, null, sc.title + ': ' + p.name + ' starts empty'); continue; }
      assert.notStrictEqual(p.owner, null, sc.title + ': ' + p.name + ' has an owner');
      const r = s.chars[p.ruler];
      assert.strictEqual(r.loc, p.id);
      assert.strictEqual(r.faction, p.owner);
    }
    assert.strictEqual(s.players.length, 1);
    assert.ok(s.factions[s.players[0].faction].human);
  }
});

test('January taxes need Support of at least 40', () => {
  const s = BK.Setup.newGame({ scenarioId: 2, seed: 3, players: [] });
  const a = W.pref(s, 17), b = W.pref(s, 9);
  a.support = 40; b.support = 39;
  const ga = a.gold, gb = b.gold;
  BK.Econ.january(s);
  assert.ok(a.gold > ga, 'support 40 pays taxes');
  assert.strictEqual(b.gold, gb, 'support 39 pays nothing');
});

test('popularity counts supported prefectures and Liangshan', () => {
  const s = BK.Setup.newGame({ scenarioId: 2, seed: 5, players: [] });
  const lin = s.factions.find(f => s.chars[f.leader].key === 'Lin Chong');
  const p = W.pref(s, BK.MapData.liangshan);
  p.support = 60;
  const base = W.popularity(s, lin.id);
  p.support = 30;
  assert.strictEqual(W.popularity(s, lin.id), base - 12);
});

test('the Edict is granted in January at 250 popularity and gates Kaifeng', () => {
  const s = BK.Setup.newGame({ scenarioId: 2, seed: 11, players: [] });
  const f = s.factions.find(x => x.kind === 'goodfellow' && W.factionPrefs(s, x.id).length);
  const home = W.factionPrefs(s, f.id)[0];
  // Move the band next to the capital for the test.
  const cap = BK.MapData.capital, nb = W.neighbors(cap)[0];
  const np = W.pref(s, nb);
  np.owner = f.id; np.ruler = f.leader; s.chars[f.leader].loc = nb;
  assert.match(W.attackBlock(s, f.id, nb, cap) || '', /Edict/);
  const lead = s.chars[f.leader];
  // Support of 50 neither earns January's bonus nor falls below 40 when the year wears it down.
  W.factionPrefs(s, f.id).forEach(p => { p.support = 50; });
  lead.popEarned += 249 - W.popularity(s, f.id);
  BK.Econ.january(s);
  assert.ok(!f.edict, '249 is not enough');
  W.factionPrefs(s, f.id).forEach(p => { p.support = 50; });
  lead.popEarned += 250 - W.popularity(s, f.id);
  BK.Econ.january(s);
  assert.ok(f.edict, '250 earns the Edict');
  assert.strictEqual(W.attackBlock(s, f.id, nb, cap), null);
  assert.ok(home);
});

test('battles end and apply cleanly', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const s = BK.Setup.newGame({ scenarioId: 2, seed, players: [] });
    const f = s.factions.find(x => s.chars[x.leader].key === 'Lu Zhishen');
    const ids = W.heroesAt(s, 17).slice(1).map(c => c.id);
    const b = BK.War.start(s, { fid: f.id, source: 17, target: 9, heroes: ids, food: 400 });
    const r = b.autoResolve();
    assert.ok(r && (r.winner === 'atk' || r.winner === 'def'));
    assert.ok(b.day <= 31);
    const res = BK.War.apply(s, b);
    assert.ok(typeof res.text === 'string' && res.text.length);
    const p = W.pref(s, 9);
    if (r.winner === 'atk') assert.strictEqual(p.owner, f.id);
    for (const c of s.chars) if (c.status === 'served') assert.ok(c.men >= 0);
  }
});

test('fire spreads downwind and rain puts it out', () => {
  const s = BK.Setup.newGame({ scenarioId: 2, seed: 21, players: [] });
  const f = s.factions.find(x => s.chars[x.leader].key === 'Lu Zhishen');
  const b = BK.War.start(s, { fid: f.id, source: 17, target: 9, heroes: W.heroesAt(s, 17).slice(1).map(c => c.id), food: 400 });
  b.cells.forEach(c => { c.t = 'forest'; c.frozen = false; c.fire = 0; });
  b.cell(7, 5).fire = 3;
  b.wind = 0;
  W.rng(s).s = 1;
  for (let i = 0; i < 3; i++) b.burn();
  assert.ok(b.cells.filter(c => c.fire || c.burnt).length > 1, 'fire spread');
  b.weather = 'Rain';
  b.cells.forEach(c => { if (c.fire) c.fire = 3; });
  b.day++;
  for (let i = 0; i < 5; i++) { b.beginDay(false); b.weather = 'Rain'; }
  assert.ok(b.cells.filter(c => c.fire).length < b.cells.filter(c => c.burnt).length);
});

test('a save round-trips and keeps the random sequence', () => {
  const s = BK.Setup.newGame({ scenarioId: 3, seed: 99, players: [{ key: 'Li Kui' }] });
  W.rng(s).next();
  const copy = BK.Save.deserialize(BK.Save.serialize(s));
  assert.strictEqual(W.rng(copy).next(), W.rng(s).next());
  assert.strictEqual(copy.chars.length, s.chars.length);
  assert.ok(W.isExiled(copy, copy.players[0].faction), 'Li Kui starts in exile');
});

test('an exile band may attack the prefecture it hides in', () => {
  const s = BK.Setup.newGame({ scenarioId: 3, seed: 2, players: [{ key: 'Li Kui' }] });
  const f = s.factions[s.players[0].faction];
  assert.ok(W.isExiled(s, f.id));
  assert.strictEqual(W.attackBlock(s, f.id, f.exileAt, f.exileAt), null);
  const other = W.neighbors(f.exileAt)[0];
  assert.ok(W.attackBlock(s, f.id, other, other), 'only the hiding place, not other prefectures');
});

test('gathering spreads bandits across the band', () => {
  const s = BK.Setup.newGame({ scenarioId: 4, seed: 4, players: [{ key: 'Li Kui' }] });
  const fid = s.players[0].faction;
  const band = W.exileBand(s, fid);
  assert.ok(band.length >= 2);
  const before = band.map(c => c.men);
  BK.Actions.gather(s, fid);
  assert.ok(band.filter((c, i) => c.men > before[i]).length >= 2);
});

test('defenders hold an even fight more often than not', () => {
  let atkWins = 0, n = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const s = BK.Setup.newGame({ scenarioId: 2, seed, players: [] });
    const f = s.factions.find(x => s.chars[x.leader].key === 'Lu Zhishen');
    const hs = W.heroesAt(s, 17).slice(1);
    const k = W.defenseValue(s, 9) / W.prefPower(s, 17, hs);
    hs.forEach(c => { c.men = Math.max(10, Math.round(c.men * k)); });
    const b = BK.War.start(s, { fid: f.id, source: 17, target: 9, heroes: hs.map(c => c.id), food: 5000 });
    if (b.autoResolve().winner === 'atk') atkWins++;
    n++;
  }
  assert.ok(atkWins / n < 0.4, 'attacker won ' + atkWins + ' of ' + n);
});

test('an Edict thins out the Kaifeng garrison', () => {
  const s = BK.Setup.newGame({ scenarioId: 1, seed: 8, players: [] });
  const f = s.factions.find(x => x.kind === 'goodfellow' && x.alive);
  s.chars[f.leader].popEarned = 400;
  const before = W.menAt(s, BK.MapData.capital);
  BK.Econ.january(s);
  assert.ok(f.edict);
  assert.ok(W.menAt(s, BK.MapData.capital) < before * 0.8);
});

test('difficulty scales the imperial garrisons', () => {
  const men = d => {
    const s = BK.Setup.newGame({ scenarioId: 2, seed: 12, players: [], difficulty: d });
    return W.factionHeroes(s, s.imperial).reduce((a, c) => a + c.men, 0);
  };
  assert.ok(men('easy') < men('normal'));
  assert.ok(men('normal') < men('hard'));
});

test('losing your Good Fellow ends that player\'s game', async () => {
  const s = BK.Setup.newGame({ scenarioId: 1, seed: 6, players: [{ key: 'Lin Chong' }] });
  const f = s.factions[s.players[0].faction];
  BK.Actions.capture(s, s.chars[f.leader], s.imperial, 4);
  assert.strictEqual(f.alive, false);
  assert.strictEqual(s.players[0].alive, false);
  const io = headless();
  await new BK.Game(s, io).run();
  assert.strictEqual(io.outcome.kind, 'lose');
});

test('a refused duel never leaves a unit with negative troops', () => {
  const s = BK.Setup.newGame({ scenarioId: 2, seed: 3, players: [] });
  const f = s.factions.find(x => s.chars[x.leader].key === 'Lu Zhishen');
  const b = BK.War.start(s, { fid: f.id, source: 17, target: 9, heroes: W.heroesAt(s, 17).slice(1).map(c => c.id), food: 400 });
  const atk = b.live('atk')[0], def = b.live('def')[0];
  def.men = 0;
  s.chars[def.cid].courage = 0;
  W.rng(s).s = 99;
  for (let i = 0; i < 5 && !def.gone; i++) b.duel(atk, def);
  assert.ok(def.men >= 0);
});

test('every Good Fellow starts Scenario 1 in exile, as in the original', () => {
  const s = BK.Setup.newGame({ scenarioId: 1, seed: 5, players: [] });
  const gfs = s.factions.filter(f => f.kind === 'goodfellow');
  assert.strictEqual(gfs.length, 5);
  for (const f of gfs) assert.ok(W.isExiled(s, f.id), s.chars[f.leader].name + ' is in exile');
});

test('a hero leads at most 100 men', () => {
  const s = BK.Setup.newGame({ scenarioId: 2, seed: 9, players: [] });
  const p = W.pref(s, 17), c = W.heroesAt(s, 17)[0];
  p.gold = 9999;
  c.men = 90;
  BK.Actions.hireMen(s, 17, c.id, 500);
  assert.strictEqual(c.men, 100);
  for (const h of s.chars) assert.ok(h.men <= 100, h.name + ' starts with no more than 100 men');
});

test('archers shoot exactly two hexes along a hex line', () => {
  const s = BK.Setup.newGame({ scenarioId: 2, seed: 4, players: [] });
  const f = s.factions.find(x => s.chars[x.leader].key === 'Lu Zhishen');
  const b = BK.War.start(s, { fid: f.id, source: 17, target: 9, heroes: W.heroesAt(s, 17).slice(1).map(c => c.id), food: 400 });
  b.cells.forEach(c => { c.t = 'plain'; c.frozen = false; });
  const u = b.live('atk')[0], o = b.live('def')[0];
  s.chars[u.cid].dex = 70;
  u.q = 4; u.r = 5;
  const line = [[4, 3], [6, 4], [6, 6], [4, 7], [2, 6], [2, 4]], off = [[5, 3], [6, 5], [3, 3], [4, 6]];
  for (const [q, r] of line) { o.q = q; o.r = r; assert.ok(b.inVolley(u, o), q + ',' + r + ' is in line'); }
  for (const [q, r] of off) { o.q = q; o.r = r; assert.ok(!b.inVolley(u, o), q + ',' + r + ' is not'); }
  o.q = 4; o.r = 3;
  b.cell(4, 4).t = 'mount';
  assert.ok(!b.inVolley(u, o), 'no shooting over a mountain');
  s.chars[u.cid].dex = 60;
  assert.strictEqual(b.targets(u, 'archery').length, 0, 'Dexterity must be over 60');
});

test('resting in battle restores 2 Body below 40 and nothing above', () => {
  const s = BK.Setup.newGame({ scenarioId: 2, seed: 6, players: [] });
  const f = s.factions.find(x => s.chars[x.leader].key === 'Lu Zhishen');
  const b = BK.War.start(s, { fid: f.id, source: 17, target: 9, heroes: W.heroesAt(s, 17).slice(1).map(c => c.id), food: 400 });
  b.side = 'atk';
  const [u, v] = b.live('atk');
  const h = s.chars[u.cid], g = s.chars[v.cid];
  h.body = 30; h.bodyMax = 100; g.body = 50; g.bodyMax = 100;
  b.act(u, 'rest'); b.act(v, 'rest');
  assert.strictEqual(h.body, 32);
  assert.strictEqual(g.body, 50);
});

test('a defender calls up heroes waiting beyond the ten on the field', () => {
  const s = BK.Setup.newGame({ scenarioId: 2, seed: 8, players: [] });
  const f = s.factions.find(x => s.chars[x.leader].key === 'Lu Zhishen');
  const t = W.pref(s, 9);
  t.castles = 3;
  for (let i = 0; i < 11; i++) {
    const c = s.chars.find(x => x.status === 'free');
    c.status = 'served'; c.faction = t.owner; c.loc = 9; c.men = 30; c.body = 60;
  }
  const b = BK.War.start(s, { fid: f.id, source: 17, target: 9, heroes: W.heroesAt(s, 17).slice(1).map(c => c.id), food: 400 });
  assert.strictEqual(b.live('def').length, 10);
  assert.ok(b.reserve.length > 0);
  const d = b.live('def')[1];
  d.gone = 'fled';
  const spot = b.targets(b.live('def')[0], 'reinforce')[0];
  assert.ok(spot, 'there is a free deployment hex');
  const before = b.reserve.length;
  assert.ok(b.act(b.live('def')[0], 'reinforce', spot.q, spot.r));
  assert.strictEqual(b.live('def').length, 10);
  assert.strictEqual(b.reserve.length, before - 1);
  assert.strictEqual(b.targets(b.live('atk')[0], 'reinforce').length, 0, 'attackers cannot call reinforcements');
});

test('treaties expire after three Januaries', () => {
  const s = BK.Setup.newGame({ scenarioId: 2, seed: 10, players: [] });
  const [a, b] = s.factions.filter(f => f.kind === 'goodfellow');
  BK.Actions.makeTreaty(s, a.id, b.id);
  for (let y = 1; y <= 2; y++) { s.year++; BK.Econ.january(s); assert.ok(a.treaties.includes(b.id), 'still in force in year ' + y); }
  s.year++;
  BK.Econ.january(s);
  assert.ok(!a.treaties.includes(b.id) && !b.treaties.includes(a.id));
});

test('computer-only games run to the end without errors', async () => {
  for (const sc of [1, 2, 3, 4]) {
    const s = BK.Setup.newGame({ scenarioId: sc, seed: 500 + sc, players: [] });
    await new BK.Game(s, headless()).run();
    assert.ok(s.over);
    assert.ok(s.winner != null || s.invaded);
  }
});
