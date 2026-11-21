/* ============================================================
   点点星球 · 扩展系统  (systems.js)
   股市 / 舰队 / 小游戏 / 挂机
   依赖 game.js 暴露的 window.DD 接口，所有进度都存在同一份存档里
   ============================================================ */
(function (global) {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var D = function () { return window.DD; };
  var S = function () { return window.DD ? window.DD.state : null; };

  var ENERGY_MAX = 8;
  var ENERGY_MS = 8 * 60 * 1000;
  var IDLE_CAP_H = 12;

  /* ===================== 股市 ===================== */

  var TICKERS = [
    { id: 'sdm',  sym: 'SDM',  name: '星尘矿业',   base: 120,   vol: 0.045, drift: 0.0004 },
    { id: 'qrs',  sym: 'QRS',  name: '曲率航运',   base: 460,   vol: 0.060, drift: 0.0002 },
    { id: 'amd',  sym: 'AMD',  name: '反物质动力', base: 1500,  vol: 0.080, drift: 0.0006 },
    { id: 'holo', sym: 'HOLO', name: '全息娱乐',   base: 5200,  vol: 0.100, drift: 0.0003 },
    { id: 'dsi',  sym: 'DSI',  name: '深空保险',   base: 18000, vol: 0.030, drift: 0.0001 },
    { id: 'qag',  sym: 'QAG',  name: '量子农业',   base: 60000, vol: 0.070, drift: 0.0002 }
  ];

  var NEWS = [
    ['星尘矿业在近地小行星带发现富矿脉', 1, 0.06],
    ['曲率航运的跃迁航线被税局抽查', 1, -0.07],
    ['反物质动力发布新一代约束环', 1, 0.09],
    ['全息娱乐的虚拟偶像演唱会售票破纪录', 1, 0.08],
    ['深空保险因陨石潮赔付，利润承压', 1, -0.05],
    ['量子农业的基因稻在零重力下丰收', 2, 0.07],
    ['星际交易所临时调整保证金比例', 0, -0.04],
    ['有匿名巨鲸在收盘前扫货', 0, 0.05],
    ['太阳风干扰了深空通讯，交易延迟', 0, -0.03]
  ];

  function gain() { return D().worlds[S().world].gain; }

  // 局部重绘（股市 / 宠物 / 小游戏）
  function render() {
    renderStocks();
    renderFleet();
    renderMini();
  }

  function factorOf(t) {
    var p = S().stocks.prices[t.id];
    return typeof p === 'number' && p > 0 ? p : 1;
  }

  function priceOf(t) {
    return Math.max(1, Math.round(t.base * gain() * factorOf(t)));
  }

  function capital() {
    var st = S();
    if (!st) return 0;
    var sum = 0;
    for (var i = 0; i < TICKERS.length; i++) {
      var t = TICKERS[i];
      sum += (st.stocks.hold[t.id] || 0) * priceOf(t);
    }
    return sum;
  }

  function stockMult() {
    return 1 + Math.log10(1 + capital() / 1000) * 0.28;
  }

  function stockTick(dtMs) {
    var st = S().stocks;
    st.pxAt = (st.pxAt || 0) + dtMs;
    if (st.pxAt >= 5000) {
      st.pxAt = 0;
      for (var i = 0; i < TICKERS.length; i++) {
        var t = TICKERS[i];
        var f = factorOf(t);
        var shock = (Math.random() * 2 - 1) * t.vol * 0.5;
        var meanRev = (1 - f) * 0.02;
        f = f * (1 + shock + t.drift * 0.5) + meanRev;
        S().stocks.prices[t.id] = Math.max(0.35, Math.min(3.2, f));
      }
    }

    st.newsAt = (st.newsAt || 0) + dtMs;
    if (st.newsAt >= 75000) {
      st.newsAt = 0;
      var item = NEWS[Math.floor(Math.random() * NEWS.length)];
      var target = item[1] >= 2 ? TICKERS[Math.floor(Math.random() * TICKERS.length)] : null;
      var shockPct = item[2];
      if (target) {
        S().stocks.prices[target.id] = Math.max(0.35, Math.min(3.2, factorOf(target) * (1 + shockPct)));
      } else {
        for (var k = 0; k < TICKERS.length; k++) {
          var tk = TICKERS[k];
          S().stocks.prices[tk.id] = Math.max(0.35, Math.min(3.2, factorOf(tk) * (1 + shockPct + (Math.random() - 0.5) * 0.02)));
        }
      }
      st.news.unshift({ text: item[0], pct: shockPct, at: Date.now() });
      if (st.news.length > 8) st.news.length = 8;
    }

    st.divAt = (st.divAt || 0) + dtMs;
    if (st.divAt >= 120000) {
      st.divAt = 0;
      var cap = capital();
      if (cap > 0) {
        var pay = cap * 0.008;
        S().dust += pay;
        S().total += pay;
        S().stats.stockProfit += pay;
        D().toast('💰 股息到账 +' + D().fmt(pay), 1800);
      }
    }
  }

  function trade(t, dir, ratio) {
    var st = S();
    var p = priceOf(t);
    var hold = st.stocks.hold[t.id] || 0;
    if (dir === 'buy') {
      var budget = st.dust * ratio;
      var shares = Math.floor(budget / (p * 1.005));
      if (shares <= 0) { D().toast('星尘不够买一股', 1500); return; }
      st.dust -= shares * p * 1.005;
      st.stocks.hold[t.id] = hold + shares;
    } else {
      var sell = ratio >= 1 ? hold : Math.floor(hold * ratio);
      if (sell <= 0) return;
      st.dust += sell * p * 0.995;
      st.total += sell * p * 0.995;
      st.stocks.hold[t.id] = hold - sell;
    }
    st.stats.trades += 1;
    D().checkAchs();
    D().checkRanks();
    render();
    D().save();
  }

  function renderStocks() {
    var st = S().stocks;
    $('stkCapital').textContent = D().fmt(capital());
    $('stkMult').textContent = '×' + stockMult().toFixed(2);
    $('stkCash').textContent = D().fmt(S().stats.stockProfit);

    var list = $('stkList');
    if (!list) return;
    list.innerHTML = '';
    TICKERS.forEach(function (t) {
      var p = priceOf(t);
      var change = (factorOf(t) - 1) * 100;
      var hold = st.hold[t.id] || 0;
      var li = document.createElement('li');
      li.className = 'stock-item';
      li.innerHTML =
        '<div class="stock-top">' +
          '<span class="stock-name">' + t.name + '<em>' + t.sym + '</em></span>' +
          '<span class="stock-price">' + D().fmt(p) + '<em class="' + (change >= 0 ? 'up' : 'down') + '">' +
            (change >= 0 ? '+' : '') + change.toFixed(1) + '%</em></span>' +
        '</div>' +
        '<div class="stock-sub">持有 ' + D().fmt(hold) + ' 股 · 市值 ' + D().fmt(hold * p) + '</div>' +
        '<div class="stock-ops">' +
          '<button type="button" data-op="b10">买10%</button>' +
          '<button type="button" data-op="b50">买50%</button>' +
          '<button type="button" data-op="ball">全买</button>' +
          '<button type="button" data-op="s50">卖一半</button>' +
          '<button type="button" data-op="sall">全卖</button>' +
        '</div>';
      li.querySelectorAll('button').forEach(function (b) {
        b.addEventListener('click', function () {
          var op = b.dataset.op;
          if (op === 'b10') trade(t, 'buy', 0.1);
          else if (op === 'b50') trade(t, 'buy', 0.5);
          else if (op === 'ball') trade(t, 'buy', 1);
          else if (op === 's50') trade(t, 'sell', 0.5);
          else trade(t, 'sell', 1);
        });
      });
      list.appendChild(li);
    });

    var news = $('stkNews');
    if (news) {
      news.innerHTML = st.news.length
        ? st.news.map(function (n) {
            return '<li class="news-item"><i class="' + (n.pct >= 0 ? 'up' : 'down') + '">' +
              (n.pct >= 0 ? '↑' : '↓') + '</i><span>' + n.text + '</span></li>';
          }).join('')
        : '<li class="news-item dim">市场风平浪静，等你入场。</li>';
    }
  }

  /* ===================== 探索 / 宠物 ===================== */
  // 舰队已经换成宠物：探索、战力、加成都在 pets.js 里，
  // 这里只保留给主循环和身份判定用的转发。

  function petPower() { return window.DDPets ? DDPets.petPower() : 0; }
  function petMult() { return window.DDPets ? DDPets.petMult() : 1; }

  function renderFleet() {
    var st = S();
    if (!st || !st.pets) return;
    $('petPower').textContent = D().fmt(petPower());
    $('petMult').textContent = '×' + petMult().toFixed(2);
    $('petDone').textContent = D().fmt(st.pets.done || 0);
  }

  function fmtLeft(ms) {
    var s = Math.max(0, Math.ceil(ms / 1000));
    var m = Math.floor(s / 60);
    var ss = s % 60;
    return m + ':' + (ss < 10 ? '0' : '') + ss;
  }

  /* ===================== 小游戏 ===================== */

  var GAMES = [
    { id: 'ore', name: '星矿淘金', icon: '⛏️', desc: '九宫格里埋着三块星矿，翻三格，挖到越多奖励越高。' },
    { id: 'meteor', name: '流星截击', icon: '☄️', desc: '光标来回滑动，在正中间按下，误差越小倍率越高。三轮取平均。' },
    { id: 'memory', name: '星图记忆', icon: '🧠', desc: '记住亮起的星位顺序，依次点亮。序列越长，奖励越高。' },
    { id: 'hack', name: '序列破解', icon: '🔢', desc: '按 1 到 N 的顺序点亮，越快倍率越高。' },
    { id: 'hunt', name: '微观猎手', icon: '🔍', desc: '九宫格里藏着几颗星核，点错一次就结束。' },
    { id: 'pulse', name: '节律脉冲', icon: '💓', desc: '让光点停在亮区，星球越靠后越快越窄。' }
  ];

  function energyNow() {
    var m = S().mini;
    var n = Date.now();
    if (!m.energyAt) m.energyAt = n;
    var gained = Math.floor((n - m.energyAt) / ENERGY_MS);
    if (gained > 0) {
      m.energy = Math.min(ENERGY_MAX, m.energy + gained);
      m.energyAt += gained * ENERGY_MS;
    }
    return m.energy;
  }

  function badgeCount() { return Math.min(25, Math.floor(S().mini.wins / 2)); }

  function miniBase() {
    return D().cps * 150 + D().clickPower * 30 + 50 * gain();
  }

  function miniMult() { return 1 + badgeCount() * 0.02; }

  function award(mult, label) {
    var rew = Math.round(miniBase() * mult * miniMult());
    S().mini.wins += 1;
    S().mini.badges = badgeCount();
    S().stats.miniDust += rew;
    D().addDust(rew);
    D().toast('🎮 ' + label + ' +' + D().fmt(rew) + ' 星尘', 2400);
    D().checkRanks();
    D().checkAchs();
    D().save();
    render();
  }

  var miniCleanup = null;

  function openGame(g) {
    if (energyNow() <= 0) { D().toast('游玩次数用完了，等它慢慢回', 2000); return; }
    S().mini.energy -= 1;
    var body = $('miniBody');
    body.innerHTML = '';
    $('miniTitle').textContent = g.icon + ' ' + g.name;
    $('miniDesc').textContent = g.desc;
    $('miniModal').classList.remove('hidden');
    if (miniCleanup) { miniCleanup(); miniCleanup = null; }

    if (g.id === 'ore') startOre(body);
    else if (g.id === 'meteor') startMeteor(body);
    else if (g.id === 'hack') startHack(body);
    else if (g.id === 'hunt') startHunt(body);
    else if (g.id === 'pulse') startPulse(body);
    else startMemory(body);
    render();
  }

  function closeGame() {
    $('miniModal').classList.add('hidden');
    if (miniCleanup) { miniCleanup(); miniCleanup = null; }
  }

  function startOre(body) {
    var values = [3, 2, 1, 0, 0, 0, 0, 0, 0];
    for (var i = values.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = values[i]; values[i] = values[j]; values[j] = t;
    }
    var picks = 0, sum = 0;
    var grid = document.createElement('div');
    grid.className = 'ore-grid';
    var cells = [];
    for (var k = 0; k < 9; k++) {
      (function (idx) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'ore-cell';
        b.textContent = '·';
        b.addEventListener('click', function () {
          if (picks >= 3 || b.disabled) return;
          b.disabled = true;
          picks += 1;
          sum += values[idx];
          b.classList.add(values[idx] > 0 ? 'hit' : 'miss');
          b.textContent = values[idx] > 0 ? '💎' : '·';
          if (picks === 3) {
            cells.forEach(function (c, ci) { if (values[ci] > 0) c.classList.add('show'); });
            var mult = 0.5 + sum;
            var tip = document.createElement('p');
            tip.className = 'mini-result';
            tip.textContent = '挖到 ' + sum + ' 块星矿 · 结算';
            body.appendChild(tip);
            setTimeout(function () { award(mult, '星矿'); closeGame(); }, 700);
          }
        });
        cells.push(b);
        grid.appendChild(b);
      })(k);
    }
    body.appendChild(grid);
  }

  function startMeteor(body) {
    var track = document.createElement('div');
    track.className = 'meteor-track';
    var zone = document.createElement('div');
    zone.className = 'meteor-zone';
    var marker = document.createElement('i');
    marker.className = 'meteor-marker';
    track.appendChild(zone);
    track.appendChild(marker);
    var round = document.createElement('p');
    round.className = 'mini-result';
    round.textContent = '第 1 / 3 轮';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'primary mini-btn';
    btn.textContent = '截击';
    body.appendChild(track);
    body.appendChild(round);
    body.appendChild(btn);

    var p = 0, dir = 1, roundNo = 0, total = 0, raf = 0, lock = false;
    function loop() {
      p += dir * 0.016;
      if (p > 1) { p = 1; dir = -1; }
      if (p < 0) { p = 0; dir = 1; }
      marker.style.left = (p * 100) + '%';
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);
    miniCleanup = function () { cancelAnimationFrame(raf); };

    btn.addEventListener('click', function () {
      if (lock) return;
      lock = true;
      var err = Math.abs(p - 0.5);
      var mult = err < 0.04 ? 3 : err < 0.09 ? 2.2 : err < 0.16 ? 1.4 : err < 0.28 ? 0.8 : 0.4;
      total += mult;
      roundNo += 1;
      round.textContent = roundNo < 3 ? '第 ' + (roundNo + 1) + ' / 3 轮 · 本次 ×' + mult : '三轮结束';
      if (roundNo >= 3) {
        cancelAnimationFrame(raf);
        btn.disabled = true;
        setTimeout(function () { award(total / 3, '流星截击'); closeGame(); }, 600);
      } else {
        setTimeout(function () { lock = false; }, 250);
      }
    });
  }

  function startMemory(body) {
    var len = Math.min(6, 3 + Math.floor(badgeCount() / 3));
    var seq = [];
    for (var i = 0; i < len; i++) seq.push(Math.floor(Math.random() * 9));
    var grid = document.createElement('div');
    grid.className = 'ore-grid';
    var cells = [];
    for (var k = 0; k < 9; k++) {
      (function (idx) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'ore-cell mem';
        b.textContent = '✦';
        b.disabled = true;
        b.addEventListener('click', function () {
          if (step >= seq.length) return;
          if (seq[step] === idx) {
            b.classList.add('hit');
            step += 1;
            setTimeout(function () { b.classList.remove('hit'); }, 180);
            if (step >= seq.length) {
              var mult = 1 + len * 0.28;
              var tip = document.createElement('p');
              tip.className = 'mini-result';
              tip.textContent = '序列全对 · 结算 ×' + mult.toFixed(1);
              body.appendChild(tip);
              setTimeout(function () { award(mult, '星图记忆'); closeGame(); }, 700);
            }
          } else {
            var tip2 = document.createElement('p');
            tip2.className = 'mini-result';
            tip2.textContent = '点错了 · 保底结算';
            body.appendChild(tip2);
            setTimeout(function () { award(0.35, '星图记忆'); closeGame(); }, 700);
          }
        });
        cells.push(b);
        grid.appendChild(b);
      })(k);
    }
    var step = 0;
    var tipEl = document.createElement('p');
    tipEl.className = 'mini-result';
    tipEl.textContent = '记住这 ' + len + ' 个星位…';
    body.appendChild(tipEl);
    body.appendChild(grid);

    var i2 = 0;
    var timer = setInterval(function () {
      if (i2 < seq.length) {
        var c = cells[seq[i2]];
        c.classList.add('lit');
        setTimeout(function () { c.classList.remove('lit'); }, 380);
        i2 += 1;
      } else {
        clearInterval(timer);
        cells.forEach(function (c) { c.disabled = false; });
        tipEl.textContent = '轮到你了，按顺序点亮';
      }
    }, 620);
    miniCleanup = function () { clearInterval(timer); };
  }

  /* --- 序列破解 --- */
  function startHack(body) {
    var n = Math.min(6, 3 + Math.floor(badgeCount() / 4));
    var pos = [], i;
    for (i = 1; i <= n; i++) pos.push(i);
    for (i = pos.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = pos[i]; pos[i] = pos[j]; pos[j] = t;
    }
    var step = 0, start = Date.now(), done = false;
    var grid = document.createElement('div');
    grid.className = 'ore-grid';
    var tip = document.createElement('p');
    tip.className = 'mini-result';
    tip.textContent = '按 1 → ' + n + ' 的顺序点亮，越快倍率越高';
    body.appendChild(tip);
    body.appendChild(grid);
    pos.forEach(function (num) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'ore-cell';
      b.textContent = num;
      b.addEventListener('click', function () {
        if (done || b.disabled) return;
        if (num !== step + 1) {
          done = true;
          b.classList.add('hit');
          tip.textContent = '顺序错了 · 保底结算';
          setTimeout(function () { award(0.4, '序列破解'); closeGame(); }, 500);
          return;
        }
        step += 1;
        b.disabled = true;
        b.classList.add('lit');
        if (step >= n) {
          done = true;
          var sec = (Date.now() - start) / 1000;
          var mult = Math.max(1.2, 4.5 - sec * 0.35);
          tip.textContent = sec.toFixed(1) + ' 秒完成 · 结算 ×' + mult.toFixed(1);
          setTimeout(function () { award(mult, '序列破解'); closeGame(); }, 500);
        }
      });
      grid.appendChild(b);
    });
    var tm = setInterval(function () {
      if (done) { clearInterval(tm); return; }
      if ((Date.now() - start) / 1000 > 10) {
        done = true;
        clearInterval(tm);
        award(0.3, '序列破解');
        closeGame();
      }
    }, 400);
    miniCleanup = function () { clearInterval(tm); };
  }

  /* --- 微观猎手 --- */
  function startHunt(body) {
    var cells = 9;
    var targets = Math.min(5, 2 + Math.floor(badgeCount() / 5));
    var grid = document.createElement('div');
    grid.className = 'ore-grid';
    var tip = document.createElement('p');
    tip.className = 'mini-result';
    tip.textContent = '找出 ' + targets + ' 颗隐藏星核，点错一次就结束';
    body.appendChild(tip);
    body.appendChild(grid);
    var mine = {}, left = targets, over = false, start = Date.now(), k = 0;
    while (left > 0) {
      var idx = Math.floor(Math.random() * cells);
      if (!mine[idx]) { mine[idx] = 1; left -= 1; }
    }
    var found = 0;
    for (k = 0; k < cells; k++) (function (at) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'ore-cell';
      b.textContent = '·';
      b.addEventListener('click', function () {
        if (over || b.disabled) return;
        b.disabled = true;
        if (mine[at]) {
          found += 1;
          b.textContent = '✦';
          b.classList.add('lit');
          if (found >= targets) {
            over = true;
            var sec = (Date.now() - start) / 1000;
            var mult = Math.max(1, 3.6 - sec * 0.2) + targets * 0.3;
            tip.textContent = '全找到了 · 结算 ×' + mult.toFixed(1);
            setTimeout(function () { award(mult, '微观猎手'); closeGame(); }, 500);
          }
        } else {
          over = true;
          b.textContent = '✕';
          b.classList.add('hit');
          tip.textContent = '踩空了 · 保底结算';
          setTimeout(function () { award(0.3, '微观猎手'); closeGame(); }, 500);
        }
      });
      grid.appendChild(b);
    })(k);
    miniCleanup = function () {};
  }

  /* --- 节律脉冲 --- */
  function startPulse(body) {
    var wi = S().world;
    var speed = 0.00055 + wi * 0.00012;
    var zoneW = Math.max(6, 20 - wi * 2.4);
    var track = document.createElement('div');
    track.style.cssText = 'position:relative;height:44px;border-radius:22px;margin:6px 0 12px;' +
      'background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.14);overflow:hidden';
    var zone = document.createElement('div');
    zone.style.cssText = 'position:absolute;top:0;bottom:0;background:rgba(120,240,190,.28);' +
      'border-left:1px solid rgba(120,240,190,.6);border-right:1px solid rgba(120,240,190,.6)';
    zone.style.left = (50 - zoneW / 2) + '%';
    zone.style.width = zoneW + '%';
    var dot = document.createElement('div');
    dot.style.cssText = 'position:absolute;top:4px;bottom:4px;width:8px;border-radius:4px;' +
      'background:#ffe07a;box-shadow:0 0 10px #ffe07a';
    track.appendChild(zone);
    track.appendChild(dot);
    var tip = document.createElement('p');
    tip.className = 'mini-result';
    tip.textContent = '让光点停在亮区，三轮取平均';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'primary mini-btn';
    btn.textContent = '定 位';
    body.appendChild(tip);
    body.appendChild(track);
    body.appendChild(btn);

    var p = 0, dir = 1, raf = 0, last = 0, roundNo = 0, total = 0, lock = false;
    function loop(now) {
      if (!last) last = now;
      var dt = Math.min(40, now - last);
      last = now;
      p += dir * speed * dt;
      if (p > 1) { p = 1; dir = -1; }
      if (p < 0) { p = 0; dir = 1; }
      dot.style.left = 'calc(' + (p * 100) + '% - 4px)';
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);
    miniCleanup = function () { cancelAnimationFrame(raf); };

    btn.addEventListener('click', function () {
      if (lock) return;
      lock = true;
      var err = Math.abs(p - 0.5) * 100;
      var half = zoneW / 2;
      var mult = err < half * 0.3 ? 3 : err < half * 0.65 ? 2.2 : err < half ? 1.5 : err < half * 1.8 ? 0.9 : 0.4;
      total += mult;
      roundNo += 1;
      tip.textContent = roundNo < 3 ? '第 ' + (roundNo + 1) + ' / 3 轮 · 本次 ×' + mult : '三轮结束';
      if (roundNo >= 3) {
        cancelAnimationFrame(raf);
        btn.disabled = true;
        setTimeout(function () { award(total / 3, '节律脉冲'); closeGame(); }, 600);
      } else {
        setTimeout(function () { lock = false; }, 250);
      }
    });
  }

  function renderMini() {
    var m = S().mini;
    var e = energyNow();
    m.badges = badgeCount();
    $('miniEnergy').textContent = e + '/' + ENERGY_MAX;
    $('miniBadge').textContent = m.badges;
    $('miniWins').textContent = m.wins;

    var list = $('miniList');
    if (list) {
      list.innerHTML = '';
      GAMES.forEach(function (g) {
        var li = document.createElement('li');
        li.className = 'mini-card';
        li.innerHTML =
          '<span class="mini-ico">' + g.icon + '</span>' +
          '<div class="item-main"><div class="item-name">' + g.name + '</div>' +
          '<div class="item-desc">' + g.desc + '</div></div>' +
          '<button type="button" class="mini-go"' + (e <= 0 ? ' disabled' : '') + '>开始</button>';
        li.querySelector('button').addEventListener('click', function () { openGame(g); });
        list.appendChild(li);
      });
    }

    var card = $('idleCard');
    if (card) {
      var core = S().idle.core;
      var rate = Math.min(1, 0.55 + core * 0.025);
      var auto = S().idle.auto;
      var cost = Math.round(20000 * gain() * Math.pow(1.7, core));
      var acost = Math.round(5000 * gain() * Math.pow(1.6, auto));
      card.innerHTML =
        '<div class="idle-row"><span>离线收益效率</span><b>' + Math.round(rate * 100) + '%</b></div>' +
        '<div class="idle-row"><span>离线累计上限</span><b>' + IDLE_CAP_H + ' 小时</b></div>' +
        '<div class="idle-row"><span>自动点击无人机</span><b>' + auto + ' 架 · ' + (auto * 0.4).toFixed(1) + ' 次/秒</b></div>' +
        '<div class="idle-ops">' +
          '<button type="button" id="idleCore"' + (core >= 20 || S().dust < cost ? ' disabled' : '') + '>采集核心 ' + D().fmt(cost) + '</button>' +
          '<button type="button" id="idleAuto"' + (auto >= 20 || S().dust < acost ? ' disabled' : '') + '>自动无人机 ' + D().fmt(acost) + '</button>' +
        '</div>';
      var cb = $('idleCore');
      if (cb) cb.addEventListener('click', function () {
        if (S().idle.core >= 20 || S().dust < cost) return;
        S().dust -= cost; S().idle.core += 1;
        D().checkAchs(); render(); D().save();
      });
      var ab = $('idleAuto');
      if (ab) ab.addEventListener('click', function () {
        if (S().idle.auto >= 20 || S().dust < acost) return;
        S().dust -= acost; S().idle.auto += 1;
        render(); D().save();
      });
    }

    var claimBox = $('idleClaim');
    if (claimBox) {
      var rep = S().idle.report;
      claimBox.innerHTML = rep
        ? '<p class="panel-tip">上次离线 ' + fmtLeft(rep.away * 1000) + '，按 ' +
          Math.round(rep.rate * 100) + '% 效率收入 <b>' + D().fmt(rep.gain) + '</b> 星尘。</p>'
        : '<p class="panel-tip dim">关掉页面也会继续生产，回来记得看看这里。</p>';
    }
  }

  /* ===================== 总倍率 & 主循环 ===================== */

  function mult() {
    return stockMult() * petMult() * (1 + badgeCount() * 0.03) * (1 + S().idle.core * 0.02);
  }

  var autoAcc = 0;

  function tick(dtMs) {
    var st = S();
    if (!st) return;
    var dt = dtMs || 100;

    stockTick(dt);
    energyNow();

    var auto = st.idle.auto;
    if (auto > 0) {
      autoAcc += dt * auto * 0.4;
      while (autoAcc >= 1000) {
        autoAcc -= 1000;
        var g = D().clickPower * 0.35;
        st.dust += g;
        st.total += g;
      }
    }
  }

  var renderAcc = 0;
  function slowRender(dt) {
    renderAcc += dt;
    if (renderAcc < 500) return;
    renderAcc = 0;
    renderStocks();
    renderFleet();
    renderMini();
  }

  var attached = false;

  function attach() {
    if (!window.DD || attached) return;
    attached = true;
    var st = S();
    TICKERS.forEach(function (t) {
      if (!st.stocks.prices[t.id]) st.stocks.prices[t.id] = 1;
    });
    if (!st.stocks.newsAt) st.stocks.newsAt = 0;
    if (!st.stocks.divAt) st.stocks.divAt = 0;

    $('miniClose').addEventListener('click', closeGame);
    $('miniModal').addEventListener('click', function (e) {
      if (e.target === $('miniModal')) closeGame();
    });

    // 切标签立刻刷新，别让玩家看到旧的禁用按钮
    document.querySelectorAll('.tab').forEach(function (t) {
      t.addEventListener('click', function () { setTimeout(render, 0); });
    });

    // 离线收益在 game.js 里只按基础产出算过一次；这里补上股市/宠物/星章的加成
    var r = st.idle.report;
    if (r && r.away > 0) {
      var extra = D().cps * Math.min(r.away, IDLE_CAP_H * 3600 * 1000) / 1000 * r.rate * (mult() - 1);
      if (extra > 1) {
        st.dust += extra;
        st.total += extra;
        st.stats.idleDust += extra;
        r.gain += extra;
      }
    }

    renderStocks(); renderFleet(); renderMini();
    setInterval(function () { slowRender(500); }, 500);
    energyNow();
    D().checkRanks();
    D().render();
  }

  global.DDSystems = {
    attach: attach,
    tick: function (dt) { tick(dt); slowRender(dt); },
    mult: mult,
    capital: capital,
    petPower: petPower,
    stockMult: stockMult,
    petMult: petMult,
    badges: badgeCount
  };
})(window);

// game.js 先执行，等它暴露好 DD 再挂载
if (window.DD) window.DDSystems.attach();
