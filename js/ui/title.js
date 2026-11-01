/* Title screen, new-game setup (scenario, players, Good Fellows, stat rolls), loading and help. */
(function (root) {
  'use strict';
  var BK = root.BK = root.BK || {};
  var UI = function () { return BK.UI; };

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  var HELP =
    'You are one of the Good Fellows, outlaw heroes of the Water Margin. The Minister of War, Gao Qiu, ' +
    'has corrupted the Song court. Gather heroes, build up prefectures, win the people\'s support and destroy him ' +
    'before the Northern Barbarians invade in January 1127.\n\n' +
    'EACH MONTH every prefecture gets one command, in a random order. You give orders in your home prefecture ' +
    'and in any prefecture ruled by a sworn brother. Other chieftains follow the standing orders you set under Personnel → Issue Orders. Move your Good Fellow to the front before the final assault.\n\n' +
    'CHOOSE COMMANDS from the grid in the message window, from the Commands menu, or by typing their number. ' +
    'Click any prefecture on the map to peek at it. View and Promote are free and do not use up your turn. ' +
    'Every command costs the hero who carries it out some Body; heroes recover 5 Body a month, or 10 with Rest.\n\n' +
    'TROOPS: a hero leads at most 100 men, so a prefecture holds at most 100 men for each hero. A prefecture houses ' +
    'five heroes for each castle.\n\n' +
    'TAXES are paid in January, but only where Support is 40 or more. Keep Support up with Service and Give, ' +
    'and keep Food above what your soldiers eat each month.\n\n' +
    'POPULARITY grows with every prefecture whose Support is 40 or more, with slain beasts and with victories. ' +
    'Holding Liangshan Marsh (prefecture 19) is worth 100. If your Popularity is 250 or more when the Emperor looks ' +
    'for a champion in January, you receive the Imperial Edict, the only licence to attack Gao Qiu in Kaifeng (24).\n\n' +
    'BATTLES last up to 30 days on a hex map; the defender moves first each day and wins if the month runs out. ' +
    'The attacker wins by taking every defender, capturing their commander, holding every castle at the end of a day, ' +
    'or starving them out, and captures every defender still on the field. Ten heroes a side take the field; a defender ' +
    'can call up more with Reinforce. Archers (Dexterity over 60) shoot exactly two hexes along a line. ' +
    'Fireballs need Wisdom 60, dry weather and an adjacent target; Magic needs Wisdom 80, Body 50 and a cloudy day, ' +
    'and reaches 2 hexes, or 3 with Wisdom 90. A hero at 10 Body or less can only rest, and resting restores just 2 Body below 40. ' +
    'Only heroes with a ship (Organize → Assign Ships) can enter rivers and lakes away from the fords; steersmen start with one.\n\n' +
    'IF YOU LOSE your last prefecture you live in exile: Recruit Hero gathers bandits or followers in town, Flee moves the band, and Settle attacks the prefecture you hide in. ' +
    'If your Good Fellow is captured or slain, your game is over.\n\n' +
    'Keys: number keys pick commands, Enter or Space continues a message, Escape cancels. Right-click skips messages.';

  var T = BK.Title = {
    show: function () {
      var host = document.getElementById('title');
      UI().show('title');
      UI().s = null;
      UI().setStatus(BK.COMPANY.toUpperCase() + ' · ' + BK.TITLE);
      host.innerHTML = '';
      var cv = el('canvas');
      cv.id = 'titleart';
      cv.width = 320; cv.height = 200;
      host.appendChild(cv);
      if (T.art && T.art.stop) T.art.stop();
      T.art = null;
      if (BK.TitleArt && BK.TitleArt.render) {
        try { T.art = BK.TitleArt.render(cv); } catch (e) { if (root.console) console.warn(e); }
      }
      if (!T.art) {
        var g = cv.getContext('2d'), grad = g.createLinearGradient(0, 0, 0, 200);
        grad.addColorStop(0, '#1F3C8C'); grad.addColorStop(1, '#2E6B3A');
        g.fillStyle = grad; g.fillRect(0, 0, 320, 200);
      }
      var logo = el('div', 'tlogo');
      logo.appendChild(el('div', 'pre', BK.COMPANY.toUpperCase() + ' PRESENTS'));
      logo.appendChild(el('h1', null, 'Bandit King'));
      logo.appendChild(el('h1', null, 'of Ancient China'));
      logo.appendChild(el('div', 'sub', 'A strategy game of the Water Margin'));
      host.appendChild(logo);
      var foot = el('div', 'tfoot');
      foot.appendChild(el('div', 'press', 'Click or press a key to begin'));
      foot.appendChild(el('div', null, '© 1989, 2026 ' + BK.COMPANY + ' Co., Ltd.   Amiga version ' + BK.VERSION));
      host.appendChild(foot);
      BK.Art.music('title');
      var go = function (e) {
        if (e && e.target && e.target.closest && e.target.closest('#menubar')) return;
        T.unbind();
        if (host.hidden || BK.UI.pending) return;
        var press = host.querySelector('.press');
        if (press) press.hidden = true;
        T.startAudio();
        T.mainMenu();
      };
      T.unbind();
      T.unbind = function () {
        host.removeEventListener('click', go);
        document.removeEventListener('keydown', go);
        T.unbind = function () {};
      };
      setTimeout(function () {
        if (host.hidden) return;
        host.addEventListener('click', go);
        document.addEventListener('keydown', go);
      }, 200);
    },
    unbind: function () {},

    startAudio: function () {
      if (!BK.Music || !BK.Music.init) return;
      BK.Music.init();
      BK.Music.setEnabled(UI().settings.music);
      BK.Art.music('title');
    },

    mainMenu: async function () {
      for (;;) {
        var hasSave = BK.Save.SLOTS.some(function (k) { return !!BK.Save.meta(k); });
        var c = await UI().io.menu('Welcome, hero of the marsh.', [
          { label: 'New game', value: 'new' },
          { label: 'Load a saved game', value: 'load', disabled: !hasSave },
          { label: 'How to play', value: 'help' },
          { label: 'Music and sound: ' + (UI().settings.music ? 'on' : 'off'), value: 'music' }], { noCancel: true });
        if (c === 'new') { if (await T.newGame()) return; }
        else if (c === 'load') { if (await T.loadMenu()) return; }
        else if (c === 'help') await T.help();
        else if (c === 'music') UI().toggleMusic();
        else if (c == null) return;
      }
    },

    help: function () {
      return UI().req('How to play', HELP, [{ label: 'OK', value: true, primary: true }], { cancel: true, enter: true, width: 560 });
    },

    loadMenu: async function () {
      var items = BK.Save.SLOTS.map(function (k) {
        var m = BK.Save.meta(k);
        return { label: (k === 'auto' ? 'Autosave' : 'Slot ' + k) + ':  ' + (m ? m.date + ' · ' + m.players : '(empty)'), value: k, disabled: !m };
      });
      items.push({ label: 'From a file   (a game saved with Save game → To a file)', value: 'file' });
      var slot = await UI().io.menu('Load which game?', items);
      if (!slot) return false;
      var s = slot === 'file' ? await T.readFile() : BK.Save.read(slot);
      if (!s) { await UI().req('Load', 'No saved game could be read.', [{ label: 'OK', value: true }], { cancel: true }); return false; }
      if (T.art && T.art.stop) T.art.stop();
      UI().closeReq();
      UI().start(s);
      return true;
    },

    // Ask for a saved-game file and read it; null if none was chosen or it is not a saved game.
    readFile: function () {
      return new Promise(function (resolve) {
        var input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,application/json';
        input.addEventListener('change', function () {
          var file = input.files && input.files[0];
          if (!file) { resolve(null); return; }
          file.text().then(function (text) {
            var s = BK.Save.deserialize(text);
            resolve(s && s.chars && s.prefs && s.factions ? s : null);
          }).catch(function () { resolve(null); });
        });
        input.addEventListener('cancel', function () { resolve(null); });
        input.click();
      });
    },

    newGame: async function () {
      BK.Art.music('setup');
      var sc = await T.pickScenario();
      if (!sc) { BK.Art.music('title'); return false; }
      var difficulty = await UI().io.menu('How hard should Gao Qiu be?', [
        { label: 'Easy     (smaller imperial armies, richer taxes, wary rivals)', value: 'easy' },
        { label: 'Normal', value: 'normal' },
        { label: 'Hard     (a stronger empire, leaner taxes, bolder rivals)', value: 'hard' }]);
      if (!difficulty) { BK.Art.music('title'); return false; }
      var avail = Object.keys(sc.goodFellows);
      var nItems = [];
      for (var n = 0; n <= avail.length; n++) {
        nItems.push({ label: n === 0 ? '0 players   (watch the computer play)' : n + ' player' + (n > 1 ? 's (take turns at one screen)' : ''), value: String(n) });
      }
      var np = await UI().io.menu('How many players?', nItems);
      if (np == null) { BK.Art.music('title'); return false; }
      np = +np;
      var players = [], taken = [];
      for (var i = 0; i < np; i++) {
        var key = await T.pickFellow(sc, i, taken);
        if (!key) { BK.Art.music('title'); return false; }
        var stats = await T.rollStats(key, i);
        if (!stats) { BK.Art.music('title'); return false; }
        taken.push(key);
        players.push({ key: key, name: 'Player ' + (i + 1), stats: stats });
      }
      var seed = (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0;
      var s = BK.Setup.newGame({ scenarioId: sc.id, seed: seed, players: players, difficulty: difficulty });
      if (T.art && T.art.stop) T.art.stop();
      UI().closeReq();
      await UI().req(sc.year + ' A.D. · ' + sc.title, sc.blurb + '\n\nDestroy Gao Qiu before January 1127.', [{ label: 'Begin', value: true, primary: true }], { cancel: true, enter: true, width: 440 });
      UI().start(s);
      return true;
    },

    pickScenario: function () {
      var body = el('div');
      body.appendChild(el('div', 'hint', 'Choose a scenario. Later scenarios leave less time and face a stronger Gao Qiu.'));
      var info = el('div');
      info.style.minHeight = '64px';
      info.style.marginTop = '6px';
      BK.Scenarios.forEach(function (sc) {
        var b = el('button', 'menuitem', sc.id + '. ' + sc.year + ' A.D.   ' + sc.title + '   (' + Object.keys(sc.goodFellows).length + ' Good Fellows)');
        b.addEventListener('mouseenter', function () { info.textContent = sc.blurb; });
        b.addEventListener('focus', function () { info.textContent = sc.blurb; });
        b.addEventListener('click', function () { BK.Art.sfx('select'); UI().resolve('req', sc); });
        body.appendChild(b);
      });
      info.textContent = BK.Scenarios[0].blurb;
      body.appendChild(info);
      return UI().req('New game', body, [{ label: 'Cancel', value: null }], { cancel: null, width: 520, noFocus: true });
    },

    pickFellow: function (sc, i, taken) {
      var body = el('div');
      body.appendChild(el('div', 'hint', 'Player ' + (i + 1) + ', choose your Good Fellow.'));
      var grid = el('div', 'gfgrid');
      var gfColor = {};
      BK.Heroes.GOOD_FELLOWS.forEach(function (g) { gfColor[g.key] = g.color; });
      var info = el('div');
      info.style.marginTop = '6px';
      info.style.minHeight = '26px';
      Object.keys(sc.goodFellows).forEach(function (key) {
        var def = BK.Heroes.byKey(key), cfg = sc.goodFellows[key];
        var b = el('button', 'gfcard');
        b.disabled = taken.indexOf(key) >= 0;
        var probe = { key: key, name: key, role: 'hero', look: def.look };
        b.appendChild(BK.Art.portraitCanvas(probe, 64, 80));
        var nm = el('div');
        var sw = el('span', 'sw');
        sw.style.background = BK.PAL[gfColor[key]];
        nm.appendChild(sw);
        nm.appendChild(document.createTextNode(key));
        b.appendChild(nm);
        var where = BK.MapData.prefById(cfg.pref).name;
        var desc = '"' + def.nick + '". ' + (cfg.exile ? 'Begins in exile near ' + where : 'Holds ' + where) +
          ' with ' + cfg.followers.length + ' follower' + (cfg.followers.length === 1 ? '' : 's') + '.';
        b.addEventListener('mouseenter', function () { info.textContent = key + ': ' + desc; });
        b.addEventListener('click', function () { BK.Art.sfx('select'); UI().resolve('req', key); });
        grid.appendChild(b);
      });
      body.appendChild(grid);
      body.appendChild(info);
      return UI().req('Choose your Good Fellow', body, [{ label: 'Cancel', value: null }], { cancel: null, width: 600, noFocus: true });
    },

    rollStats: async function (key, i) {
      var lim = BK.Setup.statLimits(key), def = BK.Heroes.byKey(key);
      var roll = function () {
        var o = {};
        ['body', 'str', 'dex', 'wis'].forEach(function (k) {
          o[k] = lim[k].lo + Math.floor(Math.random() * (lim[k].hi - lim[k].lo + 1));
        });
        return o;
      };
      for (;;) {
        var st = roll();
        var body = el('div', 'setup-card');
        var port = el('div', 'port');
        port.style.width = '68px'; port.style.height = '84px'; port.style.padding = '2px';
        port.style.background = '#5A3B22'; port.style.border = '1px solid #fff';
        port.appendChild(BK.Art.portraitCanvas({ key: key, name: key, role: 'hero', look: def.look }, 64, 80));
        body.appendChild(port);
        var right = el('div');
        right.appendChild(el('div', 'hl', 'Player ' + (i + 1) + ': ' + key));
        right.appendChild(el('div', null, '"' + def.nick + '"'));
        var g = el('div', 'statgrid');
        var put = function (k, v) { g.appendChild(el('span', 'k', k)); g.appendChild(el('span', 'v', String(v))); };
        put('Body', st.body); put('Integrity', lim.fixed.int);
        put('Strength', st.str); put('Mercy', lim.fixed.mercy);
        put('Dexterity', st.dex); put('Courage', lim.fixed.courage);
        put('Wisdom', st.wis); put('', '');
        right.appendChild(g);
        right.appendChild(el('div', 'hint', 'Is this OK?'));
        body.appendChild(right);
        var r = await UI().req('Your Good Fellow', body, [
          { label: 'Yes', value: 'yes', primary: true },
          { label: 'Roll again', value: 'again' },
          { label: 'Cancel', value: null }], { cancel: null, enter: 'yes', width: 360 });
        if (r === 'yes') return st;
        if (r == null) return null;
        BK.Art.sfx('coin');
      }
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
