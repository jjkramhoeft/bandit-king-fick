// A scripted "human" that plays one Good Fellow through the same flows a player uses,
// to check that each scenario can actually be won. Usage: node tests/strategy.js [runs]
const BK = require('./load.js');
const W = BK.World, A = BK.Actions;
const runs = +process.argv[2] || 10;

const DIST = {};
function dist(a, b) {
  const key = a + ':' + b;
  if (DIST[key] != null) return DIST[key];
  const seen = { [a]: 0 }, q = [a];
  while (q.length) {
    const c = q.shift();
    for (const n of W.neighbors(c)) if (seen[n] == null) { seen[n] = seen[c] + 1; q.push(n); }
  }
  return (DIST[key] = seen[b]);
}

// Steps from each own prefecture to the nearest one bordering Kaifeng, through own territory.
function frontDist(s, f) {
  const cap = BK.MapData.capital, own = new Set(W.factionPrefs(s, f.id).map(p => p.id)), d = {}, q = [];
  for (const id of own) if (W.neighbors(id).includes(cap)) { d[id] = 0; q.push(id); }
  if (!q.length) return null;
  while (q.length) { const c = q.shift(); for (const n of W.neighbors(c)) if (own.has(n) && d[n] == null) { d[n] = d[c] + 1; q.push(n); } }
  return d;
}

function best(list, score) {
  let top = null, ts = -Infinity;
  for (const x of list) { const v = score(x); if (v > ts) { ts = v; top = x; } }
  return top;
}

