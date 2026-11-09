/* The strategy screen and the `io` the engine talks to: info panel, map, vignette window,
   message window with the command grid, Amiga menu bar and Workbench-style requesters. */
(function (root) {
  'use strict';
  var BK = root.BK = root.BK || {};
  var W = BK.World, A = BK.Actions;

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  var COLNAME = { body: 'Body', str: 'Str', dex: 'Dex', wis: 'Wis', int: 'Int', mercy: 'Mercy', courage: 'Cour',
    men: 'Men', loyalty: 'Loyal', cls: 'Class', pop: 'Pop', loc: 'Where' };
  var SPEED = { click: 0, slow: 4200, normal: 2600, fast: 1300 };

  var UI = BK.UI = {
    s: null, game: null, map: null, focusId: 0, exileFid: null, pending: null,
    settings: { speed: 'normal', music: true },

    init: function () {
      try { Object.assign(UI.settings, JSON.parse(localStorage.getItem('bandit-king-settings') || '{}')); } catch (e) { /* defaults */ }
      UI.fit();
      root.addEventListener('resize', UI.fit);
      UI.map = new BK.MapView($('map'));
      BK.Art.initVignette($('vignette'));
      UI.buildMenubar();
      UI.bindInput();
    },
    saveSettings: function () {
      try { localStorage.setItem('bandit-king-settings', JSON.stringify(UI.settings)); } catch (e) { /* storage blocked */ }
    },
    fit: function () {
      var k = Math.min(root.innerWidth / 640, root.innerHeight / 400);
      if (k >= 2) k = Math.floor(k * 2) / 2;
      $('screen').style.transform = 'scale(' + Math.max(0.4, k) + ')';
    },
    show: function (which) {
      ['game', 'battle', 'title'].forEach(function (id) { $(id).hidden = id !== which; });
      UI.renderMenubar();
    },
    season: function () { return UI.s ? W.season(UI.s) : 'Spring'; },
    playSeason: function (kind) {
      if (!UI.s) return;
      BK.Art.music((kind || 'main') + '-' + W.season(UI.s).toLowerCase());
    },
    // The theme for giving orders: Liangshan Marsh has its own, everywhere else follows the season.
    playMain: function (prefId) {
      if (prefId === BK.MapData.liangshan) BK.Art.music('liangshan');
      else UI.playSeason('main');
    },

    // ---- Menu bar ------------------------------------------------------------------------------
    menuDefs: function () {
      var p = UI.pending, cmdOpen = p && p.kind === 'command';
      var busy = !!(p && p.kind === 'req');
      var inGame = !!UI.s && !$('game').hidden;
      var onTitle = !$('title').hidden;
      var cmds = cmdOpen ? p.cmds : A.CMDS;
      return [
        { name: 'Project', items: [
          { label: 'New game', off: onTitle, act: function () { UI.toTitle(); } },
          { label: 'Save game...', off: !cmdOpen, act: function () { UI.modal(UI.io.saveGame); } },
          { label: 'Load game...', off: busy || onTitle, act: function () { UI.modal(BK.Title.loadMenu); } },
          { label: 'Quit to title', off: !inGame || busy, act: function () { UI.quit(); } }] },
        { name: 'Commands', off: !cmdOpen, items: cmds.map(function (c, i) {
          return { label: c.label, key: String(i + 1), off: !cmdOpen, act: function () { UI.resolve('command', c.id); } };
        }) },
        { name: 'View', off: !cmdOpen, items: ['Home', 'Other', 'Domain', 'Allies', 'Heroes', 'Chronicle'].map(function (v) {
          return { label: v, off: !cmdOpen, act: function () { UI.quickView(v); } };
        }) },
        { name: 'Settings', items: [
          { label: 'Messages: click to continue' + (UI.settings.speed === 'click' ? ' *' : ''), act: function () { UI.setSpeed('click'); } },
          { label: 'Messages: slow' + (UI.settings.speed === 'slow' ? ' *' : ''), act: function () { UI.setSpeed('slow'); } },
          { label: 'Messages: normal' + (UI.settings.speed === 'normal' ? ' *' : ''), act: function () { UI.setSpeed('normal'); } },
          { label: 'Messages: fast' + (UI.settings.speed === 'fast' ? ' *' : ''), act: function () { UI.setSpeed('fast'); } },
          { label: 'Music and sound: ' + (UI.settings.music ? 'on' : 'off'), act: function () { UI.toggleMusic(); } },
          { label: 'Animation: ' + (UI.settings.animation === false ? 'off' : 'on'), act: function () { UI.toggleAnimation(); } },
          { label: 'How to play...', off: busy, act: function () { UI.modal(BK.Title.help); } }] }
      ];
    },
    // Run a dialog from the menu bar without losing the prompt the game is waiting on.
    modal: function (fn) {
      var p = UI.pending, g = UI.game;
      UI.pending = null;
      return Promise.resolve(fn()).then(function (r) {
        if (p && !UI.pending && g && UI.game === g && !g.stopped) {
          UI.pending = p;
          if (p.kind === 'command') UI.showCommandPrompt(p);
          UI.renderMenubar();
        }
        return r;
      });
    },
    buildMenubar: function () {
      document.addEventListener('mousedown', function (e) {
        if (e.button !== 2 && !e.target.closest('#menubar')) UI.closeMenus();
      });
      UI.renderMenubar();
    },
    renderMenubar: function () {
      var bar = $('menubar');
      bar.innerHTML = '';
      UI.menuDefs().forEach(function (m) {
        var t = el('div', 'mtitle' + (m.off ? ' off' : ''), m.name);
        t.setAttribute('role', 'menuitem');
        t.addEventListener('mousedown', function (e) {
          e.preventDefault();
          var open = t.classList.contains('open');
          UI.closeMenus();
          if (!open && !m.off) UI.openMenu(t, m);
        });
        bar.appendChild(t);
      });
      var right = el('div', 'right', UI.status || BK.COMPANY.toUpperCase() + ' · ' + BK.TITLE);
      bar.appendChild(right);
    },
    openMenu: function (t, m) {
      t.classList.add('open');
      var d = el('div', 'mdrop');
      m.items.forEach(function (it) {
        var row = el('div', it.off ? 'off' : '');
        row.textContent = it.label;
        if (it.key) row.appendChild(el('span', 'key', it.key));
        row.addEventListener('mouseup', function (e) {
          e.stopPropagation();
          if (it.off || e.button === 2) return;
          UI.closeMenus();
          BK.Art.sfx('click');
          it.act();
        });
        d.appendChild(row);
      });
      t.appendChild(d);
    },
    closeMenus: function () {
      document.querySelectorAll('#menubar .mtitle').forEach(function (t) {
        t.classList.remove('open');
        var d = t.querySelector('.mdrop');
        if (d) d.remove();
      });
    },
    setStatus: function (text) { UI.status = text; UI.renderMenubar(); },
    setSpeed: function (sp) { UI.settings.speed = sp; UI.saveSettings(); UI.renderMenubar(); },
    toggleMusic: function () {
      UI.settings.music = !UI.settings.music;
      UI.saveSettings();
      if (BK.Music && BK.Music.setEnabled) {
        if (UI.settings.music) BK.Music.init();
        BK.Music.setEnabled(UI.settings.music);
        if (UI.settings.music) UI.playSeason($('battle').hidden ? 'main' : 'war');
      }
      UI.renderMenubar();
    },
    toggleAnimation: function () {
      UI.settings.animation = UI.settings.animation === false;
      UI.saveSettings();
      BK.Art.lastScene = null;
      BK.Art.scene('idle', UI.season());
      UI.renderMenubar();
    },
    quickView: function (v) {
      var p = UI.pending;
      if (!p || p.kind !== 'command') return;
      var fid = UI.exileFid != null ? UI.exileFid : (UI.focusId ? W.pref(UI.s, UI.focusId).owner : null);
      var go = function () {
        if (v === 'Home') return UI.focusId && UI.exileFid == null ? UI.io.view('pref', UI.focusId) : Promise.resolve();
        if (v === 'Other') return UI.io.pickPref('View which prefecture?', UI.s.prefs.map(function (x) { return x.id; }), true)
          .then(function (t) { return t ? UI.io.view('pref', t) : null; });
        if (v === 'Domain') return UI.io.view('domain', fid);
        if (v === 'Allies') return UI.io.view('factions', fid);
        if (v === 'Heroes') return UI.io.view('heroes', fid);
        return UI.io.view('log');
      };
      // Viewing is free: park the command prompt, show the view, then restore the prompt.
      UI.pending = null;
      go().then(function () { UI.pending = p; UI.showCommandPrompt(p); });
    },
    quit: function () {
      UI.modal(function () { return UI.io.confirm('Quit to the title screen? Unsaved progress will be lost.'); }).then(function (yes) {
        if (yes) UI.toTitle();
      });
    },
    toTitle: function () {
      if (UI.game) UI.game.stopped = true;
      UI.cancelPending();
      UI.closeReq();
      BK.Title.show();
    },
    cancelPending: function () {
      var p = UI.pending;
      UI.pending = null;
      if (p && p.resolve) p.resolve(null);
    },

    // ---- Input -------------------------------------------------------------------------------
    bindInput: function () {
      var buf = '', bufTimer = null;
      document.addEventListener('keydown', function (e) {
        var p = UI.pending;
        if (!p) return;
        if (p.kind === 'req') {
          // Y and N answer yes/no requesters, as on the Amiga.
          if ((e.key === 'y' || e.key === 'Y' || e.key === 'n' || e.key === 'N') && p.gads) {
            var want = /y/i.test(e.key) ? 'Yes' : 'No';
            var g = p.gads.filter(function (x) { return x.textContent === want; })[0];
            if (g) { e.preventDefault(); g.click(); return; }
          }
          if (e.key === 'Escape' && p.cancel !== undefined) { e.preventDefault(); UI.resolve('req', p.cancel); }
          else if (e.key === 'Enter' && p.enter !== undefined) { e.preventDefault(); UI.resolve('req', typeof p.enter === 'function' ? p.enter() : p.enter); }
          return;
        }
        if (p.kind === 'wait' && (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape')) { e.preventDefault(); UI.resolve('wait', true); return; }
        if (p.kind === 'pickPref' && e.key === 'Escape') { UI.resolve('pickPref', null); return; }
        if (p.kind === 'command' && /^[0-9]$/.test(e.key)) {
          buf += e.key;
          clearTimeout(bufTimer);
          var fire = function () {
            var n = parseInt(buf, 10);
            buf = '';
            if (n >= 1 && n <= p.cmds.length) UI.resolve('command', p.cmds[n - 1].id);
          };
          if (buf.length >= 2 || parseInt(buf, 10) > Math.floor(p.cmds.length / 10)) fire();
          else bufTimer = setTimeout(fire, 650);
        }
      });
      $('msg').addEventListener('click', function () {
        if (UI.pending && UI.pending.kind === 'wait') UI.resolve('wait', true);
      });
      // Amiga style: hold the right mouse button to show the menus, release over an item to pick it.
      $('screen').addEventListener('contextmenu', function (e) { e.preventDefault(); });
      $('screen').addEventListener('mousedown', function (e) {
        if (e.button !== 2) return;
        e.preventDefault();
        var p = UI.pending;
        if (p && p.kind === 'wait') { UI.resolve('wait', true); return; }
        UI.rmb = true;
        $('menubar').classList.add('rmb');
        var defs = UI.menuDefs(), titles = $('menubar').querySelectorAll('.mtitle');
        var first = 0;
        for (var i = 0; i < defs.length; i++) if (!defs[i].off) { first = i; break; }
        if (p && p.kind === 'command') first = 1;
        UI.closeMenus();
        if (titles[first] && !defs[first].off) UI.openMenu(titles[first], defs[first]);
      });
      document.addEventListener('mouseup', function (e) {
        if (e.button !== 2 || !UI.rmb) return;
        UI.rmb = false;
        $('menubar').classList.remove('rmb');
        var hit = document.elementFromPoint(e.clientX, e.clientY);
        var row = hit && hit.closest && hit.closest('.mdrop div');
        if (row && !row.classList.contains('off')) row.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, button: 0 }));
        else UI.closeMenus();
      });
      $('menubar').addEventListener('mouseover', function (e) {
        if (!UI.rmb) return;
        var t = e.target.closest('.mtitle');
        if (!t || t.classList.contains('open')) return;
        var titles = Array.prototype.slice.call($('menubar').querySelectorAll('.mtitle'));
        var defs = UI.menuDefs(), i = titles.indexOf(t);
        UI.closeMenus();
        if (defs[i] && !defs[i].off) UI.openMenu(t, defs[i]);
      });
      var mapCv = $('map'), tip = $('maptip');
      mapCv.addEventListener('mousemove', function (e) {
        if (!UI.s) return;
        var id = UI.map.hit(e);
        if (id !== UI.map.hover) { UI.map.hover = id; UI.map.draw(UI.s); }
        if (!id) { tip.hidden = true; return; }
        var p = W.pref(UI.s, id);
        tip.textContent = id + ' ' + p.name + ' · ' + (p.owner != null ? W.factionName(UI.s, p.owner) : 'nobody');
        tip.hidden = false;
        var r = mapCv.getBoundingClientRect(), k = r.width / 348;
        var x = (e.clientX - r.left) / k, y = (e.clientY - r.top) / k;
        tip.style.left = Math.min(x + 8, 250) + 'px';
        tip.style.top = Math.max(0, y - 16) + 'px';
      });
      mapCv.addEventListener('mouseleave', function () {
        tip.hidden = true;
        if (UI.map.hover) { UI.map.hover = 0; UI.map.draw(UI.s); }
      });
      mapCv.addEventListener('click', function (e) {
        if (!UI.s) return;
        var id = UI.map.hit(e), p = UI.pending;
        if (!id) return;
        if (p && p.kind === 'pickPref') {
          if (p.ids.indexOf(id) >= 0) { BK.Art.sfx('select'); UI.resolve('pickPref', id); }
          else BK.Art.sfx('error');
        } else if (p && p.kind === 'command') {
          // Peek at any prefecture without spending the turn.
          UI.peek(id);
        }
      });
    },
    resolve: function (kind, value) {
      var p = UI.pending;
      if (!p || p.kind !== kind) return;
      UI.pending = null;
      p.resolve(value);
    },
    await: function (kind, extra) {
      return new Promise(function (resolve) {
        var p = { kind: kind, resolve: resolve };
        if (extra) for (var k in extra) p[k] = extra[k];
        UI.pending = p;
        UI.renderMenubar();
      });
    },
    peek: function (id) {
      UI.renderInfo(id);
      UI.map.focus = id;
      UI.map.draw(UI.s);
      clearTimeout(UI.peekTimer);
      UI.peekTimer = setTimeout(function () {
        if (UI.pending && UI.pending.kind === 'command') { UI.renderInfo(); UI.map.focus = UI.focusId; UI.map.draw(UI.s); }
      }, 3500);
    },

    // ---- Panels ------------------------------------------------------------------------------
    focusOn: function (prefId, exileFid) {
      UI.focusId = prefId || 0;
      UI.exileFid = exileFid != null ? exileFid : null;
      UI.map.focus = UI.focusId;
      UI.renderInfo();
      UI.map.draw(UI.s);
    },
    renderInfo: function (peekId) {
      var s = UI.s, box = $('info');
      if (!s) return;
      box.innerHTML = '';
      var id = peekId || UI.focusId;
      if (!peekId && UI.exileFid != null) return UI.renderExile(box, UI.exileFid);
      if (!id) return;
      var p = W.pref(s, id), f = W.faction(s, p.owner), ruler = p.ruler != null ? W.char(s, p.ruler) : null;
      var head = el('div', 'ihead');
      var port = el('div', 'iport'), cv = el('canvas');
      cv.width = 64; cv.height = 80;
      BK.Art.paint(cv, ruler);
      port.appendChild(cv);
      head.appendChild(port);
      var t = el('div', 'itext');
      var l1 = el('div'); l1.appendChild(el('span', 'pname', p.id + ': ' + p.name));
      if (f) { var sw = el('span', 'flag'); sw.style.background = BK.PAL[f.color]; l1.appendChild(sw); }
      t.appendChild(l1);
      var l2 = el('div', null, BK.MONTHS[s.month - 1] + ' ' + s.year + '  ');
      l2.appendChild(el('span', 'season', W.season(s)));
      t.appendChild(l2);
      t.appendChild(el('div', 'ilabel', 'Ruler'));
      t.appendChild(el('div', null, ruler ? ruler.name : '(none)'));
      t.appendChild(el('div', 'ilabel', 'Owner'));
      t.appendChild(el('div', null, f ? W.factionName(s, f.id) : 'Nobody'));
      head.appendChild(t);
      box.appendChild(head);

      var men = W.menAt(s, id), towns = W.townsAt(s, id).length;
      var rows = [
        ['Gold', p.gold], ['Heroes', W.heroesAt(s, id).length], ['Castles', p.castles],
        ['Food', p.food, p.food < Math.ceil(men / 6) * 3], ['Men', men], ['Support', p.support, p.support < 40],
        ['Metal', p.metal], ['Arms', p.arms], ['Flood', p.flood],
        ['Fur', p.fur], ['Skill', p.skill], ['Land', p.land],
        ['Rate', p.rate], ['People', towns], ['Wealth', p.wealth]
      ];
      var grid = el('div', 'igrid');
      rows.forEach(function (r) {
        var d = el('div');
        d.appendChild(el('span', 'k', r[0]));
        d.appendChild(el('span', 'v' + (r[2] ? ' low' : ''), String(r[1])));
        grid.appendChild(d);
      });
      box.appendChild(grid);
      var tags = [];
      if (p.shipyard) tags.push('Shipyard');
      if (p.smithy) tags.push('Smithy');
      if (p.ships) tags.push('Ships ' + p.ships);
      if (p.beasts) tags.push('Beasts!');
      if (p.snowbound) tags.push('Snowbound');
      if (f && !W.isDirect(s, id) && f.human) tags.push('Orders: ' + p.orders);
      if (id === BK.MapData.liangshan) tags.push('Liangshan');
      if (id === BK.MapData.capital) tags.push('Capital');
      box.appendChild(el('div', 'ifoot', tags.join('  ')));
    },
    renderExile: function (box, fid) {
      var s = UI.s, f = W.faction(s, fid), lead = W.leader(s, fid), here = W.pref(s, f.exileAt);
      var head = el('div', 'ihead');
      var port = el('div', 'iport'), cv = el('canvas');
      cv.width = 64; cv.height = 80;
      BK.Art.paint(cv, lead);
      port.appendChild(cv);
      head.appendChild(port);
      var t = el('div', 'itext');
      t.appendChild(el('div', 'pname', here.id + ': ' + here.name));
      var l2 = el('div', null, BK.MONTHS[s.month - 1] + ' ' + s.year + '  ');
      l2.appendChild(el('span', 'season', W.season(s)));
      t.appendChild(l2);
      t.appendChild(el('div', 'exile-tag', 'In exile'));
      t.appendChild(el('div', null, lead.name));
      t.appendChild(el('div', 'ilabel', 'Hiding in ' + here.name));
      head.appendChild(t);
      box.appendChild(head);
      var band = W.exileBand(s, fid);
      var rows = [['Body', lead.body], ['Bandits', lead.men], ['Popularity', W.popularity(s, fid)],
        ['Band', band.length], ['Men', band.reduce(function (a, c) { return a + c.men; }, 0)], ['Purse', lead.gold]];
      var grid = el('div', 'igrid');
      rows.forEach(function (r) {
        var d = el('div');
        d.appendChild(el('span', 'k', r[0]));
        d.appendChild(el('span', 'v', String(r[1])));
        grid.appendChild(d);
      });
      box.appendChild(grid);
      box.appendChild(el('div', 'ifoot', band.map(function (c) { return c.name; }).join(', ')));
    },
    refresh: function () { UI.renderInfo(); if (UI.s) UI.map.draw(UI.s); },

    // ---- Message window -------------------------------------------------------------------------
    setText: function (text, cls) {
      var m = $('msgtext');
      m.innerHTML = '';
      m.appendChild(el('span', cls || null, text));
    },
    clearPrompt: function () { var p = $('prompt'); p.innerHTML = ''; p.className = ''; },
    wait: function (ms) {
      $('msgtext').appendChild(el('span', 'more', ' ▼'));
      var timer = null;
      var pr = UI.await('wait');
      if (ms > 0) timer = setTimeout(function () { UI.resolve('wait', true); }, ms);
      return pr.then(function () { clearTimeout(timer); });
    },
    speedMs: function (factor) {
      var ms = SPEED[UI.settings.speed];
      return ms ? Math.round(ms * (factor || 1)) : 0;
    },
    showCommandPrompt: function (p) {
      var s = UI.s, prompt = $('prompt');
      UI.setText(p.text);
      prompt.innerHTML = '';
      prompt.className = '';
      p.cmds.forEach(function (c, i) {
        var b = el('button', 'cmd');
        b.appendChild(el('span', 'n', String(i + 1)));
        b.appendChild(document.createTextNode(c.label));
        b.addEventListener('click', function () { BK.Art.sfx('click'); UI.resolve('command', c.id); });
        prompt.appendChild(b);
      });
      UI.renderMenubar();
    },

    // ---- Requesters --------------------------------------------------------------------------
    closeReq: function () { var o = $('overlay'); o.innerHTML = ''; o.hidden = true; },
    // Opens a requester; buttons: [{ label, value, primary, disabled }]. Resolves with a value.
    req: function (title, body, buttons, opts) {
      opts = opts || {};
      var o = $('overlay');
      o.innerHTML = '';
      var r = el('div', 'req');
      r.setAttribute('role', 'dialog');
      if (opts.width) r.style.width = opts.width + 'px';
      r.appendChild(el('div', 'rbar', title || BK.TITLE));
      var b = el('div', 'rbody');
      if (typeof body === 'string') b.textContent = body; else if (body) b.appendChild(body);
      r.appendChild(b);
      var row = el('div', 'rbtns');
      var gads = [];
      (buttons || []).forEach(function (bt) {
        var g = el('button', 'gad' + (bt.primary ? ' primary' : ''), bt.label);
        g.disabled = !!bt.disabled;
        g.addEventListener('click', function () { BK.Art.sfx('click'); UI.resolve('req', typeof bt.value === 'function' ? bt.value() : bt.value); });
        row.appendChild(g);
        gads.push(g);
      });
      if (gads.length) r.appendChild(row);
      o.appendChild(r);
      o.hidden = false;
      var focus = gads.filter(function (g) { return !g.disabled; })[0];
      if (focus && !opts.noFocus) setTimeout(function () { focus.focus(); }, 0);
      var pr = UI.await('req', { cancel: opts.cancel, enter: opts.enter, gads: gads });
      return pr.then(function (v) { UI.closeReq(); return v; });
    },
    portraitBox: function (c) {
      var port = el('div', 'port'), cv = el('canvas');
      cv.width = 64; cv.height = 80;
      BK.Art.paint(cv, c);
      port.appendChild(cv);
      return { box: port, cv: cv };
    },

    heroTable: function (chars, cols, opts, onPick) {
      var s = UI.s;
      var wrap = el('div', 'pick');
      var pb = UI.portraitBox(chars[0]);
      wrap.appendChild(pb.box);
      var tb = el('div', 'tablebox');
      var t = el('table');
      var hr = el('tr');
      hr.appendChild(el('th', null, 'Name'));
      cols.forEach(function (c) { hr.appendChild(el('th', null, COLNAME[c] || c)); });
      t.appendChild(hr);
      chars.forEach(function (c) {
        var tr = el('tr', 'row');
        var nm = c.name + (c.brother ? ' *' : '');
        tr.appendChild(el('td', null, nm));
        cols.forEach(function (k) {
          var v = k === 'pop' ? W.charPopularity(s, c) : (k === 'loc' ? (c.loc ? W.pref(s, c.loc).name : '-') :
            (k === 'loyalty' && W.faction(s, c.faction) && W.faction(s, c.faction).leader === c.id ? '-' : c[k]));
          tr.appendChild(el('td', null, v == null ? '' : String(v)));
        });
        tr.addEventListener('mouseenter', function () { BK.Art.paint(pb.cv, c); });
        if (onPick) tr.addEventListener('click', function () { onPick(c, tr); });
        t.appendChild(tr);
      });
      tb.appendChild(t);
      wrap.appendChild(tb);
      return wrap;
    },

    // ---- The io object the engine awaits --------------------------------------------------------
    io: {
      newMonth: async function (s) {
        UI.s = s;
        UI.setStatus(BK.MONTHS[s.month - 1] + ' ' + s.year + ' A.D. · ' + W.season(s));
        UI.playSeason('main');
        BK.Art.scene('idle', W.season(s));
        if (!UI.focusId) {
          var hp = s.players.filter(function (p) { return p.alive; })[0];
          var first = hp ? W.factionPrefs(s, hp.faction)[0] : null;
          UI.focusOn(first ? first.id : BK.MapData.capital);
        } else UI.refresh();
        UI.clearPrompt();
        UI.setText(BK.MONTHS[s.month - 1] + ' ' + s.year + ' A.D.  ' + W.season(s) + '.');
        await UI.wait(UI.speedMs(0.4) || 600);
      },
      event: async function (ev) {
        if (ev.pref) UI.focusOn(ev.pref);
        if (ev.music) BK.Art.music(ev.music, { loop: false });
        BK.Art.sfx(ev.kind === 'edict' ? 'edict' : 'event');
        await UI.io.say(ev.text, { scene: ev.scene });
        if (ev.music) UI.playSeason('main');
      },
      say: async function (text, opts) {
        opts = opts || {};
        if (opts.scene) BK.Art.scene(opts.scene, UI.season());
        if (opts.music) BK.Art.music(opts.music);
        if (opts.error) BK.Art.sfx('error');
        UI.clearPrompt();
        if (text.split('\n').length > 6 || text.length > 300) {
          await UI.req(opts.title || 'Message', text, [{ label: 'OK', value: true, primary: true }], { cancel: true, enter: true, width: 460 });
          return;
        }
        UI.setText(text, opts.error ? 'err' : null);
        await UI.wait(opts.error ? Math.max(UI.speedMs(), 1800) : UI.speedMs(opts.factor));
      },
      news: async function (text, prefId) {
        if (prefId) { UI.map.draw(UI.s); }
        UI.clearPrompt();
        UI.setText(text);
        await UI.wait(UI.speedMs(0.6) || 1500);
      },
      chieftain: async function (prefId, text, scene) {
        UI.focusOn(prefId);
        if (scene) BK.Art.scene(scene, UI.season());
        UI.clearPrompt();
        UI.setText(text);
        await UI.wait(UI.speedMs(0.5) || 1200);
      },
      confirm: async function (text, opts) {
        opts = opts || {};
        if (opts.scene) BK.Art.scene(opts.scene, UI.season());
        var body = text;
        if (opts.char != null) {
          body = el('div', 'pick');
          body.appendChild(UI.portraitBox(W.char(UI.s, opts.char)).box);
          body.appendChild(el('div', null, text));
        }
        return UI.req('Request', body, [{ label: 'Yes', value: true, primary: true }, { label: 'No', value: false }],
          { cancel: false, enter: true, width: 420 });
      },
      focus: async function (prefId, exileFid) { UI.focusOn(prefId, exileFid); },
      refresh: async function () { UI.refresh(); },

      command: function (prefId, exileFid) {
        var s = UI.s;
        UI.focusOn(prefId, exileFid);
        var exile = exileFid != null;
        var who = exile ? W.leader(s, exileFid) : W.char(s, W.pref(s, prefId).ruler);
        var f = W.faction(s, exile ? exileFid : W.pref(s, prefId).owner);
        var pl = s.players[f.player];
        UI.setStatus((pl ? pl.name + ': ' : '') + W.factionName(s, f.id) + ' · ' + BK.MONTHS[s.month - 1] + ' ' + s.year);
        var p = {
          cmds: exile ? A.EXILE_CMDS : A.CMDS,
          text: (exile ? who.name + ', in exile in ' + W.pref(s, prefId).name + '. Your orders?' :
            who.name + ' of ' + W.pref(s, prefId).name + ', what are your orders?')
        };
        var pr = UI.await('command', p);
        UI.showCommandPrompt(UI.pending);
        UI.playMain(prefId);
        BK.Art.scene('idle', W.season(s));
        return pr.then(function (v) { UI.clearPrompt(); UI.renderMenubar(); return v; });
      },

      menu: function (prompt, items, opts) {
        opts = opts || {};
        var body = el('div');
        if (opts.char != null) {
          body.className = 'pick';
          body.appendChild(UI.portraitBox(W.char(UI.s, opts.char)).box);
        }
        var list = el('div');
        list.appendChild(el('div', 'hint', prompt));
        items.forEach(function (it, i) {
          var b = el('button', 'menuitem', (i + 1) + '. ' + it.label);
          b.disabled = !!it.disabled;
          b.addEventListener('click', function () { BK.Art.sfx('click'); UI.resolve('req', it.value); });
          list.appendChild(b);
        });
        body.appendChild(list);
        var btns = opts.noCancel ? [] : [{ label: 'Cancel', value: null }];
        return UI.req('Choose', body, btns, { cancel: opts.noCancel ? undefined : null, width: opts.char != null ? 460 : 380, noFocus: true });
      },

      number: function (prompt, min, max, def) {
        max = Math.max(min, Math.floor(max));
        def = BK.clamp(def == null ? min : Math.floor(def), min, max);
        var body = el('div');
        body.appendChild(el('div', null, prompt));
        var range = el('input');
        range.type = 'range'; range.min = min; range.max = max; range.value = def;
        var num = el('input');
        num.type = 'number'; num.min = min; num.max = max; num.value = def;
        range.addEventListener('input', function () { num.value = range.value; });
        num.addEventListener('input', function () { range.value = num.value; });
        var row = el('div', 'numrow');
        row.appendChild(num);
        var mk = function (label, v) {
          var g = el('button', 'gad', label);
          g.addEventListener('click', function () { num.value = v; range.value = v; });
          row.appendChild(g);
        };
        mk('Min', min); mk('Half', Math.floor((min + max) / 2)); mk('Max', max);
        body.appendChild(range);
        body.appendChild(row);
        var read = function () { return BK.clamp(Math.floor(+num.value || 0), min, max); };
        setTimeout(function () { num.focus(); num.select(); }, 0);
        return UI.req('Amount', body, [{ label: 'OK', value: read, primary: true }, { label: 'Cancel', value: null }],
          { cancel: null, enter: read, width: 400, noFocus: true });
      },

      pickPref: function (prompt, ids, listOnly) {
        var s = UI.s, prm = $('prompt');
        UI.setText(prompt + '  (click the map)');
        prm.innerHTML = '';
        prm.className = 'cols3';
        UI.map.cands = ids.slice();
        UI.map.blink = true;
        UI.map.draw(s);
        if (ids.length <= 11 && !listOnly) {
          ids.forEach(function (id) {
            var b = el('button', 'cmd', id + ' ' + W.pref(s, id).name);
            b.addEventListener('click', function () { BK.Art.sfx('select'); UI.resolve('pickPref', id); });
            b.addEventListener('mouseenter', function () { UI.renderInfo(id); });
            prm.appendChild(b);
          });
        } else {
          var lb = el('button', 'cmd', 'List...');
          lb.addEventListener('click', function () {
            var p = UI.pending;
            UI.pending = null;
            UI.io.menu(prompt, ids.map(function (id) { return { label: id + ' ' + W.pref(s, id).name, value: id }; }))
              .then(function (v) { UI.pending = p; if (v) UI.resolve('pickPref', v); });
          });
          prm.appendChild(lb);
        }
        var c = el('button', 'cmd cancel', 'Cancel');
        c.addEventListener('click', function () { UI.resolve('pickPref', null); });
        prm.appendChild(c);
        return UI.await('pickPref', { ids: ids }).then(function (v) {
          UI.map.cands = null;
          UI.clearPrompt();
          UI.renderInfo();
          UI.map.draw(s);
          return v;
        });
      },

      pickChar: function (prompt, chars, opts) {
        opts = opts || {};
        if (!chars.length) return Promise.resolve(null);
        var body = el('div');
        body.appendChild(el('div', 'hint', prompt));
        body.appendChild(UI.heroTable(chars, opts.cols || BK.Flows.HERO_COLS, opts, function (c) {
          BK.Art.sfx('select');
          UI.resolve('req', c.id);
        }));
        return UI.req('Choose a hero', body, [{ label: 'Cancel', value: null }], { cancel: null, width: 520, noFocus: true });
      },

      pickChars: function (prompt, chars, opts) {
        opts = opts || {};
        var picked = [], min = opts.min != null ? opts.min : 1, max = opts.max || chars.length;
        var body = el('div');
        var hint = el('div', 'hint');
        var ok;
        var upd = function () {
          hint.textContent = prompt + '   Selected ' + picked.length + ' of ' + max + '.';
          if (ok) ok.disabled = picked.length < min || picked.length > max;
        };
        body.appendChild(hint);
        var tableBox = UI.heroTable(chars, opts.cols || BK.Flows.HERO_COLS, opts, function (c, tr) {
          var i = picked.indexOf(c.id);
          if (i >= 0) { picked.splice(i, 1); tr.classList.remove('sel'); }
          else if (picked.length < max) { picked.push(c.id); tr.classList.add('sel'); }
          else BK.Art.sfx('error');
          upd();
        });
        body.appendChild(tableBox);
        // opts.selected: ids that start out picked.
        if (opts.selected) tableBox.querySelectorAll('tr.row').forEach(function (tr, i) {
          if (opts.selected.indexOf(chars[i].id) >= 0 && picked.length < max) { picked.push(chars[i].id); tr.classList.add('sel'); }
        });
        var all = el('button', 'gad', 'Select the first ' + Math.min(max, chars.length));
        all.style.marginTop = '4px';
        all.addEventListener('click', function () {
          picked = [];
          tableBox.querySelectorAll('tr.row').forEach(function (tr, i) {
            if (i < max) { picked.push(chars[i].id); tr.classList.add('sel'); } else tr.classList.remove('sel');
          });
          upd();
        });
        body.appendChild(all);
        var pr = UI.req('Choose heroes', body, [
          { label: 'OK', value: function () { return picked.slice(); }, primary: true },
          { label: 'Cancel', value: null }], { cancel: null, width: 540, noFocus: true });
        ok = UI.pending.gads[0];
        upd();
        return pr;
      },

      view: function (kind, data) {
        var s = UI.s, body = el('div'), title = 'View', width = 600;
        var table = function (head, rows) {
          var t = el('table');
          var hr = el('tr');
          head.forEach(function (h) { hr.appendChild(el('th', null, h)); });
          t.appendChild(hr);
          rows.forEach(function (r) {
            var tr = el('tr');
            r.forEach(function (v) { tr.appendChild(el('td', null, String(v))); });
            t.appendChild(tr);
          });
          var box = el('div', 'tablebox');
          box.appendChild(t);
          return box;
        };
        if (kind === 'pref') {
          var p = W.pref(s, data), f = W.faction(s, p.owner);
          title = p.id + ': ' + p.name;
          var top = el('div', 'pick');
          top.appendChild(UI.portraitBox(p.ruler != null ? W.char(s, p.ruler) : null).box);
          var lines = 'Owner: ' + (f ? W.factionName(s, f.id) : 'nobody') + '   Ruler: ' + (p.ruler != null ? W.char(s, p.ruler).name : '-') +
            '\nGold ' + p.gold + '  Food ' + p.food + '  Metal ' + p.metal + '  Fur ' + p.fur + '  Rate ' + p.rate +
            '\nArms ' + p.arms + '  Skill ' + p.skill + '  Castles ' + p.castles + '  Ships ' + p.ships +
            '\nSupport ' + p.support + '  Flood ' + p.flood + '  Land ' + p.land + '  Wealth ' + p.wealth +
            '\n' + [p.shipyard ? 'Shipyard' : '', p.smithy ? 'Smithy' : '', p.beasts ? 'Beasts roam' : '', p.snowbound ? 'Snowbound' : ''].filter(Boolean).join(', ') +
            '\nBorders: ' + W.neighbors(p.id).map(function (n) { return n + ' ' + W.pref(s, n).name; }).join(', ');
          top.appendChild(el('div', null, lines));
          body.appendChild(top);
          var hs = W.heroesAt(s, p.id);
          if (hs.length) body.appendChild(table(['Hero', 'Men', 'Body', 'Str', 'Dex', 'Wis', 'Loyal'], hs.map(function (c) {
            return [c.name + (c.brother ? ' *' : ''), c.men, c.body, c.str, c.dex, c.wis, c.loyalty];
          })));
          var tw = W.townsAt(s, p.id).length, pr = W.prisonersAt(s, p.id).length;
          body.appendChild(el('div', 'hint', tw + ' people of note in town.' + (pr ? ' ' + pr + ' prisoners held.' : '')));
        } else if (kind === 'domain') {
          title = 'Domain of ' + W.factionName(s, data);
          var prefs = W.factionPrefs(s, data);
          body.appendChild(table(['Prefecture', 'Ruler', 'Gold', 'Food', 'Men', 'Arms', 'Skill', 'Supp', 'Orders'], prefs.map(function (p) {
            return [p.id + ' ' + p.name, p.ruler != null ? W.char(s, p.ruler).name : '-', p.gold, p.food, W.menAt(s, p.id), p.arms, p.skill, p.support,
              W.isDirect(s, p.id) ? 'yours' : p.orders];
          })));
          if (!prefs.length) body.appendChild(el('div', null, 'You hold no prefectures. You live in exile.'));
        } else if (kind === 'factions') {
          title = 'The rivals';
          var fs = s.factions.filter(function (f) { return f.alive && (f.kind === 'goodfellow' || f.kind === 'imperial' || f.kind === 'boss'); });
          body.appendChild(table(['Leader', 'Kind', 'Prefs', 'Heroes', 'Men', 'Pop', 'Edict', 'Treaty'], fs.map(function (f) {
            var hs = W.factionHeroes(s, f.id);
            var me = W.faction(s, data);
            return [W.leader(s, f.id).name + (f.human ? ' (' + s.players[f.player].name + ')' : ''),
              { goodfellow: 'Good Fellow', imperial: 'Court', boss: 'Rebel', local: 'Squire' }[f.kind],
              W.factionPrefs(s, f.id).length + (W.isExiled(s, f.id) ? ' exile' : ''), hs.length, hs.reduce(function (a, c) { return a + c.men; }, 0),
              f.kind === 'goodfellow' ? W.popularity(s, f.id) : '-', f.edict ? 'yes' : '', me && me.treaties.indexOf(f.id) >= 0 ? 'yes' : ''];
          })));
          body.appendChild(el('div', 'hint', 'Popularity of 250 or more at the January check earns the Imperial Edict.'));
        } else if (kind === 'heroes') {
          title = 'Followers of ' + W.factionName(s, data);
          var hs2 = W.factionHeroes(s, data);
          body.appendChild(table(['Hero', 'Where', 'Men', 'Body', 'Str', 'Dex', 'Wis', 'Int', 'Mercy', 'Cour', 'Loyal'], hs2.map(function (c) {
            return [c.name + (c.brother ? ' *' : ''), c.loc ? W.pref(s, c.loc).name : '-', c.men, c.body, c.str, c.dex, c.wis, c.int, c.mercy, c.courage,
              W.faction(s, data).leader === c.id ? '-' : c.loyalty];
          })));
          body.appendChild(el('div', 'hint', '* sworn brother'));
        } else {
          title = 'Chronicle';
          width = 520;
          body.appendChild(el('div', null, s.log.slice(-40).reverse().join('\n') || 'Nothing has happened yet.'));
        }
        return UI.req(title, body, [{ label: 'OK', value: true, primary: true }], { cancel: true, enter: true, width: width });
      },

      saveGame: async function () {
        var s = UI.s;
        var items = BK.Save.SLOTS.filter(function (k) { return k !== 'auto'; }).map(function (slot) {
          var m = BK.Save.meta(slot);
          return { label: 'Slot ' + slot + ':  ' + (m ? m.date + ' · ' + m.players : '(empty)'), value: slot };
        });
        items.push({ label: 'To a file   (download a copy to keep or move)', value: 'file' });
        var slot = await UI.io.menu('Save the game in which slot?', items);
        if (!slot) return;
        if (slot === 'file') {
          // A backup outside the browser: the whole game as a JSON file.
          var a = document.createElement('a');
          a.href = URL.createObjectURL(new Blob([BK.Save.serialize(s)], { type: 'application/json' }));
          a.download = 'bandit-king-' + s.year + '-' + ('0' + s.month).slice(-2) + '.json';
          document.body.appendChild(a);
          a.click();
          setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
          await UI.io.say('The chronicle is copied to ' + a.download + '. Load it again with Load game → From a file.');
          return;
        }
        var ok = BK.Save.write(slot, s);
        await UI.io.say(ok ? 'The chronicle is written to slot ' + slot + '.' : 'The game could not be saved. Browser storage may be blocked.', { error: !ok });
      },
      autosave: function (s) { BK.Save.write('auto', s); },

      // Interrupt → Sound / Animation / Messages.
      setting: async function (kind) {
        if (kind === 'sound') {
          UI.toggleMusic();
          await UI.io.say('Music and sound are now ' + (UI.settings.music ? 'on' : 'off') + '.');
        } else if (kind === 'animation') {
          UI.toggleAnimation();
          await UI.io.say('Animation is now ' + (UI.settings.animation === false ? 'off' : 'on') + '.');
        } else if (kind === 'messages') {
          var v = await UI.io.menu('How should messages advance?', [
            { label: 'Wait for a click', value: 'click' }, { label: 'Slow', value: 'slow' },
            { label: 'Normal', value: 'normal' }, { label: 'Fast', value: 'fast' }]);
          if (v) UI.setSpeed(v);
        }
      },

      battle: async function (b, sides) {
        UI.show('battle');
        UI.playSeason('war');
        await BK.BattleView.run(b, sides);
        UI.show('game');
        // The reckoning after a battle has its own music until the next orders are given.
        BK.Art.music('aftermath');
        UI.refresh();
      },

      gameOver: async function (s, outcome) {
        var text, track;
        if (outcome.kind === 'win') {
          var name = W.factionName(s, outcome.winner);
          text = 'Gao Qiu kneels before ' + name + '. The corrupt minister answers at last for the ruin of so many honest men.\n\n' +
            'Emperor Huizong summons the heroes of the marsh to court and names ' + name + ' Protector of the Realm. ' +
            'For a while, at least, the people of the Song live in peace.\n\nCongratulations. You have won.';
          track = 'ending';
          BK.Art.scene('victory', W.season(s));
        } else if (outcome.kind === 'invasion') {
          text = 'January ' + s.year + '. The Jurchen cavalry crosses the frozen rivers and falls on Kaifeng. ' +
            'Gao Qiu still rules a dying court, and the outlaws of the marsh are scattered.\n\nTime has run out. The game is over.';
          track = 'gameover';
          BK.Art.scene('defeat', 'Winter');
        } else {
          var w = s.winner != null ? W.factionName(s, s.winner) : null;
          text = w ? w + ' has destroyed Gao Qiu and claimed the Emperor\'s favour. Your own quest ends in another man\'s shadow.\n\nThe game is over.'
            : 'Your Good Fellow has fallen, and with ' + 'them the hope of your band.\n\nThe game is over.';
          track = 'gameover';
          BK.Art.scene('defeat', W.season(s));
        }
        BK.Art.music(track, { loop: track === 'ending' });
        await UI.req(outcome.kind === 'win' ? 'Victory' : 'The end', text, [{ label: 'Return to title', value: true, primary: true }], { cancel: true, enter: true, width: 460 });
        UI.toTitle();
      }
    },

    start: function (s) {
      if (BK.Title.unbind) BK.Title.unbind();
      if (BK.Title.art && BK.Title.art.stop) BK.Title.art.stop();
      if (UI.game) UI.game.stopped = true;
      UI.s = s;
      UI.focusId = 0;
      UI.exileFid = null;
      UI.show('game');
      UI.clearPrompt();
      UI.setText('');
      UI.game = new BK.Game(s, UI.io);
      UI.game.run().catch(function (e) {
        if (root.console) console.error(e);
        UI.req('Guru Meditation', 'Software failure. ' + (e && e.message ? e.message : e) + '\n\nPlease save and report this.',
          [{ label: 'Continue', value: true }], { cancel: true });
      });
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
