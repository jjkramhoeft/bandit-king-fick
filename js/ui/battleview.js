/* The tactical battle screen: a pixel-art hex field, the force panel, unit orders and the log.
   Human sides choose commands by clicking; other sides (or delegated ones) are run by the AI. */
(function (root) {
  'use strict';
  var BK = root.BK = root.BK || {};
  var W = BK.World;
  var B = BK.Battle;

  var S = 19, HH = Math.sqrt(3) * S, X0 = 9, Y0 = 1;
  var FW = 456, FH = 380;
  var DIGITS = ['111101101101111', '010110010010111', '111001111100111', '111001111001111', '101101111001001',
    '111100111001111', '111100111101111', '111001010010010', '111101111101111', '111101111001111'];
  var GROUND = { Spring: ['#7FBF5A', '#6AA84A'], Summer: ['#5DAA45', '#4C9638'], Autumn: ['#B5B45A', '#9C9A48'], Winter: ['#E8F2F8', '#A9C2D4'] };
  var CMDS = [
    ['move', 'Move'], ['charge', 'Charge'], ['melee', 'Melee'], ['archery', 'Archery'],
    ['magic', 'Magic'], ['duel', 'Duel'], ['fireball', 'Fireball'], ['putout', 'Extinguish'],
    ['reinforce', 'Reinforce'], ['rest', 'Rest'], ['flee', 'Flee'], ['view', 'View'], ['delegate', 'Delegate']
  ];

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function center(q, r) { return { x: X0 + S + q * 1.5 * S, y: Y0 + HH / 2 + r * HH + (q & 1 ? HH / 2 : 0) }; }
  function hexPath(g, q, r, inset) {
    var c = center(q, r), k = S - (inset || 0);
    g.beginPath();
    for (var i = 0; i < 6; i++) {
      var a = Math.PI / 3 * i;
      var x = c.x + k * Math.cos(a), y = c.y + k * Math.sin(a);
      if (i) g.lineTo(x, y); else g.moveTo(x, y);
    }
    g.closePath();
  }
  function digits(g, txt, x, y, color) {
    g.fillStyle = color;
    for (var k = 0; k < txt.length; k++) {
      var bits = DIGITS[+txt[k]];
      for (var b = 0; b < 15; b++) if (bits[b] === '1') g.fillRect(x + k * 4 + (b % 3), y + Math.floor(b / 3), 1, 1);
    }
  }

  var V = BK.BattleView = {
    run: function (b, sides) {
      return new Promise(function (resolve) {
        V.b = b;
        V.sides = sides;
        V.delegate = { atk: !sides.atk, def: !sides.def };
        V.cur = null;
        V.mode = 'idle';
        V.marks = null;
        V.hover = null;
        V.frame = 0;
        V.done = resolve;
        V.build();
        V.loop();
      });
    },

    build: function () {
      var b = V.b, s = b.s, host = document.getElementById('battle');
      host.innerHTML = '';
      var side = el('div', 'bside');
      V.head = el('div', 'bbox head');
      V.vs = el('div', 'bbox bvs');
      V.unitBox = el('div', 'bbox bunit');
      V.cmdBox = el('div', 'bcmds');
      V.logBox = el('div', 'bbox blog');
      side.appendChild(V.head);
      side.appendChild(V.vs);
      side.appendChild(V.unitBox);
      side.appendChild(V.cmdBox);
      side.appendChild(V.logBox);
      host.appendChild(side);
      var field = el('div');
      field.id = 'field';
      V.cv = el('canvas');
      V.cv.width = FW; V.cv.height = FH;
      V.cv.style.width = FW + 'px'; V.cv.style.height = FH + 'px';
      field.appendChild(V.cv);
      host.appendChild(field);
      V.g = V.cv.getContext('2d');
      V.unitCv = el('canvas');
      V.unitCv.width = 32; V.unitCv.height = 40;

      CMDS.forEach(function (c) {
        var bt = el('button', 'cmd', c[1]);
        bt.dataset.cmd = c[0];
        bt.addEventListener('click', function () { V.command(c[0]); });
        V.cmdBox.appendChild(bt);
      });
      V.cv.addEventListener('mousemove', function (e) { V.hover = V.hexAt(e); V.draw(); });
      V.cv.addEventListener('mouseleave', function () { V.hover = null; V.draw(); });
      V.cv.addEventListener('click', function (e) { V.click(V.hexAt(e)); });
      V.cv.addEventListener('contextmenu', function (e) { e.preventDefault(); V.back(); });
      V.keyHandler = function (e) { if (e.key === 'Escape') V.back(); };
      document.addEventListener('keydown', V.keyHandler);
      clearInterval(V.anim);
      V.anim = setInterval(function () { V.frame++; V.draw(); }, 220);
      V.draw();
      V.panel();
    },

    hexAt: function (e) {
      var r = V.cv.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width * FW, y = (e.clientY - r.top) / r.height * FH;
      var best = null, bd = 1e9;
      for (var q = 0; q < B.COLS; q++) for (var rr = 0; rr < B.ROWS; rr++) {
        var c = center(q, rr), d = (c.x - x) * (c.x - x) + (c.y - y) * (c.y - y);
        if (d < bd) { bd = d; best = { q: q, r: rr }; }
      }
      return bd < S * S ? best : null;
    },

    // ---- Drawing -----------------------------------------------------------------------------
    draw: function () {
      var b = V.b, g = V.g;
      if (!b) return;
      g.imageSmoothingEnabled = false;
      g.fillStyle = '#05070a';
      g.fillRect(0, 0, FW, FH);
      for (var q = 0; q < B.COLS; q++) for (var r = 0; r < B.ROWS; r++) V.drawHex(q, r);
      if (V.marks) V.marks.forEach(function (m) {
        hexPath(g, m.q, m.r, 2);
        g.strokeStyle = m.unit ? '#FF3020' : '#F08A24';
        g.lineWidth = 2;
        g.stroke();
        if (!m.unit) { g.fillStyle = 'rgba(240,138,36,0.28)'; g.fill(); }
      });
      if (V.hover) { hexPath(g, V.hover.q, V.hover.r, 1); g.strokeStyle = '#F6D63E'; g.lineWidth = 1; g.stroke(); }
      b.units.forEach(function (u) { if (!u.gone) V.drawUnit(u); });
      V.drawWeather();
    },
    drawHex: function (q, r) {
      var b = V.b, g = V.g, cell = b.cell(q, r), c = center(q, r);
      var season = b.season, t = cell.t, frozen = cell.frozen;
      var gr = GROUND[season];
      hexPath(g, q, r, 0);
      var base = gr[0];
      if (t === 'river' || t === 'lake') base = frozen ? '#A6E3EE' : (t === 'lake' ? '#1F3C8C' : '#3A78D8');
      else if (t === 'marsh') base = frozen ? '#BFE8F0' : '#6F8A4A';
      else if (t === 'mount') base = '#7A6A5A';
      else if (t === 'hill') base = season === 'Winter' ? '#BCCBD6' : '#A88A58';
      else if (t === 'forest' && season === 'Winter') base = '#C9D9E3';
      else if (t === 'castle') base = season === 'Winter' ? '#DCE6EC' : gr[0];
      if (cell.burnt && !cell.fire) base = '#3B3530';
      g.fillStyle = base;
      g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.35)';
      g.lineWidth = 1;
      g.stroke();
      var x = Math.round(c.x), y = Math.round(c.y), i, k;
      var seed = (q * 31 + r * 17) % 7;
      if ((t === 'plain' || t === 'castle') && !cell.burnt) {
        g.fillStyle = gr[1];
        for (i = 0; i < 6; i++) g.fillRect(x - 10 + ((i * 7 + seed * 3) % 20), y - 8 + ((i * 11 + seed) % 16), 1, 1);
      }
      if (t === 'forest' && !cell.burnt) {
        var trees = [[-7, 2], [1, -5], [6, 4], [-2, 6]];
        trees.forEach(function (tr) {
          var tx = x + tr[0], ty = y + tr[1];
          g.fillStyle = '#4A3018'; g.fillRect(tx, ty + 1, 1, 3);
          g.fillStyle = season === 'Autumn' ? '#B05A28' : '#2E6B3A';
          for (k = 0; k < 5; k++) g.fillRect(tx - Math.floor(k / 2), ty - 4 + k, Math.floor(k / 2) * 2 + 1, 1);
          if (season === 'Winter') { g.fillStyle = '#FFFFFF'; g.fillRect(tx, ty - 4, 1, 1); g.fillRect(tx - 1, ty - 2, 3, 1); }
        });
      }
      if (t === 'hill') {
        g.fillStyle = season === 'Winter' ? '#7F94A6' : '#7C6238';
        g.fillRect(x - 9, y + 2, 7, 2); g.fillRect(x - 7, y, 3, 2);
        g.fillRect(x + 1, y - 3, 8, 2); g.fillRect(x + 3, y - 5, 4, 2);
      }
      if (t === 'mount') {
        for (k = 0; k < 11; k++) {
          g.fillStyle = k < 3 ? '#F4F7FA' : '#5A4A3A';
          g.fillRect(x - Math.floor(k * 0.9), y - 8 + k, 1 + Math.floor(k * 0.9) * 2, 1);
        }
        g.fillStyle = '#9A8A78';
        for (k = 3; k < 11; k++) g.fillRect(x - Math.floor(k * 0.9), y - 8 + k, Math.max(1, Math.floor(k * 0.45)), 1);
      }
      if (t === 'river' && !frozen) {
        g.fillStyle = '#9FC8DE';
        g.fillRect(x - 7 + (V.frame % 3), y - 3, 4, 1); g.fillRect(x + 1 - (V.frame % 3), y + 3, 5, 1);
      }
      if (t === 'lake' && !frozen) {
        g.fillStyle = '#3A78D8';
        g.fillRect(x - 6 + (V.frame % 2), y, 5, 1); g.fillRect(x + 2, y - 5, 4, 1);
      }
      if (frozen) {
        g.fillStyle = '#FFFFFF';
        g.fillRect(x - 6, y - 2, 6, 1); g.fillRect(x, y - 1, 1, 4); g.fillRect(x + 1, y + 3, 5, 1);
      }
      if (t === 'marsh' && !frozen) {
        g.fillStyle = '#3A78D8';
        g.fillRect(x - 6, y + 2, 4, 1); g.fillRect(x + 3, y - 3, 4, 1);
        g.fillStyle = '#C9B78A';
        for (k = 0; k < 4; k++) g.fillRect(x - 4 + k * 3, y - 6 + (k % 2) * 3, 1, 4);
      }
      if (t === 'castle') {
        g.fillStyle = '#5A5048'; g.fillRect(x - 9, y - 4, 18, 11);
        g.fillStyle = '#9A9088'; g.fillRect(x - 8, y - 3, 16, 9);
        g.fillStyle = '#5A5048';
        for (k = 0; k < 5; k++) g.fillRect(x - 9 + k * 4, y - 6, 2, 2);
        g.fillStyle = '#A0201C'; g.fillRect(x - 3, y - 9, 6, 3);
        g.fillStyle = '#23262E'; g.fillRect(x - 2, y + 2, 4, 5);
      }
      if (cell.burnt && !cell.fire) {
        g.fillStyle = (V.frame + q) % 3 ? '#5A2010' : '#E08030';
        g.fillRect(x - 3, y + 1, 1, 1); g.fillRect(x + 4, y - 2, 1, 1);
      }
      if (cell.fire) {
        var f = V.frame + q + r;
        for (k = 0; k < 4; k++) {
          var fx = x - 9 + k * 5, h = 6 + ((f + k) % 3) * 2;
          g.fillStyle = '#E03C2C'; g.fillRect(fx, y + 6 - h, 4, h);
          g.fillStyle = '#F08A24'; g.fillRect(fx + 1, y + 7 - h, 2, h - 2);
          g.fillStyle = '#F6D63E'; g.fillRect(fx + 1, y + 4, 2, 2);
        }
      }
    },
    drawUnit: function (u) {
      var b = V.b, g = V.g, c = center(u.q, u.r);
      var f = b.s.factions[u.side === 'atk' ? b.atkFid : b.defFid];
      var x = Math.round(c.x) - 10, y = Math.round(c.y) - 9;
      var color = f ? BK.PAL[f.color] : '#C9B78A';
      var rim = u.side === 'atk' ? '#F08AE0' : '#64D4F0';
      g.fillStyle = '#23262E'; g.fillRect(x, y - 3, 1, 15);
      g.fillStyle = '#000'; g.fillRect(x + 1, y - 3, 19, 10);
      g.fillStyle = rim; g.fillRect(x + 2, y - 2, 17, 8);
      g.fillStyle = color; g.fillRect(x + 3, y - 1, 15, 6);
      var men = String(Math.max(0, Math.round(u.men)));
      g.fillStyle = '#000'; g.fillRect(x + 1, y + 8, men.length * 4 + 3, 7);
      digits(g, men, x + 3, y + 9, '#FFFFFF');
      if (u.confused) { g.fillStyle = '#C8A0FF'; g.fillRect(x + 15, y + 9, 3, 3); }
      if (u.acted) { g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(x + 2, y - 2, 17, 8); }
      if (V.cur === u) {
        hexPath(g, u.q, u.r, 1);
        g.strokeStyle = V.frame % 2 ? '#F6D63E' : '#FFFFFF';
        g.lineWidth = 2;
        g.stroke();
      }
    },
    drawWeather: function () {
      var w = V.b.weather, g = V.g, i;
      if (w === 'Rain') {
        g.fillStyle = 'rgba(159,200,222,0.6)';
        for (i = 0; i < 60; i++) {
          var x = (i * 53 + V.frame * 7) % FW, y = (i * 97 + V.frame * 23) % FH;
          g.fillRect(x, y, 1, 4);
        }
      } else if (w === 'Snow') {
        g.fillStyle = 'rgba(255,255,255,0.85)';
        for (i = 0; i < 50; i++) g.fillRect((i * 71 + V.frame * 3) % FW, (i * 43 + V.frame * 9) % FH, 2, 2);
      } else if (w === 'Clouds') {
        g.fillStyle = 'rgba(40,44,60,0.12)';
        g.fillRect(0, 0, FW, FH);
      }
    },

    // ---- Panel ---------------------------------------------------------------------------------
    panel: function () {
      var b = V.b, s = b.s;
      var tp = W.pref(s, b.target);
      V.head.innerHTML = '';
      V.head.appendChild(el('div', null, BK.MONTHS[s.month - 1].slice(0, 3) + ' ' + s.year + ' · ' + tp.id + ' ' + tp.name));
      V.head.appendChild(el('div', 'day', '- Day ' + b.day + ' of 30 -'));
      var arrows = ['↘', '↗', '↑', '↖', '↙', '↓'];
      var sum = function (side) { return b.live(side).reduce(function (a, u) { return a + u.men; }, 0); };
      V.vs.innerHTML = '';
      var add = function (a, m, d) {
        V.vs.appendChild(el('div', 'a', a));
        V.vs.appendChild(el('div', 'mid', m));
        V.vs.appendChild(el('div', 'd', d));
      };
      add('Attacker', '', 'Defender');
      add(s.chars[b.atkLeader] ? s.chars[b.atkLeader].name : W.factionName(s, b.atkFid), '',
        b.defLeader != null && s.chars[b.defLeader] ? s.chars[b.defLeader].name : '-');
      add(String(sum('atk')), 'men', String(sum('def')));
      add(String(b.live('atk').length), 'units', String(b.live('def').length) + (b.callable().length ? '+' + b.callable().length : ''));
      add(String(Math.max(0, b.food.atk)), 'food', String(Math.max(0, b.food.def)));
      add(b.weather, arrows[b.wind], 'wind');

      V.unitBox.innerHTML = '';
      var u = V.cur;
      if (u) {
        var h = b.hero(u);
        BK.Art.paint(V.unitCv, h);
        V.unitBox.appendChild(V.unitCv);
        var t = el('div');
        t.appendChild(el('div', null, h.name + (u.cid === b.atkLeader || u.cid === b.defLeader ? ' ★' : '')));
        t.appendChild(el('div', null, 'Men ' + u.men + '/' + W.menCap(h) + '  Body ' + h.body));
        t.appendChild(el('div', null, 'Str ' + h.str + ' Dex ' + h.dex + ' Wis ' + h.wis + (h.ship ? '  Ship' : '')));
        V.unitBox.appendChild(t);
      } else V.unitBox.appendChild(el('div', null, V.waitingText || ''));

      var human = u && V.isHuman(u.side) && V.mode !== 'busy';
      // A hero at 10 Body or less can only rest.
      var spent = u && b.hero(u).body <= 10;
      V.cmdBox.querySelectorAll('button').forEach(function (bt) {
        var c = bt.dataset.cmd, ok = human;
        if (ok && spent) ok = c === 'rest' || c === 'delegate' || c === 'view';
        else if (ok && c === 'magic') ok = b.canMagic(u) && b.targets(u, 'magic').length > 0;
        else if (ok && c === 'fireball') ok = b.canFireball(u);
        else if (ok && c === 'archery') ok = b.targets(u, 'archery').length > 0;
        else if (ok && (c === 'melee' || c === 'duel' || c === 'putout' || c === 'reinforce' || c === 'charge')) ok = b.targets(u, c).length > 0;
        else if (ok && c === 'move') ok = b.reachable(u).length > 0;
        bt.disabled = !ok;
        bt.style.borderColor = V.mode === c ? '#F6D63E' : '';
      });

      V.logBox.innerHTML = '';
      b.log.slice(-11).forEach(function (l) { V.logBox.appendChild(el('div', l.kind, l.text)); });
    },
    isHuman: function (side) { return !!V.sides[side] && !V.delegate[side]; },

    // ---- Turn loop ---------------------------------------------------------------------------
    delay: function () {
      var sp = BK.UI && BK.UI.settings.speed;
      return { fast: 90, normal: 260, slow: 480, click: 260 }[sp] || 260;
    },
    sleep: function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); },
    loop: async function () {
      var b = V.b, logged = b.log.length;
      while (!b.over) {
        var u = V.cur && !V.cur.gone && !V.cur.acted && V.cur.side === b.side ? V.cur : b.nextUnit();
        if (!u) {
          V.cur = null;
          var r = b.endSide();
          if (r === 'day' || r === 'side') { V.panel(); V.draw(); await V.sleep(V.delay()); }
          continue;
        }
        V.cur = u;
        if (V.isHuman(u.side)) {
          V.mode = 'cmd';
          V.marks = null;
          V.panel(); V.draw();
          await new Promise(function (res) { V.acted = res; });
        } else {
          V.mode = 'busy';
          V.panel(); V.draw();
          await V.sleep(V.delay());
          b.aiAct(u);
        }
        V.sound(b.log.slice(logged));
        logged = b.log.length;
        V.panel(); V.draw();
      }
      V.cur = null;
      V.mode = 'busy';
      V.marks = null;
      V.panel(); V.draw();
      V.finish();
    },
    sound: function (lines) {
      var kinds = lines.map(function (l) { return l.kind; });
      var pick = ['duel', 'magic', 'fire', 'arrow', 'hit', 'capture', 'move'].filter(function (k) { return kinds.indexOf(k) >= 0; })[0];
      if (pick) BK.Art.sfx({ capture: 'event', move: 'march' }[pick] || pick);
    },

    command: function (c) {
      var b = V.b, u = V.cur;
      if (!u || !V.isHuman(u.side) || V.mode === 'busy') return;
      BK.Art.sfx('click');
      if (c === 'rest') return V.doAct('rest');
      if (c === 'view') return V.view(u);
      if (c === 'flee') {
        if (V.mode === 'flee') return V.doAct('flee');
        V.mode = 'flee';
        b.say('Click Flee again to retreat ' + b.hero(u).name + ' from the battle.', 'info');
        V.panel();
        return;
      }
      if (c === 'delegate') {
        V.delegate[u.side] = true;
        b.say('You hand command to your officers.', 'info');
        V.mode = 'busy';
        var go = V.acted;
        V.acted = null;
        if (go) go();
        return;
      }
      V.mode = c;
      V.marks = c === 'move' ? b.reachable(u) : b.targets(u, c);
      V.panel(); V.draw();
    },
    // View, as in the manual: list either side's heroes. Scouting the enemy uses this unit's turn.
    view: async function (u) {
      var b = V.b, h = b.hero(u), them = b.other(u.side);
      V.mode = 'view';
      var side = await BK.UI.req('View', 'Whose heroes will you look over?', [
        { label: 'Our heroes', value: u.side, primary: true },
        { label: 'The enemy (uses ' + h.name + '\'s turn)', value: them },
        { label: 'Cancel', value: null }], { cancel: true });
      if (side) await BK.UI.req('View: ' + (side === 'atk' ? 'the attackers' : 'the defenders'), V.roster(side),
        [{ label: 'OK', value: true, primary: true }], { cancel: true, enter: true, width: 560 });
      V.mode = 'cmd';
      if (side && side !== u.side && !u.acted && !b.over) return V.doAct('view');
      V.panel(); V.draw();
    },
    roster: function (side) {
      var b = V.b, s = b.s;
      var pad = function (t, n) { t = String(t); return t.length >= n ? t.slice(0, n) : t + new Array(n - t.length + 1).join(' '); };
      var line = function (c, men, where) {
        return pad(c.name, 18) + pad(men, 5) + pad(c.body, 5) + pad(c.str, 5) + pad(c.dex, 5) + pad(c.wis, 5) +
          pad((c.ship ? 'ship ' : '') + (c.steersman ? 'steer' : ''), 11) + where;
      };
      var out = [pad('Hero', 18) + pad('Men', 5) + pad('Body', 5) + pad('Str', 5) + pad('Dex', 5) + pad('Wis', 5) + pad('Water', 11) + 'Where'];
      b.units.filter(function (u) { return u.side === side; }).forEach(function (u) {
        var where = u.gone ? { captured: 'captured', fled: 'fled', swept: 'swept away', killed: 'fallen' }[u.gone] || u.gone : 'on the field';
        if (!u.gone && b.hero(u).body <= 0) where = 'exhausted';
        out.push(line(b.hero(u), u.men, where));
      });
      if (side === 'def') (b.reserve || []).forEach(function (cid) { out.push(line(s.chars[cid], s.chars[cid].men, 'in the prefecture')); });
      return out.join('\n');
    },
    back: function () {
      if (V.mode === 'busy' || !V.cur) return;
      V.mode = 'cmd';
      V.marks = null;
      V.panel(); V.draw();
    },
    click: function (hex) {
      var b = V.b;
      if (!hex) return;
      if (b.over && V.resultShown) return;
      var u = V.cur;
      if (!u || !V.isHuman(u.side) || V.mode === 'busy') return;
      var other = b.unitAt(hex.q, hex.r);
      if (V.mode === 'cmd' || V.mode === 'flee') {
        if (other && other.side === u.side && !other.acted && other !== u) {
          V.cur = other; V.mode = 'cmd'; V.panel(); V.draw();
        }
        return;
      }
      var m = (V.marks || []).filter(function (x) { return x.q === hex.q && x.r === hex.r; })[0];
      if (!m) {
        if (other && other.side === u.side && !other.acted) { V.cur = other; V.mode = 'cmd'; V.marks = null; V.panel(); V.draw(); }
        return;
      }
      V.doAct(V.mode, hex.q, hex.r);
    },
    doAct: function (cmd, q, r) {
      var b = V.b, u = V.cur;
      var ok = b.act(u, cmd, q, r);
      if (!ok) { BK.Art.sfx('error'); return; }
      V.marks = null;
      V.mode = 'busy';
      var go = V.acted;
      V.acted = null;
      if (go) go();
    },

    finish: function () {
      var b = V.b, s = b.s;
      var host = document.getElementById('battle');
      var humanAtk = V.sides.atk, humanDef = V.sides.def;
      var won = (b.result.winner === 'atk' && humanAtk) || (b.result.winner === 'def' && humanDef);
      var lost = (b.result.winner === 'atk' && humanDef) || (b.result.winner === 'def' && humanAtk);
      var box = el('div', 'bresult');
      box.appendChild(el('div', null, won ? 'VICTORY' : (lost ? 'DEFEAT' : 'THE BATTLE IS OVER')));
      box.appendChild(el('div', null, b.result.reason));
      box.appendChild(el('div', null, 'Click to continue.'));
      host.appendChild(box);
      BK.Art.music(won ? 'victory' : 'defeat', { loop: false });
      V.resultShown = true;
      var close = function () {
        host.removeEventListener('click', close);
        document.removeEventListener('keydown', key);
        document.removeEventListener('keydown', V.keyHandler);
        clearInterval(V.anim);
        V.resultShown = false;
        V.b = null;
        V.done();
      };
      var key = function (e) { if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') close(); };
      setTimeout(function () {
        host.addEventListener('click', close);
        document.addEventListener('keydown', key);
      }, 300);
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