// Picks a command for one of the player's prefectures. Returns a war plan or applies an action.
function plan(s, prefId) {
  const p = W.pref(s, prefId), f = W.faction(s, p.owner), hs = W.heroesAt(s, prefId);
  const fit = hs.filter(c => c.body > 25);
  const strong = best(fit.length ? fit : hs, c => c.str + c.courage);
  const wise = best(fit.length ? fit : hs, c => c.wis + c.dex);
  const hunter = best(fit.length ? fit : hs, c => c.dex);
  const worker = best(fit.length ? fit : hs, c => c.str);
  const drill = best(fit.length ? fit : hs, c => c.str + c.dex);
  const smith = best(hs.filter(A.canForge), c => c.dex + c.wis);
  const men = W.menAt(s, prefId), winter = W.season(s) === 'Winter';
  const capital = BK.MapData.capital;

  if (p.beasts && hunter.body > 40) return A.fightBeasts(s, prefId, hunter.id);
  const sworn = hs.find(c => c.loyalty >= 95 && !c.brother && c.id !== f.leader);
  if (sworn) return A.brother(s, sworn.id);

  // Strike when clearly stronger, preferring ground on the road to Kaifeng; with the Edict,
  // throw everything at the capital.
  const atGates = f.edict && W.neighbors(prefId).includes(capital);
  // The leader stays out of field armies except for the final assault.
  const army = hs.filter(c => c.men > 8 && c.body > 40 && (atGates || c.id !== f.leader)).sort((a, b) => b.men - a.men);
  if (army.length >= 2 && !winter) {
    const go = army.slice(0, Math.min(10, hs.length - 1));
    // Leave enough at home to see off the strongest hostile neighbour.
    const threat = Math.max(0, ...W.neighbors(prefId).map(n => {
      const o = W.pref(s, n).owner;
      return o != null && o !== f.id && f.treaties.indexOf(o) < 0 ? W.prefPower(s, n) : 0;
    }));
    const homeLeft = () => hs.filter(c => !go.includes(c));
    while (go.length >= 2 && W.prefPower(s, prefId, homeLeft()) * (1 + p.castles * 0.09) < threat / 1.4) go.pop();
    const power = W.prefPower(s, prefId, go);
    let target = null, bestScore = 0;
    const hasFront = !!frontDist(s, f);
    for (const n of W.neighbors(prefId)) {
      if (W.attackBlock(s, f.id, prefId, n)) continue;
      // With the Edict, the army beside Kaifeng waits for the capital alone.
      if (atGates && n !== capital) continue;
      const r = power / W.defenseValue(s, n);
      // Kaifeng gets no fresh troops once an Edict is out, so repeated assaults wear its guard down.
      const urgent = 0.9;
      // With the Edict but no foothold beside Kaifeng, a prefecture on its border is worth a risk.
      const gate = f.edict && !hasFront && W.neighbors(n).includes(capital);
      const need = n === capital ? urgent : (gate ? 1.6 : (dist(n, capital) < dist(prefId, capital) ? 1.9 : 2.2));
      if (r < need || (n === capital && go.length < 5)) continue;
      const score = r * (n === capital ? 10 : 1) / (1 + dist(n, capital) * 0.15);
      if (score > bestScore) { bestScore = score; target = n; }
    }
    const need = BK.War.foodNeed(s, go.map(c => c.id));
    if (target && p.food >= need * 0.8 && p.gold >= BK.War.provisions(s, go.map(c => c.id))) {
      return { war: { fid: f.id, source: prefId, target, heroes: go.map(c => c.id), food: Math.min(p.food, need) } };
    }
  }
  // With the Edict in hand the Good Fellow rides to the front: only prefectures he (or a sworn
  // brother) rules take direct orders, and the final assault needs direct orders.
  const fd = frontDist(s, f);
  const closer = n => fd ? fd[n] != null && fd[n] < fd[prefId] : dist(n, capital) < dist(prefId, capital);
  if (f.edict && p.ruler === f.leader && !W.neighbors(prefId).includes(capital) && !p.snowbound) {
    const fwd = W.neighbors(prefId).filter(n => W.pref(s, n).owner === f.id && !W.pref(s, n).snowbound &&
      closer(n) && W.heroesAt(s, n).length < W.pref(s, n).castles * 5);
    if (fwd.length && hs.length >= 2) {
      const to = fwd[0], room = W.pref(s, to).castles * 5 - W.heroesAt(s, to).length;
      const escort = hs.filter(c => c.id !== f.leader).sort((a, b) => b.men - a.men).slice(0, Math.min(room - 1, hs.length - 2));
      return A.moveHeroes(s, prefId, to, [f.leader].concat(escort.map(c => c.id)));
    }
  }
  // With the Edict, the rear sends its spare food to the front: a siege of Kaifeng is long and hungry.
  const front = fd && W.factionPrefs(s, f.id).find(q => fd[q.id] === 0 && W.heroesAt(s, q.id).some(c => c.id === f.leader));
  if (f.edict && front && front.id !== prefId && front.food < 2500 && p.food > men * 8 + 300 && W.char(s, p.ruler).body > 10) {
    return A.moveSupplies(s, prefId, front.id, { food: p.food - men * 8 - 100 });
  }
  // Mass the army: a quiet rear prefecture keeps one hero and sends the rest toward Kaifeng.
  const threatened = W.neighbors(prefId).some(n => { const o = W.pref(s, n).owner; return o != null && o !== f.id; });
  if (hs.length >= 2 && !p.snowbound) {
    const fwd = W.neighbors(prefId).filter(n => W.pref(s, n).owner === f.id && !W.pref(s, n).snowbound &&
      closer(n) && W.heroesAt(s, n).length < W.pref(s, n).castles * 5);
    if (fwd.length && (!threatened || hs.length >= 4)) {
      const to = fwd[0], room = W.pref(s, to).castles * 5 - W.heroesAt(s, to).length;
      const keep = threatened ? 2 : 1;
      const movers = hs.filter(c => c.id !== p.ruler).sort((a, b) => b.men - a.men).slice(0, Math.min(room, hs.length - keep));
      if (movers.length) return A.moveHeroes(s, prefId, to, movers.map(c => c.id));
    }
  }
  // A sensible economy: feed the army, keep the people content, keep weapons and drill up,
  // fill each hero's ranks before taking on more heroes, and develop the land for taxes.
  const perHero = men / hs.length;
  // Going into town tires the chieftain.
  const ruler = W.char(s, p.ruler);
  const travel = r => { if (r.ok) ruler.body -= 10; return r; };
  if (p.food < men * 6) {
    if (!winter && hunter.body > 20) return A.hunt(s, prefId, hunter.id, 'food');
    if (p.gold > 100 && ruler.body > 10) return travel(A.trade(s, prefId, 'food', Math.floor(p.gold * 0.5 / A.prices(p).foodBuy), true));
  }
  // Keep a year's pay in hand, and look after loyalty before it turns into desertion.
  const reserve = 12 * hs.length;
  const avgLoy = hs.reduce((a, c) => a + c.loyalty, 0) / hs.length;
  if (avgLoy < 70 && p.gold >= A.feastCost(s, prefId) + reserve) return A.feast(s, prefId);
  const wavering = hs.filter(c => !c.brother && c.id !== f.leader && c.loyalty < 45).sort((a, b) => a.loyalty - b.loyalty)[0];
  if (wavering && p.gold >= 60 + reserve) return A.giveHero(s, prefId, wavering.id, 60);
  if (perHero < 30 && p.gold >= 60 + reserve) {
    const room = best(hs, c => W.menCap(c) - c.men);
    const n = Math.floor(Math.min(W.menCap(room) - room.men, (p.gold - reserve) * 0.7 / A.hireCost(p), A.hireLimit(p)));
    if (n >= 4) return A.hireMen(s, prefId, room.id, n);
  }
  if (p.support < 60 && p.food > men * 8 + 150) return A.giveCitizens(s, prefId, Math.min(1000, Math.round((p.food - men * 8) * 0.3)));
  if (p.arms < 70 && men) {
    if (p.metal >= 10 && smith && smith.body > 15) return A.makeWeapons(s, prefId, smith.id, p.metal);
    if (p.smithy && p.gold > 150 && ruler.body > 10) return travel(A.buyArms(s, prefId, Math.round(p.gold * 0.5)));
    if (p.support > 55 && wise.body > 15) return A.solicit(s, prefId, wise.id, 'metal');
  }
  if (p.skill < 80 && drill.body > 10 && men) return A.train(s, prefId, drill.id);
  if (p.gold >= 100 + reserve) {
    const room = best(hs, c => W.menCap(c) - c.men);
    const n = Math.floor(Math.min(W.menCap(room) - room.men, (p.gold - reserve) * 0.6 / A.hireCost(p), A.hireLimit(p)));
    if (n >= 8) return A.hireMen(s, prefId, room.id, n);
  }
  const towns = W.townsAt(s, prefId).filter(c => A.willJoin(s, f.id, c, ruler));
  if (towns.length && hs.length < Math.min(10, p.castles * 5) && perHero >= 50 && ruler.body > 10) {
    return travel(A.recruit(s, f.id, prefId, ruler, best(towns, c => c.str + c.dex + c.wis)));
  }
  if (p.arms < 90 && p.metal >= 10 && smith && smith.body > 15 && men) return A.makeWeapons(s, prefId, smith.id, p.metal);
  const low = best(['land', 'wealth', 'flood'], k => -p[k]);
  if (p[low] < 85 && worker.body > 15) return A.service(s, prefId, worker.id, { flood: 'flood', land: 'farm', wealth: 'build' }[low]);
  const avg = hs.reduce((a, c) => a + c.loyalty, 0) / hs.length;
  if (avg < 75 && p.gold > A.feastCost(s, prefId) + 100) return A.feast(s, prefId);
  if (p.skill < 100 && drill.body > 10 && men) return A.train(s, prefId, drill.id);
  return A.rest(s, prefId);
}

