/* Development harness: plays one Good Fellow through the real screen, only by clicking buttons,
   menu items, table rows, the map and battle hexes, the way a person would. It reads the game's
   numbers to decide (standing in for reading the panels) but never changes the state itself.
   Load it into a running page, then call Autoplay.start({ scenario, fellow, difficulty }). */
(function () {
  'use strict';
  var BK = window.BK, W = BK.World;

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function click(el) { if (el) el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); return !!el; }
  function text(el) { return (el && el.textContent || '').trim(); }

  var AP = window.Autoplay = {
    running: false, steps: [], log: [], result: null, fails: {}, clicks: 0, turns: 0, battles: 0,

    start: function (o) {
      AP.opts = o;
      AP.running = true;
      AP.result = null;
      AP.timer = setInterval(AP.tick, 25);
      AP.note('start ' + JSON.stringify(o));
    },
    stop: function () { AP.running = false; clearInterval(AP.timer); },
    note: function (t) { AP.log.push(t); if (AP.log.length > 300) AP.log.shift(); },

    // --- Clicking helpers ----------------------------------------------------------------------
    menuItem: function (match) {
      var items = $$('.req .menuitem').filter(function (b) { return !b.disabled; });
      var hit = items.filter(function (b) { return text(b).replace(/^\d+\.\s*/, '').indexOf(match) === 0; })[0];
      AP.clicks++;
      return click(hit);
    },
    gad: function (label) {
      var g = $$('.req .gad').filter(function (b) { return text(b) === label && !b.disabled; })[0];
      AP.clicks++;
      return click(g);
    },
    // Clicks the rows for the named heroes; returns how many were found.
    rows: function (names, ok) {
      var trs = $$('.req tr.row'), found = 0;
      names.forEach(function (n) {
        var tr = trs.filter(function (r) { return text(r.firstChild).replace(/ \*$/, '') === n; })[0];
        if (!tr) return;
        found++;
        AP.clicks++;
        click(tr);
      });
      if (ok) AP.gad('OK');
      return found;
    },
    number: function (n) {
      var inp = $('.req input[type=number]');
      if (!inp) return false;
      inp.value = String(n);
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      return AP.gad('OK');
    },
    command: function (label) {
      var b = $$('#prompt .cmd').filter(function (x) { return text(x).replace(/^\d+/, '') === label; })[0];
      AP.clicks++;
      return click(b);
    },
    prefButton: function (id) {
      var b = $$('#prompt .cmd').filter(function (x) { return text(x).indexOf(id + ' ') === 0; })[0];
      if (b) { AP.clicks++; return click(b); }
      // Otherwise click the prefecture on the map itself.
      var g = BK.MapGeo.build(), l = g.label[id], cv = $('#map'), r = cv.getBoundingClientRect();
      AP.clicks++;
      cv.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: r.left + (l.x + 0.5) / g.W * r.width, clientY: r.top + (l.y + 0.5) / g.H * r.height }));
      return true;
    },

    // --- Main loop ---------------------------------------------------------------------------
    tick: function () {
      if (!AP.running || AP.busy) return;
      AP.busy = true;
      try { AP.step(); } catch (e) { AP.note('error ' + e.message); console.error(e); } finally { AP.busy = false; }
    },
    step: function () {
      var title = $('#title');
      if (!title.hidden && !$('.req')) { click(title); return; }
      if (!$('#battle').hidden) { AP.battleStep(); return; }
      var p = BK.UI.pending;
      if (!p) return;
      if (p.kind === 'wait') { click($('#msg')); return; }
      if (p.kind === 'command') { AP.commandTurn(p); return; }
      if (p.kind === 'pickPref') { AP.pickPref(p); return; }
      if (p.kind === 'req') AP.requester();
    },

    expect: function (type) { return AP.steps.length && AP.steps[0].t === type ? AP.steps.shift() : null; },

    requester: function () {
      var bar = text($('.req .rbar')), body = text($('.req .rbody'));
      var s;
      // Setup screens.
      if (/Welcome, hero of the marsh/.test(body)) return AP.menuItem('New game');
      if (/Choose a scenario/.test(body)) {
        var sc = BK.Scenarios[AP.opts.scenario - 1];
        return click($$('.req .menuitem').filter(function (b) { return text(b).indexOf(sc.year + ' A.D.') >= 0; })[0]);
      }
      if (/How hard should Gao Qiu be/.test(body)) return AP.menuItem({ easy: 'Easy', normal: 'Normal', hard: 'Hard' }[AP.opts.difficulty || 'normal']);
      if (/How many players/.test(body)) return AP.menuItem('1 player');
      if (/choose your Good Fellow/.test(body)) {
        return click($$('.req .gfcard').filter(function (b) { return text(b).indexOf(AP.opts.fellow) >= 0; })[0]);
      }
      if (bar === 'Your Good Fellow') return AP.gad('Yes');
      if (/Destroy Gao Qiu before January 1127/.test(body)) return AP.gad('Begin');
      // Endings.
      if (bar === 'Victory' || bar === 'The end') {
        var s0 = BK.UI.s;
        AP.result = { outcome: bar, date: BK.MONTHS[s0.month - 1] + ' ' + s0.year, winner: s0.winner != null ? W.factionName(s0, s0.winner) : null,
          clicks: AP.clicks, turns: AP.turns, battles: AP.battles, text: body.slice(0, 200) };
        AP.note('result ' + JSON.stringify(AP.result));
        AP.stop();
        return AP.gad('Return to title');
      }
      if (bar === 'Message' || bar === 'Guru Meditation') return AP.gad('OK') || AP.gad('Continue');
      // Planned steps.
      if (bar === 'Choose' && (s = AP.expect('menu'))) { if (!AP.menuItem(s.v)) AP.cancel(); return; }
      if (bar === 'Choose a hero' && (s = AP.expect('hero'))) { if (!AP.rows([s.v])) AP.cancel(); return; }
      if (bar === 'Choose heroes' && (s = AP.expect('heroes'))) { if (!AP.rows(s.v, true)) AP.cancel(); return; }
      if (bar === 'Amount' && (s = AP.expect('number'))) { AP.number(s.v); return; }
      if (bar === 'Request') {
        s = AP.expect('confirm');
        var yes = s ? s.v : AP.answer(body);
        return AP.gad(yes ? 'Yes' : 'No');
      }
      if (bar === 'Choose' && /has been captured/.test(body)) {
        return AP.menuItem('Recruit') || AP.menuItem('Release');
      }
      if (bar === 'Choose' && /Market of/.test(body)) return AP.menuItem('Leave the market');
      if (bar === 'Choose' && /^Downtown/.test(body)) return AP.menuItem('Leave');
      AP.cancel();
    },
    cancel: function () {
      AP.steps = [];
      if (!AP.gad('Cancel')) {
        if (!AP.gad('OK')) document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      }
    },
    // Unplanned yes/no questions: arrivals, tribute, riots, invitations.
    answer: function (body) {
      var s = BK.UI.s;
      if (/Pay the tribute/.test(body)) return BK.AI.paysDemand(s, BK.UI.focusId);
      if (/to calm them/.test(body)) return true;
      if (/Quit to the title/.test(body)) return false;
      return true;
    },
    pickPref: function (p) {
      var s = AP.expect('pref');
      if (s && p.ids.indexOf(s.v) >= 0) { AP.prefButton(s.v); return; }
      AP.steps = [];
      click($$('#prompt .cmd.cancel')[0]);
    },

    // --- Choosing a command ---------------------------------------------------------------------
    commandTurn: function (p) {
      var s = BK.UI.s;
      AP.turns++;
      var key = s.year * 12 + s.month + ':' + (BK.UI.exileFid != null ? 'x' : BK.UI.focusId);
      AP.fails[key] = (AP.fails[key] || 0) + 1;
      var plan = AP.fails[key] > 2 ? { cmd: BK.UI.exileFid != null ? 'Rest' : 'Rest', steps: [] }
        : (BK.UI.exileFid != null ? AP.exilePlan(s, BK.UI.exileFid) : AP.plan(s, BK.UI.focusId));
      AP.steps = plan.steps.slice();
      AP.command(plan.cmd);
    },

    plan: function (s, prefId) {
      var p = W.pref(s, prefId), f = W.faction(s, p.owner), hs = W.heroesAt(s, prefId);
      var A = BK.Actions, cap = BK.MapData.capital;
      var pick = function (list, score) { return list.slice().sort(function (a, b) { return score(b) - score(a); })[0]; };
      var fit = hs.filter(function (c) { return c.body > 25; });
      var strong = pick(fit.length ? fit : hs, function (c) { return c.str + c.courage; });
      var wise = pick(fit.length ? fit : hs, function (c) { return c.wis + c.dex; });
      var hunter = pick(fit.length ? fit : hs, function (c) { return c.dex; });
      var worker = pick(fit.length ? fit : hs, function (c) { return c.str; });
      var drill = pick(fit.length ? fit : hs, function (c) { return c.str + c.dex; });
      var smiths = hs.filter(A.canForge);
      var ruler = W.char(s, p.ruler);
      var men = W.menAt(s, prefId), winter = W.season(s) === 'Winter';
      var hero = function (c) { return hs.length > 1 ? [{ t: 'hero', v: c.name }] : []; };
      var dist = AP.dist;

      if (p.beasts && hunter.body > 40) return { cmd: 'Fight', steps: [{ t: 'menu', v: 'Go on Expedition' }].concat(hero(hunter)) };
      var sworn = hs.filter(function (c) { return c.loyalty >= 95 && !c.brother && c.id !== f.leader; })[0];
      if (sworn) return { cmd: 'Personnel', steps: [{ t: 'menu', v: 'Swear Brotherhood' }, { t: 'hero', v: sworn.name }] };

      var atGates = f.edict && W.neighbors(prefId).indexOf(cap) >= 0;
      var army = hs.filter(function (c) { return c.men > 8 && c.body > 40 && (atGates || c.id !== f.leader); })
        .sort(function (a, b) { return b.men - a.men; });
      if (army.length >= 2 && !winter) {
        var go = army.slice(0, Math.min(10, hs.length - 1));
        // Leave enough at home to see off the strongest hostile neighbour.
        var threat = Math.max.apply(null, [0].concat(W.neighbors(prefId).map(function (n) {
          var o = W.pref(s, n).owner;
          return o != null && o !== f.id && f.treaties.indexOf(o) < 0 ? W.prefPower(s, n) : 0;
        })));
        var homeLeft = function () { return hs.filter(function (c) { return go.indexOf(c) < 0; }); };
        while (go.length >= 2 && W.prefPower(s, prefId, homeLeft()) * (1 + p.castles * 0.09) < threat / 1.4) go.pop();
        var power = W.prefPower(s, prefId, go), target = null, best = 0;
        var hasFront = !!AP.frontDist(s, f);
        W.neighbors(prefId).forEach(function (n) {
          if (W.attackBlock(s, f.id, prefId, n)) return;
          if (atGates && n !== cap) return;
          var r = power / W.defenseValue(s, n);
          // Kaifeng gets no fresh troops once an Edict is out, so repeated assaults wear its guard down.
          var urgent = 0.9;
          // With the Edict but no foothold beside Kaifeng, a prefecture on its border is worth a risk.
          var gate = f.edict && !hasFront && W.neighbors(n).indexOf(cap) >= 0;
          var need = n === cap ? urgent : (gate ? 1.6 : (dist(n, cap) < dist(prefId, cap) ? 1.9 : 2.2));
          if (r < need || (n === cap && go.length < 5)) return;
          var score = r * (n === cap ? 10 : 1) / (1 + dist(n, cap) * 0.15);
          if (score > best) { best = score; target = n; }
        });
        var need = BK.War.foodNeed(s, go.map(function (c) { return c.id; }));
        if (target && p.food >= need * 0.8 && p.gold >= BK.War.provisions(s, go.map(function (c) { return c.id; }))) {
          AP.battles++;
          return { cmd: 'Fight', steps: [{ t: 'menu', v: 'Go to War' }, { t: 'pref', v: target },
            { t: 'heroes', v: go.map(function (c) { return c.name; }) }, { t: 'number', v: Math.min(p.food, need) }, { t: 'confirm', v: true }] };
        }
      }
      // With the Edict the Good Fellow rides through his own lands to the prefecture beside Kaifeng.
      var fd = AP.frontDist(s, f);
      var closer = function (n) {
        return fd ? fd[n] != null && fd[n] < fd[prefId] : dist(n, cap) < dist(prefId, cap);
      };
      if (f.edict && p.ruler === f.leader && W.neighbors(prefId).indexOf(cap) < 0 && !p.snowbound && hs.length >= 2) {
        var fwd = W.neighbors(prefId).filter(function (n) {
          var q = W.pref(s, n);
          return q.owner === f.id && !q.snowbound && closer(n) && W.heroesAt(s, n).length < q.castles * 5;
        });
        if (fwd.length) {
          var room = W.pref(s, fwd[0]).castles * 5 - W.heroesAt(s, fwd[0]).length;
          var esc = hs.filter(function (c) { return c.id !== f.leader; }).sort(function (a, b) { return b.men - a.men; })
            .slice(0, Math.max(0, Math.min(room - 1, hs.length - 2)));
          return { cmd: 'Move', steps: [{ t: 'menu', v: 'Hero' }, { t: 'pref', v: fwd[0] },
            { t: 'heroes', v: [s.chars[f.leader].name].concat(esc.map(function (c) { return c.name; })) }] };
        }
      }
      // With the Edict, the rear sends its spare food to the front: a siege of Kaifeng is long and hungry.
      var front = fd && W.factionPrefs(s, f.id).filter(function (q) {
        return fd[q.id] === 0 && W.heroesAt(s, q.id).some(function (c) { return c.id === f.leader; });
      })[0];
      if (f.edict && front && front.id !== prefId && front.food < 2500 && p.food > men * 8 + 300 && W.char(s, p.ruler).body > 10) {
        var ship = [];
        ['gold', 'food', 'metal', 'fur'].forEach(function (k) {
          if (p[k]) ship.push({ t: 'number', v: k === 'food' ? p.food - men * 8 - 100 : 0 });
        });
        return { cmd: 'Move', steps: [{ t: 'menu', v: 'Provisions' }, { t: 'pref', v: front.id }].concat(ship) };
      }
      var threatened = W.neighbors(prefId).some(function (n) { var o = W.pref(s, n).owner; return o != null && o !== f.id; });
      if (hs.length >= 2 && !p.snowbound) {
        var fw2 = W.neighbors(prefId).filter(function (n) {
          var q = W.pref(s, n);
          return q.owner === f.id && !q.snowbound && closer(n) && W.heroesAt(s, n).length < q.castles * 5;
        });
        if (fw2.length && (!threatened || hs.length >= 4)) {
          var rm = W.pref(s, fw2[0]).castles * 5 - W.heroesAt(s, fw2[0]).length;
          var movers = hs.filter(function (c) { return c.id !== p.ruler; }).sort(function (a, b) { return b.men - a.men; })
            .slice(0, Math.min(rm, hs.length - (threatened ? 2 : 1)));
          if (movers.length) return { cmd: 'Move', steps: [{ t: 'menu', v: 'Hero' }, { t: 'pref', v: fw2[0] }, { t: 'heroes', v: movers.map(function (c) { return c.name; }) }] };
        }
      }
      // A sensible economy: feed the army, keep the people content, keep weapons and drill up,
      // fill each hero's ranks before taking on more heroes, and develop the land for taxes.
      var perHero = men / hs.length;
      var hire = function (limit, share, min) {
        var roomy = pick(hs, function (c) { return Math.min(limit, W.menCap(c)) - c.men; });
        var n = Math.floor(Math.min(Math.min(limit, W.menCap(roomy)) - roomy.men, (p.gold - 12 * hs.length) * share / A.hireCost(p), A.hireLimit(p)));
        return n >= min ? { cmd: 'Organize', steps: [{ t: 'menu', v: 'Hire Men' }].concat(hero(roomy)).concat([{ t: 'number', v: n }]) } : null;
      };
      // Only heroes with Dexterity 60 and Wisdom 50 may forge; the list skips the question when one can.
      var weapons = function () {
        var smith = pick(smiths, function (c) { return c.dex + c.wis; });
        return { cmd: 'Make', steps: [{ t: 'menu', v: 'Weapons' }].concat(smiths.length > 1 ? [{ t: 'hero', v: smith.name }] : [])
          .concat([{ t: 'number', v: p.metal }]) };
      };
      var canForge = smiths.length && pick(smiths, function (c) { return c.dex + c.wis; }).body > 15 && men > 0;
      if (p.food < men * 6) {
        if (!winter && hunter.body > 20) return { cmd: 'Hunt', steps: [{ t: 'menu', v: 'Food' }].concat(hero(hunter)) };
        if (p.gold > 100 && ruler.body > 10) return { cmd: 'Travel', steps: [{ t: 'menu', v: 'Go to Marketplace' }, { t: 'menu', v: 'Buy food' },
          { t: 'number', v: Math.floor(p.gold * 0.5 / A.prices(p).foodBuy) }, { t: 'menu', v: 'Leave the market' }] };
      }
      // Keep a year's pay in hand, and look after loyalty before it turns into desertion.
      var reserve = 12 * hs.length;
      var avgLoy = hs.reduce(function (a, c) { return a + c.loyalty; }, 0) / hs.length;
      if (avgLoy < 70 && p.gold >= A.feastCost(s, prefId) + reserve) return { cmd: 'Feast', steps: [{ t: 'confirm', v: true }] };
      var wavering = hs.filter(function (c) { return !c.brother && c.id !== f.leader && c.loyalty < 45; })
        .sort(function (a, b) { return a.loyalty - b.loyalty; })[0];
      var givable = hs.filter(function (c) { return c.id !== f.leader; });
      if (wavering && p.gold >= 60 + reserve) {
        return { cmd: 'Give', steps: [{ t: 'menu', v: 'Hero' }].concat(givable.length > 1 ? [{ t: 'hero', v: wavering.name }] : []).concat([{ t: 'number', v: 60 }]) };
      }
      var h1 = perHero < 30 && p.gold >= 60 + reserve ? hire(100, 0.7, 4) : null;
      if (h1) return h1;
      if (p.support < 60 && p.food > men * 8 + 150) {
        return { cmd: 'Give', steps: [{ t: 'menu', v: 'Citizens' }, { t: 'number', v: Math.min(1000, Math.round((p.food - men * 8) * 0.3)) }] };
      }
      if (p.arms < 70 && men) {
        if (p.metal >= 10 && canForge) return weapons();
        if (p.smithy && p.gold > 150 && ruler.body > 10) return { cmd: 'Travel', steps: [{ t: 'menu', v: 'Go to Smithy' }, { t: 'number', v: Math.round(p.gold * 0.5) }] };
        if (p.support > 55 && wise.body > 15) return { cmd: 'Solicit', steps: [{ t: 'menu', v: 'Metal' }].concat(hero(wise)) };
      }
      if (p.skill < 80 && drill.body > 10 && men) return { cmd: 'Train', steps: hero(drill) };
      var h2 = p.gold >= 100 + reserve ? hire(100, 0.6, 8) : null;
      if (h2) return h2;
      var towns = W.townsAt(s, prefId).filter(function (c) { return A.willJoin(s, f.id, c, ruler); });
      if (towns.length && hs.length < Math.min(10, p.castles * 5) && perHero >= 50 && ruler.body > 10) {
        var t = pick(towns, function (c) { return c.str + c.dex + c.wis; });
        return { cmd: 'Travel', steps: [{ t: 'menu', v: 'Go Downtown' }, { t: 'menu', v: 'Recruit someone' }, { t: 'hero', v: t.name }] };
      }
      if (p.arms < 90 && p.metal >= 10 && canForge) return weapons();
      var low = ['land', 'wealth', 'flood'].sort(function (a, b) { return p[a] - p[b]; })[0];
      if (p[low] < 85 && worker.body > 15) {
        return { cmd: 'Service', steps: [{ t: 'menu', v: { flood: 'Flood Control', land: 'Cultivation', wealth: 'Construction' }[low] }].concat(hero(worker)) };
      }
      var avg = hs.reduce(function (a, c) { return a + c.loyalty; }, 0) / hs.length;
      if (avg < 75 && p.gold > A.feastCost(s, prefId) + 100) return { cmd: 'Feast', steps: [{ t: 'confirm', v: true }] };
      if (p.skill < 100 && drill.body > 10 && men) return { cmd: 'Train', steps: hero(drill) };
      return { cmd: 'Rest', steps: [] };
    },

    exilePlan: function (s, fid) {
      var f = W.faction(s, fid), lead = W.leader(s, fid), band = W.exileBand(s, fid);
      var power = band.reduce(function (a, c) { return a + W.unitPower(c.men, 25, 35, c); }, 0);
      var here = W.pref(s, f.exileAt);
      if (!W.attackBlock(s, fid, here.id, here.id) && power > W.defenseValue(s, here.id) * 1.3) {
        AP.battles++;
        return { cmd: 'Settle', steps: [{ t: 'heroes', v: band.map(function (c) { return c.name; }) }, { t: 'confirm', v: true }] };
      }
      var towns = W.townsAt(s, here.id).filter(function (c) { return BK.Actions.willJoin(s, fid, c, lead); });
      if (towns.length && band.length < 10) {
        return { cmd: 'Recruit Hero', steps: [{ t: 'menu', v: 'Seek heroes in town' }, { t: 'menu', v: 'Recruit someone' }, { t: 'hero', v: towns[0].name }] };
      }
      var room = band.some(function (c) { return c.men < W.menCap(c) - 5; });
      if (room) return { cmd: 'Recruit Hero', steps: [{ t: 'menu', v: 'Gather bandits' }] };
      var weak = W.neighbors(here.id).filter(function (n) { return !W.pref(s, n).snowbound && W.defenseValue(s, n) < W.defenseValue(s, here.id); });
      if (weak.length && !here.snowbound) return { cmd: 'Flee', steps: [{ t: 'pref', v: weak[0] }] };
      return { cmd: 'Rest', steps: [] };
    },

    // Steps from each of the faction's prefectures to the nearest one bordering Kaifeng,
    // travelling only through its own territory; null when it holds none on that border.
    frontDist: function (s, f) {
      var cap = BK.MapData.capital, own = {}, d = {}, q = [];
      W.factionPrefs(s, f.id).forEach(function (p) { own[p.id] = true; });
      Object.keys(own).forEach(function (id) {
        id = +id;
        if (W.neighbors(id).indexOf(cap) >= 0) { d[id] = 0; q.push(id); }
      });
      if (!q.length) return null;
      while (q.length) {
        var c = q.shift();
        W.neighbors(c).forEach(function (n) { if (own[n] && d[n] == null) { d[n] = d[c] + 1; q.push(n); } });
      }
      return d;
    },

    dist: function (a, b) {
      AP._d = AP._d || {};
      var k = a + ':' + b;
      if (AP._d[k] != null) return AP._d[k];
      var seen = {}, q = [a];
      seen[a] = 0;
      while (q.length) {
        var c = q.shift();
        W.neighbors(c).forEach(function (n) { if (seen[n] == null) { seen[n] = seen[c] + 1; q.push(n); } });
      }
      return (AP._d[k] = seen[b]);
    },

    // --- Battles: pick a command button, then click the target hex ------------------------------
    battleStep: function () {
      var V = BK.BattleView;
      if ($('.bresult')) { click($('#battle')); return; }
      if (!V.b || !V.cur || !V.isHuman(V.cur.side) || V.mode !== 'cmd' || !V.acted) return;
      var b = V.b, u = V.cur, h = b.hero(u), B = BK.Battle;
      // Give the first day's orders by hand, then hand command to the officers with Delegate.
      if (AP.opts.delegate !== false && b.day > 1) {
        var del = $$('.bcmds .cmd').filter(function (x) { return x.dataset.cmd === 'delegate' && !x.disabled; })[0];
        if (del) { AP.clicks++; click(del); return; }
      }
      var foes = b.live(b.other(u.side)).sort(function (x, y) { return B.dist(u, x) - B.dist(u, y); });
      var leader = u.side === 'atk' ? b.atkLeader : b.defLeader;
      var choose = function (cmd, target) {
        // A hero at 10 Body or less can only rest.
        if (h.body <= 10) { cmd = 'rest'; target = null; }
        var btn = $$('.bcmds .cmd').filter(function (x) { return x.dataset.cmd === cmd && !x.disabled; })[0];
        if (!click(btn)) return false;
        AP.clicks++;
        if (!target) return true;
        var cx = 9 + 19 + target.q * 1.5 * 19, cy = 1 + Math.sqrt(3) * 19 / 2 + target.r * Math.sqrt(3) * 19 + (target.q & 1 ? Math.sqrt(3) * 19 / 2 : 0);
        var cv = $('#field canvas'), r = cv.getBoundingClientRect();
        cv.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: r.left + cx / 456 * r.width, clientY: r.top + cy / 380 * r.height }));
        AP.clicks++;
        return true;
      };
      if (!foes.length) return choose('rest');
      // Keep the commander out of the press: losing him loses the battle.
      if (u.cid === leader) {
        var threat = foes.filter(function (o) { return B.dist(u, o) === 1; }).reduce(function (a, o) { return a + b.pw(o); }, 0);
        if (threat && b.pw(u) < threat * 1.6) {
          var safe = b.reachable(u).filter(function (p) { return !foes.some(function (o) { return B.dist(o, p) <= 1; }); });
          if (safe.length) {
            safe.sort(function (x, y) {
              return ((b.cell(y.q, y.r).t === 'castle') - (b.cell(x.q, x.r).t === 'castle')) ||
                (Math.min.apply(null, foes.map(function (o) { return B.dist(o, y); })) - Math.min.apply(null, foes.map(function (o) { return B.dist(o, x); })));
            });
            return choose('move', safe[0]);
          }
        }
        if (!threat && u.side === 'def') {
          if (b.cell(u.q, u.r).t === 'castle') return choose('rest');
          var keep = b.reachable(u).filter(function (p) { return b.cell(p.q, p.r).t === 'castle' && !foes.some(function (o) { return B.dist(o, p) <= 2; }); })[0];
          return keep ? choose('move', keep) : choose('rest');
        }
      }
      var magic = b.canMagic(u) ? b.targets(u, 'magic').sort(function (x, y) { return y.unit.men - x.unit.men; })[0] : null;
      if (magic) return choose('magic', magic);
      var adj = b.targets(u, 'melee').sort(function (x, y) { return x.unit.men - y.unit.men; });
      if (adj.length && (u.cid !== leader || b.pw(u) > b.pw(adj[0].unit) * 1.5)) return choose('melee', adj[0]);
      var arrows = b.targets(u, 'archery');
      if (arrows.length && h.dex >= 65) return choose('archery', arrows[0]);
      if (u.cid === leader && u.side === 'atk' && B.dist(u, foes[0]) <= 3) return choose('rest');
      var spots = b.reachable(u);
      if (u.side === 'def') {
        if (b.cell(u.q, u.r).t === 'castle') return choose('rest');
        var free = b.castles.filter(function (c) { return !b.unitAt(c.q, c.r); });
        if (free.length) {
          var goal = free.sort(function (x, y) { return B.dist(u, x) - B.dist(u, y); })[0];
          var sp = spots.sort(function (x, y) { return B.dist(x, goal) - B.dist(y, goal); })[0];
          if (sp) return choose('move', sp);
        }
        return choose('rest');
      }
      var near = foes[0];
      var castle = b.castles.filter(function (c) { var o = b.unitAt(c.q, c.r); return !o; })[0];
      var target = b.live('def').length <= 2 && castle ? castle : near;
      var best = spots.sort(function (x, y) { return B.dist(x, target) - B.dist(y, target); })[0];
      if (best && B.dist(best, target) < B.dist(u, target)) return choose('move', best);
      return choose('rest');
    }
  };
})();
