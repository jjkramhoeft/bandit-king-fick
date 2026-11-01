/* The month loop. Talks to the screen only through `io`, an object of async functions,
   so the same loop runs in the browser and headless in tests. */
(function (root) {
  'use strict';
  var BK = root.BK = root.BK || {};
  var W = BK.World, A = BK.Actions;

  function Game(state, io) {
    this.s = state;
    this.io = io;
    this.stopped = false;
  }

  Game.prototype = {
    humanFaction: function (fid) { var f = W.faction(this.s, fid); return !!(f && f.human && f.alive); },
    humansAlive: function () { return this.s.players.filter(function (p) { return p.alive; }).length; },
    concerns: function (ev) {
      var s = this.s, self = this;
      if (ev.global) return true;
      if (ev.faction != null && self.humanFaction(ev.faction)) return true;
      if (ev.pref) { var p = W.pref(s, ev.pref); return self.humanFaction(p.owner); }
      return false;
    },

    buildQueue: function () {
      var s = this.s, q = [];
      s.prefs.forEach(function (p) {
        if (p.owner != null && W.heroesAt(s, p.id).length) q.push({ k: 'p', id: p.id, owner: p.owner });
      });
      s.factions.forEach(function (f) {
        if (f.alive && W.isExiled(s, f.id) && f.exileAt) q.push({ k: 'x', f: f.id });
      });
      return W.rng(s).shuffle(q);
    },

    run: async function () {
      var s = this.s, io = this.io;
      var hadHumans = s.players.length > 0;
      while (!s.over && !this.stopped) {
        if (s.phase === 'monthStart') {
          await io.newMonth(s);
          await this.monthStart();
          if (s.over || this.stopped) break;
          s.queue = this.buildQueue();
          s.qi = 0;
          s.phase = 'rotation';
        }
        if (s.phase === 'rotation') {
          while (s.qi < s.queue.length && !s.over && !this.stopped) {
            await this.turn(s.queue[s.qi]);
            if (this.stopped) return;
            s.qi++;
            if (hadHumans && !this.humansAlive()) { s.over = true; break; }
          }
          if (s.over) break;
          s.phase = 'monthEnd';
        }
        if (s.phase === 'monthEnd') {
          await this.monthEnd();
          BK.Econ.advance(s);
          s.phase = 'monthStart';
          if (s.month === 1 && io.autosave) io.autosave(s);
        }
        if (hadHumans && !this.humansAlive()) s.over = true;
      }
      if (!this.stopped) await io.gameOver(s, this.outcome());
    },

    outcome: function () {
      var s = this.s;
      if (s.winner != null) {
        return { kind: this.humanFaction(s.winner) || (W.faction(s, s.winner).human) ? 'win' : 'lose', winner: s.winner };
      }
      if (s.invaded) return { kind: 'invasion' };
      return { kind: 'lose' };
    },

    monthStart: async function () {
      var s = this.s, io = this.io, self = this;
      var events = BK.Econ.monthStart(s);
      var taxes = {};
      for (var i = 0; i < events.length; i++) {
        var ev = events[i];
        if (ev.kind === 'invasion') {
          s.over = true; s.invaded = true;
          await io.event(ev);
          return;
        }
        if (ev.kind === 'tax') {
          var p = W.pref(s, ev.pref);
          if (self.humanFaction(p.owner)) (taxes[p.owner] = taxes[p.owner] || []).push(ev.text);
          continue;
        }
        if (ev.kind === 'arrival') { await this.arrival(ev); continue; }
        if (ev.kind === 'riotThreat') {
          var rp = W.pref(s, ev.pref);
          await io.focus(rp.id);
          var pay = rp.gold >= ev.cost && await io.confirm(ev.text + '\nPay ' + ev.cost + ' gold to calm them?', { scene: 'riot' });
          if (pay) { rp.gold -= ev.cost; await io.say('The crowds take the silver and go home.', { scene: 'market' }); }
          else await io.say(BK.Econ.riot(s, rp), { scene: 'riot' });
          continue;
        }
        if (ev.kind === 'demand') { await this.demand(ev); if (s.over) return; continue; }
        if (!ev.quiet && this.concerns(ev)) await io.event(ev);
      }
      var fids = Object.keys(taxes);
      for (var j = 0; j < fids.length; j++) {
        await io.event({ kind: 'tax', text: 'Tax day for ' + W.factionName(s, +fids[j]) + ':\n' + taxes[fids[j]].join('\n'), faction: +fids[j], scene: 'market' });
      }
    },

    monthEnd: async function () {
      var events = BK.Econ.monthEnd(this.s);
      for (var i = 0; i < events.length; i++) {
        if (!events[i].quiet && this.concerns(events[i])) await this.io.event(events[i]);
      }
    },

    arrival: async function (ev) {
      var s = this.s, c = W.char(s, ev.char), f = W.faction(s, ev.faction);
      if (c.status !== 'free' || !f.alive) return;
      if (f.human) {
        await this.io.focus(ev.pref);
        if (await this.io.confirm(ev.text + '\nAccept ' + c.name + '?', { char: c.id, scene: 'travel' })) {
          A.enlist(s, c, f.id, ev.pref, W.rng(s).int(60, 85));
          await this.io.say(c.name + ' joins your band.');
        }
      } else if (W.heroesAt(s, ev.pref).length < W.pref(s, ev.pref).castles * 5) {
        A.enlist(s, c, f.id, ev.pref, W.rng(s).int(60, 85));
      }
    },

    demand: async function (ev) {
      var s = this.s, p = W.pref(s, ev.pref), f = W.faction(s, p.owner);
      if (!f || !f.alive) return;
      var pay;
      if (f.human) {
        await this.io.focus(p.id);
        pay = await this.io.confirm(ev.text + '\nPay the tribute? (Refusing invites an imperial attack.)', { scene: 'edict' });
      } else pay = BK.AI.paysDemand(s, p.id);
      if (pay) {
        p.gold = Math.max(0, p.gold - ev.amount);
        if (f.human) await this.io.say('The envoy leaves with ' + ev.amount + ' gold, smiling.');
        return;
      }
      A.earn(s, f.id, 5);
      var plan = BK.AI.punishPlan(s, p.id);
      if (f.human) await this.io.say('You send the envoy back with his hat full of mud. The people cheer. ' +
        (plan ? 'Imperial troops march on ' + p.name + '!' : 'For now, nobody comes to punish you.'), { scene: 'riot' });
      if (plan) await this.war(plan);
    },

    turn: async function (e) {
      var s = this.s;
      if (e.k === 'p') {
        var p = W.pref(s, e.id);
        if (p.owner !== e.owner || !W.heroesAt(s, p.id).length) return;
        var f = W.faction(s, p.owner);
        if (f.human && W.isDirect(s, p.id)) {
          var r = await BK.Flows.prefTurn(this, p.id);
          if (r && r.quit) this.stopped = true;
          return;
        }
        await this.aiTurn(BK.AI.decide(s, p.id), p.id);
      } else {
        var fx = W.faction(s, e.f);
        if (!fx.alive || !W.isExiled(s, e.f) || !fx.exileAt) return;
        if (fx.human) {
          var rx = await BK.Flows.exileTurn(this, e.f);
          if (rx && rx.quit) this.stopped = true;
          return;
        }
        await this.aiTurn(BK.AI.decideExile(s, e.f), fx.exileAt);
      }
    },

    aiTurn: async function (d, prefId) {
      var s = this.s;
      if (d.type === 'war') { await this.war(d.plan); return; }
      if (d.type === 'action' && d.result && d.result.ok && this.humanFaction(W.pref(s, prefId).owner)) {
        var p = W.pref(s, prefId);
        await this.io.chieftain(p.id, W.char(s, p.ruler).name + ' of ' + p.name + ': ' + d.result.text, d.result.scene);
      }
    },

    // Run a war plan to the end: battle (human or auto), consequences, prisoners.
    war: async function (plan) {
      var s = this.s, io = this.io, self = this;
      var target = W.pref(s, plan.target);
      var defFid = target.owner;
      var atkHuman = this.humanFaction(plan.fid), defHuman = this.humanFaction(defFid);
      var b = BK.War.start(s, plan);
      var seen = atkHuman || defHuman;
      if (seen) {
        await io.focus(plan.target);
        await io.say(W.leader(s, plan.fid).name + '\'s army marches on ' + target.name + '!', { scene: 'march', music: 'dispatch' });
      }
      // As in the original, a defender may abandon the prefecture rather than fight.
      if (defHuman && !b.over) {
        var atkMen = b.live('atk').reduce(function (a, u) { return a + u.men; }, 0);
        var fight = await io.confirm(b.live('atk').length + ' heroes and ' + atkMen + ' men are at the gates of ' + target.name +
          '.\nStand and fight? (No: abandon ' + target.name + ' and flee)', { scene: 'march' });
        if (!fight) {
          b.live('def').forEach(function (u) { u.gone = 'fled'; });
          b.finish('atk', 'The defenders abandon ' + target.name + ' without a fight.');
        }
      }
      if (!b.over) {
        if (seen) await io.battle(b, { atk: atkHuman, def: defHuman });
        else b.autoResolve();
      }
      var res = BK.War.apply(s, b);
      await io.refresh();
      if (seen) await io.say(res.text, { scene: b.result.winner === 'atk' ? (atkHuman ? 'victory' : 'defeat') : (defHuman ? 'victory' : 'defeat') });
      else if (res.conquered) await io.news(res.text, plan.target);
      var mine = res.captured.filter(function (x) { return self.humanFaction(x.captor); });
      var theirs = res.captured.filter(function (x) { return !self.humanFaction(x.captor); });
      if (mine.length) await BK.Flows.prisoners(this, mine);
      var notes = BK.War.aiPrisoners(s, theirs);
      if (seen && notes.length) await io.say(notes.join(' '));
      await io.refresh();
    }
  };

  BK.Game = Game;
  if (typeof module !== 'undefined' && module.exports) module.exports = Game;
})(typeof window !== 'undefined' ? window : globalThis);