function exilePlan(s, fid) {
  const f = W.faction(s, fid), lead = W.leader(s, fid), band = W.exileBand(s, fid);
  const power = band.reduce((a, c) => a + W.unitPower(c.men, 25, 35, c), 0);
  const here = W.pref(s, f.exileAt);
  // Wild land is poor and cannot pay for soldiers, so gather a proper band before settling it.
  const men = band.reduce((a, c) => a + c.men, 0);
  const ready = here.owner == null ? men >= 60 : power > W.defenseValue(s, here.id) * 1.3;
  if (!W.attackBlock(s, fid, here.id, here.id) && ready) {
    return { war: { fid, source: here.id, target: here.id, heroes: band.map(c => c.id), food: 0 } };
  }
  const towns = W.townsAt(s, here.id).filter(c => A.willJoin(s, fid, c, lead));
  if (towns.length) return A.recruit(s, fid, here.id, lead, towns[0]);
  if (lead.men < W.menCap(lead) - 5) return A.gather(s, fid);
  const weak = W.neighbors(here.id).filter(n => !W.pref(s, n).snowbound && W.defenseValue(s, n) < W.defenseValue(s, here.id));
  if (weak.length && !here.snowbound) return A.wander(s, fid, weak[0]);
  return A.gather(s, fid);
}

