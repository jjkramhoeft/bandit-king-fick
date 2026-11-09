/* Human turns: walks the player through a command and its choices using the io prompts,
   then applies the matching BK.Actions call. A flow returns 'done' when the month's command
   is spent, 'again' to show the command menu once more, or 'quit'. */
(function (root) {
  'use strict';
  var BK = root.BK = root.BK || {};
  var W = BK.World, A = BK.Actions;

  var HERO_COLS = ['body', 'str', 'dex', 'wis', 'men', 'loyalty'];

  async function report(io, r) {
    await io.say(r.text, { scene: r.scene, error: !r.ok });
    return r.ok ? 'done' : 'again';
  }
  async function pickHero(io, prompt, heroes, cols) {
    if (!heroes.length) { await io.say('There is nobody suitable.', { error: true }); return null; }
    if (heroes.length === 1) return heroes[0].id;
    return io.pickChar(prompt, heroes, { cols: cols || HERO_COLS });
  }
  async function sub(io, prompt, cmd) {
    return io.menu(prompt, cmd.subs.map(function (x) { return { label: x[0], value: x[1] }; }));
  }

  var F = BK.Flows = {
    HERO_COLS: HERO_COLS,

    prefTurn: async function (G, prefId) {
      var io = G.io;
      await io.focus(prefId);
      for (var guard = 0; guard < 200; guard++) {
        if (G.stopped) return { quit: true };
        var cmd = await io.command(prefId);
        if (G.stopped) return { quit: true };
        if (!cmd) continue;
        var r = await F.run(G, prefId, cmd);
        if (r === 'quit') return { quit: true };
        if (r === 'done') { await io.refresh(); return {}; }
        await io.focus(prefId);
      }
      return {};
    },

    run: async function (G, prefId, id) {
      var s = G.s, io = G.io, p = W.pref(s, prefId), f = W.faction(s, p.owner);
      var cmd = A.CMDS.filter(function (c) { return c.id === id; })[0];
      var heroes = W.heroesAt(s, prefId);
      var lead = W.char(s, p.ruler);
      var choice, h, n, t, r;
      switch (id) {
        case 'fight':
          choice = await sub(io, 'Fight whom?', cmd);
          if (choice === 'war') return F.war(G, prefId);
          if (choice === 'beasts') {
            if (!p.beasts) { await io.say('No beasts trouble ' + p.name + ' this season.', { error: true }); return 'again'; }
            h = await pickHero(io, 'Who will hunt down the ' + A.beastKind(p) + '? (costs 10 Body)', heroes, ['body', 'dex', 'men', 'courage']);
            return h == null ? 'again' : report(io, A.fightBeasts(s, prefId, h));
          }
          return 'again';

        case 'service':
          choice = await io.menu('What work?', [
            { label: 'Flood Control   (flood ' + p.flood + ')', value: 'flood' },
            { label: 'Cultivation     (land ' + p.land + ')', value: 'farm' },
            { label: 'Construction    (wealth ' + p.wealth + (p.wealth >= 70 && p.castles < 7 ? ', can raise a castle for 230 gold' : '') + ')', value: 'build' }]);
          if (!choice) return 'again';
          h = await pickHero(io, 'Who will lead the work? (costs 15 Body)', heroes, ['body', 'str']);
          return h == null ? 'again' : report(io, A.service(s, prefId, h, choice));

        case 'make':
          choice = await sub(io, 'Make what?', cmd);
          if (choice === 'weapons') {
            h = await pickHero(io, 'Who will oversee the forge? (Dexterity 60 and Wisdom 50; costs 15 Body)', heroes.filter(A.canForge), ['body', 'dex', 'wis']);
            if (h == null) return 'again';
            n = await io.number('Use how much metal? (' + p.metal + ' on hand)', 0, p.metal, p.metal);
            return n ? report(io, A.makeWeapons(s, prefId, h, n)) : 'again';
          }
          if (choice === 'ships') {
            h = await pickHero(io, 'Which steersman will build the ship? (150 gold, 15 Body)', heroes.filter(function (c) { return c.steersman; }), ['body', 'dex', 'wis']);
            return h == null ? 'again' : report(io, A.makeShips(s, prefId, h));
          }
          return 'again';

        case 'move':
          choice = await sub(io, 'Move what?', cmd);
          if (choice === 'hero') {
            var dests = W.neighbors(prefId).filter(function (x) { return W.pref(s, x).owner === p.owner; });
            if (!dests.length) { await io.say('None of your prefectures borders ' + p.name + '.', { error: true }); return 'again'; }
            t = await io.pickPref('Move heroes to which prefecture?', dests);
            if (t == null) return 'again';
            var who = await io.pickChars('Which heroes march to ' + W.pref(s, t).name + '?', heroes, { min: 1, max: heroes.length - 1, cols: HERO_COLS });
            return who && who.length ? report(io, A.moveHeroes(s, prefId, t, who)) : 'again';
          }
          if (choice === 'supplies') {
            var mine = W.factionPrefs(s, p.owner).map(function (x) { return x.id; }).filter(function (x) { return x !== prefId; });
            if (!mine.length) { await io.say('You have no other prefecture to supply.', { error: true }); return 'again'; }
            t = await io.pickPref('Send supplies to which prefecture?', mine);
            if (t == null) return 'again';
            var amt = {};
            var keys = ['gold', 'food', 'metal', 'fur'];
            for (var i = 0; i < keys.length; i++) {
              if (!p[keys[i]]) continue;
              n = await io.number('Send how much ' + keys[i] + '? (' + p[keys[i]] + ' on hand)', 0, p[keys[i]], 0);
              if (n == null) return 'again';
              amt[keys[i]] = n;
            }
            return report(io, A.moveSupplies(s, prefId, t, amt));
          }
          if (choice === 'to exile') {
            if (W.factionPrefs(s, p.owner).length > 1) { await io.say('You can only go into exile from your last prefecture.', { error: true }); return 'again'; }
            t = await io.pickPref('Flee to which neighbouring prefecture?', W.neighbors(prefId));
            if (t == null) return 'again';
            if (!await io.confirm('Abandon ' + p.name + ' and live as outlaws in ' + W.pref(s, t).name + '?')) return 'again';
            return report(io, A.goExile(s, prefId, t));
          }
          return 'again';

        case 'ally':
          return F.ally(G, prefId);

        case 'travel':
          return F.travel(G, prefId);

        case 'solicit':
          choice = await sub(io, 'Demand what from the people?', cmd);
          if (!choice) return 'again';
          h = await pickHero(io, 'Who will collect? (costs 15 Body)', heroes, ['body', 'wis', 'dex']);
          return h == null ? 'again' : report(io, A.solicit(s, prefId, h, choice));

        case 'hunt':
          if (W.season(s) === 'Winter') { await io.say('There is no game to hunt in winter.', { error: true }); return 'again'; }
          choice = await sub(io, 'Hunt for what?', cmd);
          if (!choice) return 'again';
          h = await pickHero(io, 'Who leads the hunt? (costs 20 Body)', heroes, ['body', 'dex']);
          return h == null ? 'again' : report(io, A.hunt(s, prefId, h, choice));

        case 'heroes':
          return F.heroes(G, prefId);

        case 'organize':
          choice = await sub(io, 'Organize troops:', cmd);
          if (choice === 'hire men') {
            h = await pickHero(io, 'Who will lead the new recruits? (' + A.hireCost(p) + ' gold per man)', heroes, ['men', 'str', 'courage', 'loyalty']);
            if (h == null) return 'again';
            var c = W.char(s, h);
            var max = Math.min(W.menCap(c) - c.men, A.hireLimit(p), Math.floor(p.gold / A.hireCost(p)));
            if (max < 1) { await io.say(c.name + ' cannot take more men. (limit ' + W.menCap(c) + ', gold ' + p.gold + ')', { error: true }); return 'again'; }
            n = await io.number('Hire how many men? (up to ' + max + ')', 0, max, max);
            return n ? report(io, A.hireMen(s, prefId, h, n)) : 'again';
          }
          if (choice === 'give men') {
            if (heroes.length < 2) { await io.say('There is only one hero here.', { error: true }); return 'again'; }
            var from = await io.pickChar('Take men from whom?', heroes, { cols: ['men', 'str', 'loyalty'] });
            if (from == null) return 'again';
            var to = await io.pickChar('Give them to whom?', heroes.filter(function (x) { return x.id !== from; }), { cols: ['men', 'str', 'loyalty'] });
            if (to == null) return 'again';
            n = await io.number('How many men?', 0, W.char(s, from).men, Math.floor(W.char(s, from).men / 2));
            return n ? report(io, A.giveMen(s, from, to, n)) : 'again';
          }
          if (choice === 'ships') {
            if (!p.ships) { await io.say(p.name + ' has no spare ships. Make or buy one first.', { error: true }); return 'again'; }
            h = await pickHero(io, 'Give a ship to whom? (' + p.ships + ' in harbour)', heroes.filter(function (x) { return !x.ship; }), ['men', 'str', 'dex']);
            return h == null ? 'again' : report(io, A.assignShip(s, prefId, h));
          }
          return 'again';

        case 'train':
          h = await pickHero(io, 'Who will drill the troops? (Skill ' + p.skill + '; costs 10 Body)', heroes, ['body', 'str', 'dex']);
          return h == null ? 'again' : report(io, A.train(s, prefId, h));

        case 'feast':
          if (!await io.confirm('Hold a feast for ' + heroes.length + ' heroes? It costs ' + A.feastCost(s, prefId) + ' gold.')) return 'again';
          return report(io, A.feast(s, prefId));

        case 'rest':
          return report(io, A.rest(s, prefId));

        case 'give':
          choice = await sub(io, 'Give to whom?', cmd);
          if (choice === 'citizens') {
            n = await io.number('Give how much food to the people? (up to 1000; ' + p.food + ' on hand)', 0, Math.min(p.food, 1000), Math.min(p.food, 200));
            return n ? report(io, A.giveCitizens(s, prefId, n)) : 'again';
          }
          if (choice === 'hero') {
            var others = heroes.filter(function (x) { return x.id !== f.leader; });
            h = await pickHero(io, 'Reward which hero?', others, ['loyalty', 'men', 'int']);
            if (h == null) return 'again';
            n = await io.number('How much gold? (up to 100; ' + p.gold + ' on hand)', 0, Math.min(p.gold, 100), Math.min(p.gold, 50));
            return n ? report(io, A.giveHero(s, prefId, h, n)) : 'again';
          }
          return 'again';

        case 'view':
          await F.view(G, prefId);
          return 'again';

        case 'other':
          return F.interrupt(G, lead.name);
      }
      return 'again';
    },

    war: async function (G, prefId, exileFid) {
      var s = G.s, io = G.io;
      var fid = exileFid != null ? exileFid : W.pref(s, prefId).owner;
      var f = W.faction(s, fid);
      var exile = exileFid != null;
      var targets = exile ? [f.exileAt] : W.neighbors(prefId);
      var valid = targets.filter(function (t) { return !W.attackBlock(s, fid, exile ? t : prefId, t) || (exile && W.pref(s, t).owner == null); });
      if (exile) valid = targets.filter(function (t) { return !W.attackBlock(s, fid, t, t) || W.pref(s, t).owner == null; });
      if (!valid.length) {
        var why = exile ? W.attackBlock(s, fid, f.exileAt, f.exileAt) : 'There is no prefecture you can attack from here.';
        await io.say(why || 'You cannot attack.', { error: true });
        return 'again';
      }
      var target = exile ? valid[0] : await io.pickPref('Attack which prefecture?', valid);
      if (target == null) return 'again';
      var tp = W.pref(s, target);
      if (tp.owner != null && f.treaties.indexOf(tp.owner) >= 0 &&
        !await io.confirm('You have a treaty with ' + W.factionName(s, tp.owner) + '. Break it? Your popularity will suffer.')) return 'again';
      var pool = exile ? W.exileBand(s, fid) : W.heroesAt(s, prefId);
      var maxN = exile ? Math.min(10, pool.length) : Math.min(10, pool.length - 1);
      if (maxN < 1) { await io.say('At least one hero must stay behind to hold ' + W.pref(s, prefId).name + '.', { error: true }); return 'again'; }
      var ids = await io.pickChars('Who marches on ' + tp.name + '? (up to ' + maxN + ')', pool, { min: 1, max: maxN, cols: ['men', 'body', 'str', 'dex', 'wis'] });
      if (!ids || !ids.length) return 'again';
      var food = 0;
      var need = BK.War.foodNeed(s, ids);
      if (!exile) {
        var sp = W.pref(s, prefId);
        food = await io.number('Carry how much food? An army this size eats about ' + need + ' in a month. (' + sp.food + ' on hand)', 0, sp.food, Math.min(sp.food, need));
        if (food == null) return 'again';
      }
      var men = ids.reduce(function (a, id) { return a + W.char(s, id).men; }, 0);
      var pay = exile ? 0 : BK.War.provisions(s, ids);
      if (pay > W.pref(s, prefId).gold) { await io.say('Provisions for this army cost ' + pay + ' gold, and you have ' + W.pref(s, prefId).gold + '.', { error: true }); return 'again'; }
      if (!await io.confirm('March on ' + tp.name + ' with ' + ids.length + ' heroes and ' + men + ' men' + (exile ? '' : ', carrying ' + food + ' food and ' + pay + ' gold of provisions') + '?\nDefenders: ' +
        W.heroesAt(s, target).length + ' heroes, ' + W.menAt(s, target) + ' men, ' + tp.castles + ' castles.')) return 'again';
      await G.war({ fid: fid, source: exile ? target : prefId, target: target, heroes: ids, food: food });
      return 'done';
    },

    ally: async function (G, prefId) {
      var s = G.s, io = G.io, fid = W.pref(s, prefId).owner, f = W.faction(s, fid), p = W.pref(s, prefId);
      var choice = await io.menu('Negotiate:', [{ label: 'Ally            (a three-year treaty)', value: 'treaty' }, { label: 'Invite to Lair  (bring a band into yours)', value: 'invite' }]);
      if (!choice) return 'again';
      // Exiles cannot sign treaties; only Good Fellows with fewer than two territories can be invited.
      var others = s.factions.filter(function (x) {
        if (!x.alive || x.kind !== 'goodfellow' || x.id === fid) return false;
        return choice === 'treaty' ? !W.isExiled(s, x.id) : W.factionPrefs(s, x.id).length < 2 && !x.human;
      });
      if (!others.length) { await io.say(choice === 'treaty' ? 'There is no Good Fellow to sign a treaty with.' : 'No Good Fellow is small enough to invite. (fewer than two territories)', { error: true }); return 'again'; }
      var items = others.map(function (x) {
        var tag = f.treaties.indexOf(x.id) >= 0 ? ' [treaty]' : '';
        return { label: W.leader(s, x.id).name + '  pop ' + W.popularity(s, x.id) + '  prefs ' + W.factionPrefs(s, x.id).length + tag, value: x.id };
      });
      var other = await io.menu(choice === 'treaty' ? 'Propose a treaty to whom?' : 'Invite whom to join you?', items);
      if (other == null) return 'again';
      var o = W.faction(s, other), them = W.leader(s, other);
      var envoys = W.heroesAt(s, prefId).filter(function (c) { return A.needBody(c, 25); });
      var m = await pickHero(io, 'Who will carry your message? (costs 25 Body)', envoys, ['body', 'wis', 'courage']);
      if (m == null) return 'again';
      var envoy = W.char(s, m);
      if (choice === 'treaty') {
        var extend = f.treaties.indexOf(other) >= 0;
        if (extend && !await io.confirm('Your treaty with ' + them.name + ' runs until ' + f.treatyEnd[other] + '. Extend it?')) return 'again';
        var gift = A.envoyGift(envoy, 50);
        if (p.gold < gift) { await io.say(envoy.name + ' needs ' + gift + ' gold for gifts.', { error: true }); return 'again'; }
        if (!await io.confirm(envoy.name + ' will need ' + gift + ' gold to win ' + them.name + ' over. Pay it?')) return 'again';
        p.gold -= gift;
        envoy.body -= 25;
        var yes = o.human ? await io.confirm(s.players[o.player].name + ' (' + them.name + '): ' + W.leader(s, fid).name + ' proposes a treaty. Accept?')
          : W.rng(s).chance(A.treatyChance(s, fid, other));
        A.gainExp(envoy, 'wis', yes ? 45 : 18);
        if (yes) return report(io, A.makeTreaty(s, fid, other));
        await io.say(them.name + ' sends your envoy away.', { scene: 'travel' });
        return 'done';
      }
      var cost = A.envoyGift(envoy, A.inviteCost(s, other));
      if (p.gold < cost) { await io.say('Gifts worthy of ' + them.name + ' cost ' + cost + ' gold.', { error: true }); return 'again'; }
      if (!await io.confirm('Send ' + cost + ' gold in gifts and invite ' + them.name + ' to join you?')) return 'again';
      p.gold -= cost;
      envoy.body -= 25;
      var joins = W.rng(s).chance(A.inviteChance(s, fid, other));
      A.gainExp(envoy, 'wis', joins ? 60 : 23);
      if (joins) return report(io, A.merge(s, fid, other));
      await io.say(them.name + ' keeps the gifts but declines.', { scene: 'travel' });
      return 'done';
    },

    travel: async function (G, prefId) {
      var s = G.s, io = G.io, p = W.pref(s, prefId), fid = p.owner, boss = W.char(s, p.ruler);
      if (!A.needBody(boss, 10)) { await io.say(boss.name + ' is too tired to go into town. (Body 10 needed)', { error: true }); return 'again'; }
      var r = await F.town(G, prefId);
      if (r === 'done') boss.body -= 10;
      return r;
    },

    town: async function (G, prefId) {
      var s = G.s, io = G.io, p = W.pref(s, prefId), fid = p.owner;
      var where = await io.menu('Travel to:', [
        { label: 'Go to Marketplace', value: 'market' },
        { label: 'Go Downtown', value: 'downtown' },
        { label: 'Go to Smithy' + (p.smithy ? '' : '   (none here)'), value: 'smithy', disabled: !p.smithy },
        { label: 'Go to Shipyard' + (p.shipyard ? '' : '   (none here)'), value: 'shipyard', disabled: !p.shipyard },
        { label: 'Return to Lair', value: null }]);
      if (!where) return 'again';
      if (where === 'market') return F.market(G, prefId);
      if (where === 'downtown') return F.downtown(G, prefId, fid, W.char(s, p.ruler), function () { return p.gold; }, function (n) { p.gold -= n; });
      if (where === 'smithy') {
        var per = A.armsCost(s, prefId);
        var n = await io.number('Each point of Arms costs ' + per + ' gold. Spend how much? (Arms ' + p.arms + ', gold ' + p.gold + ')', 0, p.gold, Math.min(p.gold, per * (100 - p.arms)));
        return n ? report(io, A.buyArms(s, prefId, n)) : 'again';
      }
      if (where === 'shipyard') {
        if (!await io.confirm('Buy a ship for ' + A.shipCost(p) + ' gold? (A hero given a ship can cross rivers and lakes in battle.)')) return 'again';
        return report(io, A.buyShip(s, prefId));
      }
      return 'again';
    },

    market: async function (G, prefId) {
      var s = G.s, io = G.io, p = W.pref(s, prefId), traded = false;
      for (var guard = 0; guard < 20; guard++) {
        var pr = A.prices(p);
        var f2 = function (x) { return x.toFixed(2); };
        var what = await io.menu('Market of ' + p.name + ' (rate ' + p.rate + ')   Gold ' + p.gold + '  Food ' + p.food + '  Fur ' + p.fur, [
          { label: 'Buy food    ' + f2(pr.foodBuy) + ' gold each', value: 'bf' },
          { label: 'Sell food   ' + f2(pr.foodSell) + ' gold each', value: 'sf' },
          { label: 'Buy fur     ' + f2(pr.furBuy) + ' gold each', value: 'bu' },
          { label: 'Sell fur    ' + f2(pr.furSell) + ' gold each', value: 'su' },
          { label: 'Leave the market', value: 'x' }]);
        if (!what || what === 'x') return traded ? 'done' : 'again';
        var item = what[1] === 'f' ? 'food' : 'fur', buy = what[0] === 'b';
        var unit = item === 'food' ? (buy ? pr.foodBuy : pr.foodSell) : (buy ? pr.furBuy : pr.furSell);
        var max = buy ? Math.floor(p.gold / unit) : p[item];
        var n = await io.number((buy ? 'Buy' : 'Sell') + ' how much ' + item + '? (up to ' + max + ')', 0, max, max);
        if (!n) continue;
        var r = A.trade(s, prefId, item, n, buy);
        await io.say(r.text, { scene: r.scene, error: !r.ok });
        if (r.ok) traded = true;
        await io.refresh();
      }
      return traded ? 'done' : 'again';
    },

    // Shared by prefecture and exile turns; purse functions read and spend the right gold.
    downtown: async function (G, prefId, fid, actor, purse, spend) {
      var s = G.s, io = G.io, p = W.pref(s, prefId);
      for (var guard = 0; guard < 20; guard++) {
        var towns = W.townsAt(s, prefId);
        var jailed = W.prisonersAt(s, prefId).filter(function (c) { return c.captor === fid; });
        var what = await io.menu('Downtown ' + p.name + ': ' + towns.length + ' people of note in town' + (jailed.length ? ', ' + jailed.length + ' in your prison' : '') + '. Purse: ' + purse() + ' gold.', [
          { label: 'Recruit someone', value: 'recruit', disabled: !towns.length && !jailed.length },
          { label: 'Divine their hearts   (1 gold each)', value: 'divine', disabled: !towns.length },
          { label: 'Hear rumours          (10 gold)', value: 'rumors' },
          { label: 'Leave', value: 'x' }]);
        if (!what || what === 'x') return 'again';
        if (what === 'divine') {
          if (purse() < towns.length) { await io.say('The fortune teller wants ' + towns.length + ' gold.', { error: true }); continue; }
          spend(towns.length);
          var lines = towns.map(function (c) {
            return c.name + ' (' + c.cls + '): ' + (A.willJoin(s, fid, c, actor) ? 'seems eager to join you.' : 'shows no interest this month.');
          });
          await io.say('The fortune teller reads the omens:\n' + lines.join('\n'), { scene: 'tavern' });
          continue;
        }
        if (what === 'rumors') {
          if (purse() < 10) { await io.say('The gossips want 10 gold.', { error: true }); continue; }
          spend(10);
          var rum = A.rumors(s, prefId).map(function (c) { return c.name + ' (' + c.cls + ') is in ' + W.pref(s, c.loc).name + '.'; });
          await io.say('Over wine you hear:\n' + (rum.join('\n') || 'Nothing of interest.'), { scene: 'tavern' });
          continue;
        }
        var pool = towns.concat(jailed);
        var who = await io.pickChar('Approach whom?', pool, { cols: ['cls', 'body', 'str', 'dex', 'wis', 'int'] });
        if (who == null) continue;
        var c = W.char(s, who);
        if (c.status === 'prisoner') {
          if (W.rng(s).chance(A.prisonerChance(s, fid, c))) {
            A.enlist(s, c, fid, prefId, W.rng(s).int(45, 70));
            await io.say(c.name + ' swears to serve you in exchange for freedom.', { scene: 'treaty' });
          } else await io.say(c.name + ' spits on the floor of the cell.', { scene: 'prison' });
          return 'done';
        }
        return report(io, A.recruit(s, fid, prefId, actor, c));
      }
      return 'again';
    },

    heroes: async function (G, prefId) {
      var s = G.s, io = G.io, p = W.pref(s, prefId), f = W.faction(s, p.owner);
      var heroes = W.heroesAt(s, prefId);
      var choice = await io.menu('Personnel:', [
        { label: 'Swear Brotherhood  (loyalty 95+)', value: 'brother' },
        { label: 'Promote            (appoint a chieftain; free)', value: 'promote' },
        { label: 'Exile              (dismiss a hero; popularity falls)', value: 'exile' },
        { label: 'Issue Orders       (standing orders for chieftains)', value: 'orders' }]);
      var h;
      if (choice === 'brother') {
        h = await pickHero(io, 'Swear brotherhood with whom?', heroes.filter(function (c) { return c.id !== f.leader && !c.brother; }), ['loyalty', 'int', 'courage']);
        return h == null ? 'again' : report(io, A.brother(s, h));
      }
      if (choice === 'exile') {
        h = await pickHero(io, 'Dismiss whom?', heroes.filter(function (c) { return c.id !== f.leader; }), ['loyalty', 'men', 'int']);
        if (h == null) return 'again';
        if (!await io.confirm('Dismiss ' + W.char(s, h).name + '? Their soldiers will scatter.')) return 'again';
        return report(io, A.banish(s, h));
      }
      if (choice === 'promote') {
        h = await pickHero(io, 'Who will be chieftain of ' + p.name + '?', heroes.filter(function (c) { return c.id !== f.leader && c.id !== p.ruler; }), ['loyalty', 'int', 'mercy', 'courage']);
        if (h == null) return 'again';
        var pr = A.promote(s, prefId, h);
        await io.say(pr.text, { scene: pr.scene, error: !pr.ok });
        return 'again';
      }
      if (choice === 'orders') {
        var ruled = W.factionPrefs(s, f.id).filter(function (x) { return !W.isDirect(s, x.id); }).map(function (x) { return x.id; });
        if (!ruled.length) { await io.say('All your prefectures take your orders directly.', { error: true }); return 'again'; }
        var t = await io.pickPref('Set orders for which prefecture?', ruled);
        if (t == null) return 'again';
        var o = await io.menu('Orders for the chieftain of ' + W.pref(s, t).name + ' (now: ' + W.pref(s, t).orders + '):', [
          { label: 'Entrust  (act as they see fit)', value: 'entrust' },
          { label: 'Develop  (build up, never attack)', value: 'develop' },
          { label: 'Expand   (attack weak neighbours)', value: 'expand' }]);
        return o ? report(io, A.setOrders(s, t, o)) : 'again';
      }
      return 'again';
    },

    view: async function (G, prefId, ownFid) {
      var s = G.s, io = G.io, fid = ownFid != null ? ownFid : (prefId ? W.pref(s, prefId).owner : null);
      var choice = await io.menu('View:', [
        { label: 'Your Home Prefecture', value: 'home', disabled: !prefId },
        { label: 'Other Prefecture', value: 'other' },
        { label: 'Your Territories', value: 'domain', disabled: fid == null },
        { label: 'Alliances       (the Good Fellows)', value: 'allies' },
        { label: 'Heroes    (your followers)', value: 'heroes', disabled: fid == null },
        { label: 'Chronicle (recent events)', value: 'log' }]);
      if (choice === 'home') await io.view('pref', prefId);
      else if (choice === 'other') {
        var t = await io.pickPref('View which prefecture?', s.prefs.map(function (p) { return p.id; }));
        if (t != null) await io.view('pref', t);
      } else if (choice === 'domain') await io.view('domain', fid);
      else if (choice === 'allies') await io.view('factions', fid);
      else if (choice === 'heroes') await io.view('heroes', fid);
      else if (choice === 'log') await io.view('log');
    },

    exileTurn: async function (G, fid) {
      var s = G.s, io = G.io, f = W.faction(s, fid), lead = W.leader(s, fid);
      for (var guard = 0; guard < 200; guard++) {
        if (G.stopped) return { quit: true };
        await io.focus(f.exileAt, fid);
        var cmd = await io.command(f.exileAt, fid);
        if (G.stopped) return { quit: true };
        if (!cmd) continue;
        var here = W.pref(s, f.exileAt), r;
        if (cmd === 'xfight') r = await F.war(G, f.exileAt, fid);
        else if (cmd === 'xmove') {
          var t = await io.pickPref('Flee to which prefecture? (costs ' + lead.name + ' 10 Body)', W.neighbors(f.exileAt));
          var others = W.exileBand(s, fid).filter(function (c) { return c.id !== f.leader; });
          var ids = [];
          if (t != null && others.length) {
            ids = await io.pickChars('Who comes along to ' + W.pref(s, t).name + '? Anyone you leave behind leaves the band.',
              others, { min: 0, max: others.length, cols: ['loyalty', 'men', 'body', 'str'], selected: others.map(function (c) { return c.id; }) });
            if (ids == null) t = null;
          }
          r = t == null ? 'again' : await report(io, A.wander(s, fid, t, ids));
        } else if (cmd === 'xrecruit') {
          var how = await io.menu('Recruit Hero:', [
            { label: 'Seek heroes in town     (recruit, divine, rumours)', value: 'town' },
            { label: 'Gather bandits          (desperate men join the band)', value: 'bandits' }]);
          if (how === 'town') r = await F.downtown(G, f.exileAt, fid, lead, function () { return lead.gold; }, function (n) { lead.gold -= n; });
          else if (how === 'bandits') r = await report(io, A.gather(s, fid));
          else r = 'again';
        } else if (cmd === 'xrest') {
          W.exileBand(s, fid).forEach(function (c) { c.body = Math.min(c.bodyMax, c.body + 10); });
          await io.say('The band rests in the hills of ' + here.name + '.', { scene: 'rest' });
          r = 'done';
        } else if (cmd === 'view') { await F.view(G, null, fid); r = 'again'; }
        else if (cmd === 'other') r = await F.interrupt(G, lead.name);
        if (r === 'quit') return { quit: true };
        if (r === 'done') { await io.refresh(); return {}; }
      }
      return {};
    },

    // Interrupt: save, pass the turn, or change sound, animation and message settings.
    interrupt: async function (G, who) {
      var io = G.io;
      var cmd = A.CMDS.filter(function (c) { return c.id === 'other'; })[0];
      var choice = await sub(io, 'Interrupt:', cmd);
      if (choice === 'save') { await io.saveGame(); return 'again'; }
      if (choice === 'wait') { await io.say(who + ' waits and watches.'); return 'done'; }
      if (choice === 'sound' || choice === 'animation' || choice === 'messages') {
        if (io.setting) await io.setting(choice);
        return 'again';
      }
      if (choice === 'quit') return (await io.confirm('Quit to the title screen? Unsaved progress will be lost.')) ? 'quit' : 'again';
      return 'again';
    },

    prisoners: async function (G, list) {
      var s = G.s, io = G.io;
      for (var i = 0; i < list.length; i++) {
        var c = W.char(s, list[i].cid), fid = list[i].captor;
        if (c.status !== 'prisoner') continue;
        var tried = false;
        for (var guard = 0; guard < 5; guard++) {
          var choice = await io.menu(c.name + ' has been captured. What will you do?', [
            { label: 'Recruit   (offer a place in your band)', value: 'recruit', disabled: tried },
            { label: 'Release   (mercy wins hearts)', value: 'release' },
            { label: 'Imprison  (keep for later)', value: 'imprison' },
            { label: 'Execute   (the people will not forget)', value: 'execute' }], { char: c.id, noCancel: true });
          if (choice === 'recruit') {
            tried = true;
            if (W.rng(s).chance(A.prisonerChance(s, fid, c))) {
              A.enlist(s, c, fid, c.loc, W.rng(s).int(45, 70));
              await io.say(c.name + ' agrees to join you.', { scene: 'treaty' });
              break;
            }
            await io.say(c.name + ' refuses to serve you.', { scene: 'prison' });
            continue;
          }
          if (choice === 'release') {
            A.release(s, c); A.earn(s, fid, 2);
            await io.say(c.name + ' is released and goes on their way.', { scene: 'travel' });
            break;
          }
          if (choice === 'execute') { var r = A.execute(s, fid, c); await io.say(r.text, { scene: r.scene }); break; }
          await io.say(c.name + ' is locked away.', { scene: 'prison' });
          break;
        }
      }
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = F;
})(typeof window !== 'undefined' ? window : globalThis);
