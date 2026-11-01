/* Every command as a pure state change. Human menus and the AI both call these, so the rules
   live in one place. Each returns { ok, text, scene } for the message window. */
(function (root) {
  'use strict';
  var BK = root.BK = root.BK || {};
  var W = BK.World;

  function res(ok, text, scene, extra) {
    var r = { ok: ok, text: text, scene: scene || null };
    if (extra) for (var k in extra) r[k] = extra[k];
    return r;
  }
  function fail(text) { return res(false, text, null); }
  function cap(p) { BK.Econ.cap(p); }

  var A = BK.Actions = {
    // The sixteen main commands and their options, named as in the Western Amiga release.
    // Each option is [label, value]; flows switch on the value.
    CMDS: [
      { id: 'fight', label: 'Fight', subs: [['Go to War', 'war'], ['Go on Expedition', 'beasts']] },
      { id: 'service', label: 'Service', subs: [] },
      { id: 'make', label: 'Make', subs: [['Ships', 'ships'], ['Weapons', 'weapons']] },
      { id: 'move', label: 'Move', subs: [['Hero', 'hero'], ['Provisions', 'supplies'], ['Go into Exile', 'to exile']] },
      { id: 'ally', label: 'Negotiate', subs: [] },
      { id: 'travel', label: 'Travel', subs: [] },
      { id: 'solicit', label: 'Solicit', subs: [['Gold', 'gold'], ['Metal', 'metal']] },
      { id: 'hunt', label: 'Hunt', subs: [['Food', 'food'], ['Fur', 'fur']] },
      { id: 'heroes', label: 'Personnel', subs: [] },
      { id: 'organize', label: 'Organize', subs: [['Hire Men', 'hire men'], ['Assign Men', 'give men'], ['Assign Ships', 'ships']] },
      { id: 'train', label: 'Train', subs: [] },
      { id: 'feast', label: 'Feast', subs: [] },
      { id: 'rest', label: 'Rest', subs: [] },
      { id: 'give', label: 'Give', subs: [['Citizens', 'citizens'], ['Hero', 'hero']] },
      { id: 'view', label: 'View', subs: [], free: true },
      { id: 'other', label: 'Interrupt', subs: [['Save', 'save'], ['Wait', 'wait'], ['Sound', 'sound'], ['Animation', 'animation'], ['Messages', 'messages'], ['Quit', 'quit']] }
    ],
    EXILE_CMDS: [
      { id: 'xmove', label: 'Flee' },
      { id: 'xrecruit', label: 'Recruit Hero' },
      { id: 'xfight', label: 'Settle' },
      { id: 'xrest', label: 'Rest' },
      { id: 'view', label: 'View', free: true },
      { id: 'other', label: 'Interrupt' }
    ],
    ORDERS: ['entrust', 'develop', 'expand'],

    // Every command costs the hero who carries it out some Body, as listed in the original manual.
    needBody: function (c, n) { return c.body > n; },
    // Heroes learn by doing: every 100 experience in an ability raises it by one point.
    gainExp: function (c, stat, n) {
      if (!c) return;
      c.exp = c.exp || { body: 0, str: 0, dex: 0, wis: 0 };
      c.exp[stat] += n;
      while (c.exp[stat] >= 100) {
        c.exp[stat] -= 100;
        c[stat] = Math.min(100, c[stat] + 1);
      }
    },
    // How well two personalities (Integrity, Mercy, Courage) get on: 0.3 (oil and water) to 1.3.
    compat: function (s, c) {
      var lead = W.leader(s, c.faction);
      if (!lead || lead.id === c.id) return 1.3;
      var diff = Math.abs(c.int - lead.int) + Math.abs(c.mercy - lead.mercy) + Math.abs(c.courage - lead.courage);
      return BK.clamp(1.3 - diff / 150, 0.3, 1.3);
    },
    canForge: function (c) { return c.dex >= 60 && c.wis >= 50; },
    pron: function (c, cap) {
      var w = c.look && c.look.sex === 'f' ? 'she' : 'he';
      return cap ? w.charAt(0).toUpperCase() + w.slice(1) : w;
    },

    // --- Prefecture development -------------------------------------------------------------
    service: function (s, prefId, heroId, kind) {
      var p = W.pref(s, prefId), c = W.char(s, heroId), rng = W.rng(s);
      if (!A.needBody(c, 15)) return fail(c.name + ' is too exhausted to work. (Body 15 needed)');
      var key = { flood: 'flood', farm: 'land', build: 'wealth' }[kind];
      var ruler = W.char(s, p.ruler) || c;
      // The worker's Strength sets the gain; the ruler's Mercy earns the people's thanks.
      var gain = 2 + Math.floor(c.str / 20) + rng.int(0, 3);
      var thanks = 1 + Math.floor(ruler.mercy / 40) + rng.int(0, 1);
      // A wealthy prefecture can afford masons for a new castle.
      if (kind === 'build' && p.wealth >= 70 && p.gold >= 230 && p.castles < 7) {
        p.gold -= 230; p.castles++; c.body -= 15; p.support += 1;
        A.gainExp(c, 'str', 10);
        A.earn(s, p.owner, 1);
        cap(p);
        return res(true, c.name + ' raises a new castle in ' + p.name + '. Castles: ' + p.castles +
          ' (room for ' + p.castles * 5 + ' heroes).', 'build');
      }
      p[key] += gain; c.body -= 15;
      A.gainExp(c, 'str', 10);
      p.support += thanks;
      A.earn(s, p.owner, 1);
      cap(p);
      var what = { flood: 'raises the dikes', farm: 'clears new fields', build: 'repairs roads and markets' }[kind];
      return res(true, c.name + ' ' + what + ' in ' + p.name + '. ' +
        { flood: 'Flood control', farm: 'Land', build: 'Wealth' }[kind] + ' rises by ' + gain + '.',
        { flood: 'flood', farm: 'farm', build: 'build' }[kind]);
    },

    makeWeapons: function (s, prefId, heroId, metal) {
      var p = W.pref(s, prefId), c = W.char(s, heroId);
      metal = Math.min(metal, p.metal);
      if (!A.canForge(c)) return fail('Only a hero with Dexterity 60 and Wisdom 50 can make weapons.');
      if (metal < 5) return fail('There is not enough metal. Solicit metal first.');
      if (!W.menAt(s, prefId)) return fail('There are no men here to arm.');
      if (!A.needBody(c, 15)) return fail(c.name + ' is too exhausted. (Body 15 needed)');
      var men = Math.max(40, W.menAt(s, prefId));
      var gain = Math.max(1, Math.round(metal * (0.3 + (c.dex + c.wis) / 250) / (men / 40)));
      p.metal -= metal; p.arms += gain; c.body -= 15;
      A.gainExp(c, 'dex', 10);
      A.gainExp(c, 'wis', 10);
      cap(p);
      return res(true, c.name + ' forges weapons from ' + metal + ' metal. Arms rise by ' + gain + '.', 'smithy');
    },

    makeShips: function (s, prefId, heroId) {
      var p = W.pref(s, prefId), c = W.char(s, heroId);
      if (!p.shipyard) return fail(p.name + ' has no shipyard.');
      if (!c.steersman) return fail('Only a steersman can direct shipbuilding.');
      if (p.skill < 70) return fail('The workers are not skilled enough. (Skill 70 needed)');
      if (p.gold < 150) return fail('A ship costs 150 gold.');
      if (p.ships >= 9) return fail('The harbour is full.');
      if (!A.needBody(c, 15)) return fail(c.name + ' is too exhausted. (Body 15 needed)');
      p.gold -= 150; p.ships++; c.body -= 15;
      A.gainExp(c, 'dex', 15);
      A.gainExp(c, 'wis', 10);
      return res(true, c.name + ' launches a war junk at ' + p.name + '. Ships: ' + p.ships + '.', 'ship');
    },

    train: function (s, prefId, heroId) {
      var p = W.pref(s, prefId), c = W.char(s, heroId), rng = W.rng(s);
      if (!W.menAt(s, prefId)) return fail('There are no men here to train.');
      if (!A.needBody(c, 10)) return fail(c.name + ' is too exhausted. (Body 10 needed)');
      var lead = W.leader(s, p.owner) || c;
      var gain = 2 + Math.floor((c.str + c.dex) / 60) + Math.floor(lead.int / 50) + rng.int(0, 2);
      if (p.skill >= 100) return fail('The troops are already fully trained.');
      p.skill += gain; c.body -= 10;
      A.gainExp(c, 'str', 11);
      A.gainExp(c, 'dex', 11);
      cap(p);
      return res(true, c.name + ' drills the troops of ' + p.name + '. Skill rises by ' + gain + '.', 'train');
    },

    feastCost: function (s, prefId) {
      var p = W.pref(s, prefId);
      return Math.max(1, Math.round(10 * W.heroesAt(s, prefId).length * p.rate / 50));
    },
    feast: function (s, prefId) {
      var p = W.pref(s, prefId), rng = W.rng(s);
      var hs = W.heroesAt(s, prefId), cost = A.feastCost(s, prefId);
      if (p.gold < cost) return fail('A feast for ' + hs.length + ' heroes costs ' + cost + ' gold.');
      p.gold -= cost;
      var host = W.char(s, p.ruler), dry = host && host.int >= 75 ? 0.5 : 1;
      hs.forEach(function (c) {
        c.body = Math.min(c.bodyMax, c.body + 15);
        if (W.faction(s, c.faction).leader !== c.id) c.loyalty = Math.min(100, c.loyalty + Math.round(rng.int(3, 7) * dry));
      });
      return res(true, 'Wine flows in ' + p.name + '. The heroes drink to brotherhood and loyalty grows.', 'feast');
    },

    rest: function (s, prefId) {
      var hs = W.heroesAt(s, prefId);
      hs.forEach(function (c) { c.body = Math.min(c.bodyMax, c.body + 10); });
      return res(true, 'The heroes of ' + W.pref(s, prefId).name + ' rest and recover their strength.', 'rest');
    },

    giveCitizens: function (s, prefId, food) {
      var p = W.pref(s, prefId);
      food = Math.min(food, p.food, 1000);
      if (food < 10) return fail('There is not enough food to give.');
      var ruler = W.char(s, p.ruler);
      var gain = Math.max(1, Math.round(food / (20 + p.support) * (0.6 + (ruler ? ruler.mercy : 50) / 125)));
      p.food -= food; p.support += gain;
      if (food >= 100) A.earn(s, p.owner, 1);
      cap(p);
      return res(true, 'You give ' + food + ' food to the poor of ' + p.name + '. Support rises by ' + gain + '.', 'market');
    },

    giveHero: function (s, prefId, heroId, gold) {
      var p = W.pref(s, prefId), c = W.char(s, heroId);
      gold = Math.min(gold, p.gold, 100);
      if (gold < 1) return fail('There is no gold to give.');
      p.gold -= gold;
      if (c.brother) return res(true, c.name + ' accepts ' + gold + ' gold with a laugh. A sworn brother\'s loyalty needs no buying.', null);
      // Kindred spirits are won over faster.
      var gain = (gold <= 50 ? gold / 5 : 10 + (gold - 50) / 20) * A.compat(s, c);
      c.loyalty = Math.min(100, Math.round(c.loyalty + gain));
      return res(true, c.name + ' accepts ' + gold + ' gold. Loyalty is now ' + c.loyalty + '.', null);
    },

    solicit: function (s, prefId, heroId, kind) {
      var p = W.pref(s, prefId), c = W.char(s, heroId), rng = W.rng(s);
      if (!A.needBody(c, 15)) return fail(c.name + ' is too exhausted. (Body 15 needed)');
      c.body -= 15;
      if (kind === 'metal') A.gainExp(c, 'dex', 5);
      if (rng.chance(0.12 + c.int / 600)) {
        p.support -= 6; cap(p);
        A.gainExp(c, 'wis', 10);
        return res(true, 'The people of ' + p.name + ' drive ' + c.name + '\'s men away empty-handed. Support falls.', 'riot');
      }
      var lead = W.leader(s, p.owner) || c;
      var knack = (0.4 + (c.wis + c.dex) / 300) * (1.2 - lead.mercy / 200);
      var amount;
      A.gainExp(c, 'wis', 13);
      if (kind === 'gold') {
        amount = Math.round((p.wealth * 3 + rng.int(10, 60)) * knack);
        p.gold += amount; p.support -= 4 + rng.int(0, 3);
        A.gainExp(c, 'dex', 5);
      } else {
        amount = Math.round((10 + BK.MapGeo.build().terrain[p.id].hills * 8 + rng.int(0, 20)) * knack / 0.8);
        p.metal += amount; p.support -= 3;
      }
      cap(p);
      return res(true, c.name + ' collects ' + amount + ' ' + kind + ' from ' + p.name + '. Support falls.', 'market');
    },

    hunt: function (s, prefId, heroId, kind) {
      var p = W.pref(s, prefId), c = W.char(s, heroId), rng = W.rng(s);
      if (W.season(s) === 'Winter') return fail('There is no game to hunt in winter.');
      if (!A.needBody(c, 20)) return fail(c.name + ' is too exhausted to hunt. (Body 20 needed)');
      c.body -= 20;
      var amount, lead = W.leader(s, p.owner) || c;
      A.gainExp(c, 'dex', 15);
      if (kind === 'food') { amount = Math.round(40 + c.dex * 1.4 + lead.courage * 0.8 + rng.int(0, 60)); p.food += amount; }
      else { amount = Math.round(3 + c.dex / 10 + lead.courage / 20 + rng.int(0, 6)); p.fur += amount; }
      cap(p);
      return res(true, c.name + ' leads a hunt in the hills of ' + p.name + ' and brings back ' + amount + ' ' + kind + '.', 'hunt');
    },

    // From strongest to weakest, as the manual ranks them.
    BEASTS: { bears: 140, tigers: 125, leopards: 105, wolves: 85 },
    beastKind: function (p) { return A.BEASTS[p.beasts] ? p.beasts : 'tigers'; },
    // An expedition pits the hero's Dexterity and men against the beasts.
    fightBeasts: function (s, prefId, heroId) {
      var p = W.pref(s, prefId), c = W.char(s, heroId), rng = W.rng(s);
      if (!p.beasts) return fail('There are no beasts in ' + p.name + '.');
      if (!A.needBody(c, 10)) return fail(c.name + ' is too exhausted to face the beasts. (Body 10 needed)');
      var kind = A.beastKind(p);
      c.body -= 10;
      var power = c.dex * 1.2 + c.men * 0.6 + rng.int(0, 60);
      var beast = A.BEASTS[kind] + rng.int(0, 40);
      if (power >= beast) {
        var pop = rng.int(1, 5);
        p.beasts = false; p.support += 3;
        A.gainExp(c, 'str', 50);
        A.gainExp(c, 'dex', 50);
        A.earn(s, p.owner, pop);
        cap(p);
        return res(true, c.name + ' hunts down the ' + kind + ' of ' + p.name + '! The people sing of the deed. (Popularity +' + pop + ')', 'beast');
      }
      var lost = Math.round(c.men * rng.range(0.1, 0.3));
      c.men -= lost;
      c.body = Math.max(1, c.body - rng.int(10, 25));
      A.earn(s, p.owner, -2);
      return res(true, c.name + ' is mauled by the ' + kind + ' and driven off' + (lost ? ', losing ' + lost + ' men' : '') +
        '. The people whisper that the outlaws are all talk.', 'beast');
    },

    // --- Market, smithy, shipyard -----------------------------------------------------------
    prices: function (p) {
      var r = p.rate / 100;
      return {
        foodBuy: r * 1.0, foodSell: r * 0.45, furBuy: r * 4, furSell: r * 3,
        armsPerGold: 1 / (6 + 0)
      };
    },
    trade: function (s, prefId, item, qty, buy) {
      var p = W.pref(s, prefId), pr = A.prices(p);
      qty = Math.max(0, Math.floor(qty));
      if (!qty) return fail('Nothing was traded.');
      var unit = item === 'food' ? (buy ? pr.foodBuy : pr.foodSell) : (buy ? pr.furBuy : pr.furSell);
      var total = Math.ceil(unit * qty);
      if (buy) {
        if (p.gold < total) return fail('That costs ' + total + ' gold.');
        p.gold -= total; p[item] += qty;
      } else {
        if (p[item] < qty) return fail('You do not have that much ' + item + '.');
        p[item] -= qty; p.gold += Math.floor(unit * qty);
      }
      cap(p);
      return res(true, (buy ? 'Bought ' : 'Sold ') + qty + ' ' + item + ' for ' + (buy ? total : Math.floor(unit * qty)) + ' gold.', 'market');
    },
    armsCost: function (s, prefId) {
      return Math.max(1, Math.round((4 + W.menAt(s, prefId) / 15) * W.pref(s, prefId).rate / 50));
    },
    buyArms: function (s, prefId, gold) {
      var p = W.pref(s, prefId);
      if (!p.smithy) return fail(p.name + ' has no smithy.');
      if (!W.menAt(s, prefId)) return fail('There are no men here to arm.');
      var per = A.armsCost(s, prefId);
      var pts = Math.min(100 - p.arms, Math.floor(Math.min(gold, p.gold) / per));
      if (pts < 1) return fail('Each point of Arms costs ' + per + ' gold here.');
      p.gold -= pts * per; p.arms += pts;
      cap(p);
      return res(true, 'The smiths of ' + p.name + ' deliver new weapons. Arms rise by ' + pts + '.', 'smithy');
    },
    shipCost: function (p) { return Math.round(250 * p.rate / 50); },
    buyShip: function (s, prefId) {
      var p = W.pref(s, prefId), cost = A.shipCost(p);
      if (!p.shipyard) return fail(p.name + ' has no shipyard.');
      if (p.gold < cost) return fail('A ship costs ' + cost + ' gold at the yard.');
      if (p.ships >= 9) return fail('The harbour is full.');
      p.gold -= cost; p.ships++;
      return res(true, 'You buy a river junk. Ships: ' + p.ships + '.', 'ship');
    },

    // --- Recruiting -------------------------------------------------------------------------
    // Each townsperson's mood is fixed for the month, so Divine tells the truth.
    recruitRoll: function (s, c) {
      return (BK.hash(s.seed + ':' + s.year + ':' + s.month + ':' + c.id) % 1000) / 1000;
    },
    recruitChance: function (s, fid, target, actor) {
      var pop = W.popularity(s, fid);
      var n = W.factionHeroes(s, fid).length;
      var ch = 0.22 + pop / 900 + (actor.int + actor.mercy - 100) / 400 - n / 120;
      if (target.role === 'hero') ch -= 0.05; else ch += 0.12;
      if (target.int > 80 && actor.int < 50) ch -= 0.1;
      if (target.refused === s.year * 12 + s.month) ch = 0;
      return BK.clamp(ch, 0.03, 0.92);
    },
    willJoin: function (s, fid, target, actor) {
      return A.recruitRoll(s, target) < A.recruitChance(s, fid, target, actor);
    },
    recruit: function (s, fid, prefId, actor, target) {
      var p = W.pref(s, prefId);
      if (W.isExiled(s, fid)) {
        if (W.exileBand(s, fid).length >= 10) return fail('An outlaw band cannot feed more than 10 heroes.');
      } else if (W.heroesAt(s, prefId).length >= p.castles * 5) {
        return fail(p.name + ' cannot house more heroes. (' + p.castles + ' castles × 5)');
      }
      if (A.willJoin(s, fid, target, actor)) {
        A.enlist(s, target, fid, prefId, W.rng(s).int(55, 80));
        return res(true, target.name + ' gladly joins ' + W.leader(s, fid).name + '\'s band!', 'tavern');
      }
      target.refused = s.year * 12 + s.month;
      A.earn(s, fid, -1);
      return res(true, target.name + ' politely refuses.', 'tavern');
    },
    enlist: function (s, c, fid, prefId, loyalty) {
      c.status = 'served'; c.faction = fid; c.loc = prefId; c.loyalty = loyalty;
      c.men = Math.max(c.men, 0); c.pos = Math.max(1, c.pos); c.captor = null; c.brother = false;
    },
    rumors: function (s, prefId) {
      var rng = W.rng(s);
      var pool = s.chars.filter(function (c) { return c.status === 'free' && c.loc !== prefId; });
      rng.shuffle(pool);
      return pool.slice(0, 7);
    },

    // --- Heroes ---------------------------------------------------------------------------
    brother: function (s, heroId) {
      var c = W.char(s, heroId);
      if (c.brother) return fail(c.name + ' is already your sworn brother.');
      if (c.loyalty < 95) return fail(c.name + ' is not yet loyal enough. (Loyalty 95 needed)');
      var sworn = W.factionHeroes(s, c.faction).filter(function (x) { return x.brother; }).length;
      var most = s.difficulty === 'hard' ? 7 : 9;
      if (sworn >= most) return fail('You already have ' + sworn + ' sworn brothers and sisters, the most you may have.');
      c.brother = true; c.loyalty = 100;
      return res(true, 'Under the peach blossoms ' + c.name + ' swears brotherhood with ' +
        W.leader(s, c.faction).name + '. Any prefecture ' + A.pron(c) + ' governs now takes your orders directly.', 'treaty');
    },
    banish: function (s, heroId) {
      var c = W.char(s, heroId), f = W.faction(s, c.faction);
      if (f.leader === c.id) return fail('You cannot banish yourself.');
      var p = W.pref(s, c.loc);
      if (p && p.ruler === c.id) A.pickRuler(s, p.id, c.id);
      var name = c.name;
      A.release(s, c);
      A.earn(s, f.id, -3);
      return res(true, name + ' leaves your service. The people frown on it.', 'travel');
    },
    // Appoint a chieftain for the prefecture. Like View, it does not use up the month's command.
    promote: function (s, prefId, heroId) {
      var p = W.pref(s, prefId), c = W.char(s, heroId), lead = W.leader(s, p.owner);
      if (p.ruler === heroId) return fail(c.name + ' already governs ' + p.name + '.');
      if (lead && lead.status === 'served' && lead.loc === prefId) return fail(lead.name + ' governs ' + p.name + ' in person.');
      p.ruler = heroId; c.pos = Math.max(c.pos, 4);
      return res(true, c.name + ' is now chieftain of ' + p.name + '.', 'treaty', { free: true });
    },
    setOrders: function (s, prefId, order) {
      var p = W.pref(s, prefId);
      p.orders = order;
      return res(true, 'The chieftain of ' + p.name + ' will now ' +
        { entrust: 'act as they see fit', develop: 'develop the prefecture', expand: 'expand by force' }[order] + '.', null);
    },

    // --- Troops -----------------------------------------------------------------------------
    hireCost: function (p) { return Math.max(1, Math.round(p.rate / 25 * 4 * 10) / 10); },
    hireLimit: function (p) { return 10 + Math.round(p.wealth / 2 + p.land / 4); },
    hireMen: function (s, prefId, heroId, n) {
      var p = W.pref(s, prefId), c = W.char(s, heroId);
      var room = W.menCap(c) - c.men;
      n = Math.min(n, room, A.hireLimit(p), Math.floor(p.gold / A.hireCost(p)));
      if (n < 1) return fail('No men can be hired. Check gold and the hero\'s troop limit (' + W.menCap(c) + ').');
      p.gold -= Math.ceil(n * A.hireCost(p));
      c.men += n;
      p.support -= Math.floor(n / 20);
      cap(p);
      return res(true, c.name + ' recruits ' + n + ' men. ' + c.name + ' now leads ' + c.men + '.', 'march');
    },
    giveMen: function (s, fromId, toId, n) {
      var a = W.char(s, fromId), b = W.char(s, toId);
      n = Math.min(n, a.men, W.menCap(b) - b.men);
      if (n < 1) return fail('No men could be transferred.');
      a.men -= n; b.men += n;
      return res(true, a.name + ' hands ' + n + ' men to ' + b.name + '.', 'march');
    },

    // --- Moving -----------------------------------------------------------------------------
    moveHeroes: function (s, fromId, toId, ids) {
      var from = W.pref(s, fromId), to = W.pref(s, toId), boss = W.char(s, from.ruler);
      if (to.owner !== from.owner) return fail('You can only move heroes into your own prefectures.');
      if (boss && !A.needBody(boss, 10)) return fail(boss.name + ' is too exhausted to lead the march. (Body 10 needed)');
      if (!W.isAdjacent(fromId, toId)) return fail('Heroes can only move to a neighbouring prefecture.');
      if (from.snowbound || to.snowbound) return fail('Snow blocks the roads this month.');
      var staying = W.heroesAt(s, fromId).length - ids.length;
      if (staying < 1) return fail('At least one hero must stay to hold ' + from.name + '.');
      if (W.heroesAt(s, toId).length + ids.length > to.castles * 5) return fail(to.name + ' can hold only ' + to.castles * 5 + ' heroes.');
      var f = W.faction(s, from.owner);
      if (boss) { boss.body -= 10; A.gainExp(boss, 'wis', 7); }
      ids.forEach(function (id) {
        var c = W.char(s, id);
        c.loc = toId;
        if (f.leader === id) to.ruler = id;
      });
      if (ids.indexOf(from.ruler) >= 0) A.pickRuler(s, fromId);
      return res(true, ids.length + ' hero' + (ids.length > 1 ? 'es' : '') + ' march from ' + from.name + ' to ' + to.name + '.', 'march');
    },
    moveSupplies: function (s, fromId, toId, amt) {
      var from = W.pref(s, fromId), to = W.pref(s, toId), boss = W.char(s, from.ruler);
      if (to.owner !== from.owner) return fail('Supplies can only go to your own prefectures.');
      if (boss && !A.needBody(boss, 10)) return fail(boss.name + ' is too exhausted to send a wagon train. (Body 10 needed)');
      var moved = [];
      ['gold', 'food', 'metal', 'fur'].forEach(function (k) {
        var n = Math.min(amt[k] || 0, from[k]);
        if (n > 0) { from[k] -= n; to[k] += n; moved.push(n + ' ' + k); }
      });
      cap(from); cap(to);
      if (!moved.length) return fail('Nothing was sent.');
      if (boss) { boss.body -= 10; A.gainExp(boss, 'wis', 15); }
      return res(true, 'A wagon train carries ' + moved.join(', ') + ' to ' + to.name + '.', 'travel');
    },
    // Abandon a prefecture: the band takes to the hills in a neighbouring one.
    goExile: function (s, prefId, toId) {
      var p = W.pref(s, prefId), f = W.faction(s, p.owner);
      if (W.factionPrefs(s, f.id).length > 1) return fail('You can only go into exile from your last prefecture.');
      var lead = W.leader(s, f.id);
      if (!A.needBody(lead, 15)) return fail(lead.name + ' is too exhausted to flee. (Body 15 needed)');
      lead.body -= 15;
      W.heroesAt(s, prefId).forEach(function (c) { c.loc = toId; c.men = Math.round(c.men * 0.6); });
      p.owner = null; p.ruler = null;
      f.exileAt = toId;
      // Abandoning one's people costs dearly in popularity, and the Edict with it.
      A.earn(s, f.id, -25);
      f.edict = false;
      return res(true, W.leader(s, f.id).name + ' abandons ' + p.name + ' and takes to the hills of ' + W.pref(s, toId).name + '.', 'travel');
    },

    // --- Exile ------------------------------------------------------------------------------
    wander: function (s, fid, toId) {
      var f = W.faction(s, fid);
      if (!W.isAdjacent(f.exileAt, toId)) return fail('You can only wander to a neighbouring prefecture.');
      if (W.pref(s, f.exileAt).snowbound || W.pref(s, toId).snowbound) return fail('Snow blocks the mountain passes.');
      var rng = W.rng(s);
      W.exileBand(s, fid).forEach(function (c) {
        c.loc = toId;
        if (c.id !== f.leader && !c.brother) c.loyalty = Math.max(0, c.loyalty - rng.int(0, 2));
      });
      f.exileAt = toId;
      return res(true, W.leader(s, fid).name + '\'s band slips into ' + W.pref(s, toId).name + '.', 'travel');
    },
    // New bandits go to whichever heroes of the band have room for them.
    gather: function (s, fid) {
      var lead = W.leader(s, fid), rng = W.rng(s), band = W.exileBand(s, fid);
      var n = Math.round(4 + W.popularity(s, fid) / 24 + lead.courage / 20 + rng.int(0, 4)) * Math.min(3, band.length);
      var left = n;
      band.slice().sort(function (a, b) { return a.men - b.men; }).forEach(function (c) {
        var take = Math.min(left, W.menCap(c) - c.men, Math.ceil(n / band.length) + 3);
        if (take > 0) { c.men += take; left -= take; }
      });
      n -= left;
      if (n < 1) return fail('Your band cannot grow any larger.');
      lead.gold += rng.int(5, 15);
      return res(true, n + ' desperate men join ' + lead.name + '\'s bandits. The band now numbers ' +
        W.exileBand(s, fid).reduce(function (a, c) { return a + c.men; }, 0) + '.', 'march');
    },
    // A hero given a ship can take a unit across rivers in battle, as a steersman can.
    assignShip: function (s, prefId, heroId) {
      var p = W.pref(s, prefId), c = W.char(s, heroId);
      if (!p.ships) return fail('There are no spare ships in ' + p.name + '.');
      if (c.ship) return fail(c.name + ' already has a ship.');
      p.ships--; c.ship = true;
      return res(true, c.name + ' takes command of a war junk and can now cross rivers and lakes in battle. Ships left: ' + p.ships + '.', 'ship');
    },

    // --- Diplomacy --------------------------------------------------------------------------
    treatyChance: function (s, fid, other) {
      var mine = W.popularity(s, fid), theirs = W.popularity(s, other);
      return BK.clamp(0.3 + (mine - theirs) / 500 + W.leader(s, other).int / 400, 0.05, 0.9);
    },
    makeTreaty: function (s, fid, other) {
      var a = W.faction(s, fid), b = W.faction(s, other);
      if (a.treaties.indexOf(other) < 0) a.treaties.push(other);
      if (b.treaties.indexOf(fid) < 0) b.treaties.push(fid);
      // A treaty holds for three years; each January takes one off.
      a.treatyEnd = a.treatyEnd || {}; b.treatyEnd = b.treatyEnd || {};
      a.treatyEnd[other] = b.treatyEnd[fid] = s.year + 3;
      return res(true, W.leader(s, fid).name + ' and ' + W.leader(s, other).name + ' swear not to raise arms against each other for three years.', 'treaty');
    },
    breakTreaty: function (s, fid, other) {
      var a = W.faction(s, fid), b = W.faction(s, other);
      a.treaties = a.treaties.filter(function (x) { return x !== other; });
      b.treaties = b.treaties.filter(function (x) { return x !== fid; });
      A.earn(s, fid, -30);
    },
    inviteCost: function (s, other) { return 150 + 25 * W.factionHeroes(s, other).length; },
    // A wise messenger gets by with smaller gifts.
    envoyGift: function (envoy, base) { return Math.max(10, Math.round(base * (1.4 - envoy.wis / 125))); },
    inviteChance: function (s, fid, other) {
      var ch = 0.12 + (W.popularity(s, fid) - W.popularity(s, other)) / 300 +
        (W.factionPrefs(s, fid).length - W.factionPrefs(s, other).length) / 20;
      if (W.isExiled(s, other)) ch += 0.25;
      return BK.clamp(ch, 0.02, 0.9);
    },
    merge: function (s, fid, other) {
      var a = W.faction(s, fid), b = W.faction(s, other), them = W.leader(s, other);
      W.factionHeroes(s, other).forEach(function (c) { c.faction = fid; });
      W.factionPrefs(s, other).forEach(function (p) { p.owner = fid; });
      them.brother = true; them.loyalty = 92; them.pos = 4;
      if (b.exileAt && !W.factionPrefs(s, fid).length) a.exileAt = b.exileAt;
      b.alive = false; b.exileAt = 0;
      s.factions.forEach(function (f) { f.treaties = f.treaties.filter(function (x) { return x !== other; }); });
      return res(true, them.name + ' accepts the invitation and joins ' + W.leader(s, fid).name + ' as a sworn brother!', 'treaty');
    },

    // --- Capture and conquest ---------------------------------------------------------------
    earn: function (s, fid, n) {
      var f = W.faction(s, fid);
      if (f && f.kind === 'goodfellow') s.chars[f.leader].popEarned = BK.clamp(s.chars[f.leader].popEarned + n, -200, 999);
    },
    release: function (s, c) {
      c.status = 'free'; c.faction = null; c.brother = false; c.men = 0; c.loyalty = 0; c.captor = null; c.ship = false;
      if (!c.loc) c.loc = W.rng(s).int(1, s.prefs.length);
    },
    capture: function (s, c, captor, prefId) {
      var old = c.faction, p = c.loc ? W.pref(s, c.loc) : null;
      c.status = 'prisoner'; c.faction = null; c.captor = captor; c.loc = prefId; c.men = 0; c.brother = false; c.ship = false;
      if (p && p.ruler === c.id) A.pickRuler(s, p.id, c.id);
      A.checkLeader(s, old, c.id);
    },
    prisonerChance: function (s, captor, c) {
      if (c.key === 'Gao Qiu') return 0;
      var lead = W.leader(s, captor);
      var ch = 0.22 + W.charPopularity(s, lead) / 1200 + (lead.mercy - 50) / 250 - (c.int - 50) / 260;
      return BK.clamp(ch, 0.03, 0.85);
    },
    execute: function (s, captor, c) {
      c.status = 'dead'; c.captor = null;
      A.earn(s, captor, -8);
      return res(true, c.name + ' is put to death. The people whisper of cruelty.', 'defeat');
    },
    pickRuler: function (s, prefId, excludeId) {
      var p = W.pref(s, prefId);
      var hs = W.heroesAt(s, prefId).filter(function (c) { return c.id !== excludeId; });
      var f = W.faction(s, p.owner);
      if (!hs.length) { p.ruler = null; return null; }
      var lead = hs.filter(function (c) { return f && c.id === f.leader; })[0];
      hs.sort(function (a, b) { return (b.pos * 100 + b.courage) - (a.pos * 100 + a.courage); });
      p.ruler = (lead || hs[0]).id;
      return p.ruler;
    },
    // A faction whose leader is lost breaks apart; its prefectures become independent.
    checkLeader: function (s, fid, lostId) {
      var f = W.faction(s, fid);
      if (!f || !f.alive || f.leader !== lostId) return;
      f.alive = false;
      f.treaties = [];
      s.factions.forEach(function (g) { g.treaties = g.treaties.filter(function (x) { return x !== fid; }); });
      if (f.kind === 'imperial') return;
      W.factionPrefs(s, fid).forEach(function (p) {
        var hs = W.heroesAt(s, p.id);
        if (!hs.length) { p.owner = null; p.ruler = null; return; }
        var ruler = s.chars[A.pickRuler(s, p.id)];
        var nf = { id: s.factions.length, kind: 'local', leader: ruler.id, color: BK.C.tan, human: false, player: -1,
          alive: true, edict: false, treaties: [], exileAt: 0 };
        s.factions.push(nf);
        p.owner = nf.id;
        hs.forEach(function (c) { c.faction = nf.id; c.brother = false; });
        ruler.pos = Math.max(ruler.pos, 4);
      });
      W.factionHeroes(s, fid).forEach(function (c) { A.release(s, c); });
      if (f.human) s.players.forEach(function (pl) { if (pl.faction === fid) pl.alive = false; });
    },
    noteFactionLoss: function (s, fid) {
      var f = W.faction(s, fid);
      if (!f || !f.alive || W.factionPrefs(s, fid).length) return;
      var lead = s.chars[f.leader];
      if (f.kind === 'goodfellow') {
        if (lead.status === 'served') f.exileAt = lead.loc;
      } else if (f.kind !== 'imperial') {
        f.alive = false;
        W.factionHeroes(s, fid).forEach(function (c) { A.release(s, c); });
      }
    },
    victory: function (s, fid) {
      s.over = true;
      s.winner = fid;
      W.log(s, W.leader(s, fid).name + ' has destroyed Gao Qiu.');
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = A;
})(typeof window !== 'undefined' ? window : globalThis);