function botIO() {
  return {
    newMonth: async () => {}, event: async () => {}, say: async () => {}, news: async () => {},
    chieftain: async () => {}, focus: async () => {}, refresh: async () => {}, autosave: () => {},
    battle: async (b) => { b.autoResolve(); },
    gameOver: async () => {},
    // Pay tribute only when weaker than the threat; accept every volunteer.
    confirm: async (text) => /tribute/.test(text) ? botIO.payNext : true,
    menu: async (p, items) => (items.find(i => i.value === 'recruit' || i.value === 'release') || items[0]).value
  };
}

async function play(sc, key, seed) {
  const s = BK.Setup.newGame({ scenarioId: sc, seed, players: [{ key }], difficulty: process.env.DIFFICULTY || 'normal' });
  const G = new BK.Game(s, botIO());
  BK.Flows.prefTurn = async (g, prefId) => {
    const r = plan(s, prefId);
    if (r && r.war) {
      await g.war(r.war);
      const t = W.pref(s, r.war.target);
      if (t.owner === r.war.fid && !W.isDirect(s, t.id)) A.setOrders(s, t.id, 'entrust');
    }
    return {};
  };
  BK.Flows.exileTurn = async (g, fid) => {
    const r = exilePlan(s, fid);
    if (r && r.war) await g.war(r.war);
    return {};
  };
  BK.Flows.prisoners = async (g, list) => {
    for (const x of list) {
      const c = W.char(s, x.cid);
      if (c.status === 'prisoner' && W.rng(s).chance(A.prisonerChance(s, x.captor, c))) A.enlist(s, c, x.captor, c.loc, 60);
      else if (c.status === 'prisoner') { A.release(s, c); A.earn(s, x.captor, 2); }
    }
  };
  const origDemand = G.demand.bind(G);
  G.demand = async (ev) => {
    botIO.payNext = BK.AI.paysDemand(s, ev.pref);
    return origDemand(ev);
  };
  await G.run();
  const me = s.players[0].faction;
  return { win: s.winner === me, year: s.year, edict: W.faction(s, me).edict, prefs: W.factionPrefs(s, me).length, alive: s.players[0].alive };
}

module.exports = { play, plan };
if (require.main === module) (async () => {
  const cases = [[1, 'Lin Chong'], [1, 'Lu Zhishen'], [2, 'Chao Gai'], [2, 'Song Jiang'], [3, 'Song Jiang'], [3, 'Li Kui'], [4, 'Li Jun'], [4, 'Li Ying']];
  for (const [sc, key] of cases) {
    let wins = 0, edicts = 0, alive = 0, years = [];
    for (let i = 0; i < runs; i++) {
      const r = await play(sc, key, 9000 + sc * 100 + i);
      if (r.win) { wins++; years.push(r.year); }
      if (r.edict) edicts++;
      if (r.alive) alive++;
    }
    console.log('S' + sc + ' ' + key.padEnd(11), 'wins ' + wins + '/' + runs, 'edict ' + edicts, 'survived ' + alive,
      years.length ? 'avg win year ' + Math.round(years.reduce((a, b) => a + b) / years.length) : '');
  }
})();
