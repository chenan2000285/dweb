// 点点星球 · 音效与特效引擎 fx.js
// 纯 WebAudio 合成，不加载任何音频文件；每个星球一套音色 + 一套粒子
(function () {
  'use strict';
  var DD = window.DD;
  if (!DD) return;
  var S = function () { return DD.state; };
  var reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  /* ===================== 1. 声音 ===================== */
  var AC = null, master = null, muted = false, vol = 0.45;
  try { muted = localStorage.getItem('aiweb.sfx.mute') === '1'; } catch (e) {}

  function ac() {
    if (!AC) {
      var C = window.AudioContext || window.webkitAudioContext;
      if (!C) return null;
      AC = new C();
      master = AC.createGain();
      master.gain.value = vol;
      master.connect(AC.destination);
    }
    if (AC.state === 'suspended') AC.resume();
    return AC;
  }

  // 每颗星球的音色：type 波形 / base 基频 / bright 泛音倍数 / decay 余韵
  var TONE = [
    { type: 'sine', base: 430, bright: 1.5, decay: 0.30, cut: 5200 }, // 0 暮紫 · 钟
    { type: 'sawtooth', base: 165, bright: 1.5, decay: 0.20, cut: 2600 }, // 1 烈焰 · 粗糙
    { type: 'triangle', base: 640, bright: 2.5, decay: 0.34, cut: 7000 }, // 2 霜蓝 · 玻璃
    { type: 'triangle', base: 300, bright: 2.0, decay: 0.38, cut: 4200 }, // 3 翡翠 · 木琴
    { type: 'square', base: 760, bright: 2.2, decay: 0.16, cut: 8000 }, // 4 量子 · 电流
    { type: 'sine', base: 110, bright: 1.2, decay: 0.60, cut: 1800 } // 5 虚空 · 深空
  ];
  function toneOf(w) { return TONE[w] || TONE[0]; }

  function blip(o) {
    if (muted) return;
    var c = ac(); if (!c) return;
    var t = c.currentTime;
    var osc = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f, t);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(Math.max(40, o.f2), t + o.dur);
    f.type = 'lowpass'; f.frequency.setValueAtTime(o.cut || 6000, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.001, o.gain || 0.18), t + (o.atk || 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    osc.connect(f); f.connect(g); g.connect(master);
    osc.start(t); osc.stop(t + o.dur + 0.05);
  }

  function noise(o) {
    if (muted) return;
    var c = ac(); if (!c) return;
    var dur = o.dur || 0.2, sr = c.sampleRate;
    var buf = c.createBuffer(1, Math.floor(sr * dur), sr);
    var d = buf.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    var src = c.createBufferSource(); src.buffer = buf;
    var f = c.createBiquadFilter(); f.type = o.type || 'bandpass';
    f.frequency.setValueAtTime(o.f || 2200, c.currentTime);
    if (o.f2) f.frequency.exponentialRampToValueAtTime(Math.max(80, o.f2), c.currentTime + dur);
    f.Q.value = o.q || 1.2;
    var g = c.createGain(); g.gain.value = o.gain || 0.16;
    src.connect(f); f.connect(g); g.connect(master);
    src.start();
  }

  var SFX = {
    click: function (combo, crit) {
      var w = S().world, t = toneOf(w);
      var pitch = Math.pow(2, Math.min(combo, 40) / 22);
      blip({ type: t.type, f: t.base * pitch * (0.94 + Math.random() * 0.12), f2: t.base * pitch * t.bright,
        dur: t.decay * 0.8, gain: crit ? 0.3 : 0.16, cut: t.cut });
      if (crit) {
        blip({ type: 'sine', f: t.base * 4, f2: t.base * 8, dur: 0.22, gain: 0.12 });
        noise({ dur: 0.16, f: 3200, f2: 900, gain: 0.1 });
      }
    },
    rank: function () {
      var t = toneOf(S().world);
      [0, 4, 7, 12].forEach(function (n, i) {
        setTimeout(function () {
          blip({ type: t.type, f: t.base * Math.pow(2, n / 12), dur: 0.5, gain: 0.13, cut: t.cut });
        }, i * 95);
      });
    },
    world: function () {
      noise({ dur: 0.55, f: 400, f2: 4000, gain: 0.12, type: 'lowpass' });
      blip({ type: 'sine', f: 90, f2: 640, dur: 0.7, gain: 0.2 });
    },
    orb: function () {
      blip({ type: 'sine', f: 900, f2: 1800, dur: 0.28, gain: 0.16 });
      blip({ type: 'triangle', f: 1350, f2: 2700, dur: 0.34, gain: 0.1 });
    },
    mini: function (win) {
      if (win) { [0, 5, 9, 12].forEach(function (n, i) { setTimeout(function () { blip({ type: 'triangle', f: 440 * Math.pow(2, n / 12), dur: 0.32, gain: 0.14 }); }, i * 80); }); }
      else blip({ type: 'sawtooth', f: 300, f2: 110, dur: 0.42, gain: 0.13 });
    },
    buy: function () { blip({ type: 'triangle', f: 520, f2: 780, dur: 0.14, gain: 0.12 }); },
    tide: function () { noise({ dur: 0.9, f: 200, f2: 1200, gain: 0.1, type: 'lowpass' }); }
  };

  /* ===================== 2. 特效层 ===================== */
  var layer = document.createElement('canvas');
  layer.id = 'fxLayer';
  layer.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9000';
  document.body.appendChild(layer);
  var ctx = layer.getContext('2d');
  var W = 0, H = 0, DPR = 1;
  function resize() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = layer.width = Math.floor(innerWidth * DPR);
    H = layer.height = Math.floor(innerHeight * DPR);
  }
  resize();
  addEventListener('resize', resize);

  var parts = [], rings = [], raf = 0;

  function rnd(a, b) { return a + Math.random() * (b - a); }

  // 每颗星球的粒子外观
  var THEME = [
    { color: '#b9cbd6', shape: 'dot', size: [1.5, 3.5], spd: [1, 3], grav: 0.02, life: 900 }, // 星尘
    { color: '#ff8a3d', shape: 'ember', size: [2, 5], spd: [1.5, 4], grav: -0.05, life: 1100 }, // 火星上升
    { color: '#9fe8ff', shape: 'shard', size: [2.5, 6], spd: [1.2, 3.4], grav: 0.06, life: 1000 }, // 冰晶
    { color: '#7fe0a0', shape: 'leaf', size: [2.5, 5.5], spd: [0.8, 2.6], grav: 0.03, life: 1200 }, // 叶片
    { color: '#8ff0ff', shape: 'arc', size: [2, 4], spd: [2, 5.5], grav: 0, life: 620 }, // 电弧
    { color: '#c6a8ff', shape: 'void', size: [2, 5], spd: [0.6, 2.2], grav: -0.01, life: 1400 } // 虚空
  ];
  function theme() { return THEME[S().world] || THEME[0]; }

  function burst(x, y, n, power) {
    if (reduced) return;
    var th = theme();
    power = power || 1;
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2;
      var v = rnd(th.spd[0], th.spd[1]) * power;
      parts.push({
        x: x * DPR, y: y * DPR,
        vx: Math.cos(a) * v * DPR, vy: Math.sin(a) * v * DPR,
        life: th.life * rnd(0.7, 1.2), age: 0,
        size: rnd(th.size[0], th.size[1]) * DPR,
        shape: th.shape, color: th.color,
        rot: Math.random() * 6.28, spin: rnd(-0.2, 0.2)
      });
    }
    if (parts.length > 700) parts.splice(0, parts.length - 700);
    start();
  }

  function ring(x, y, color) {
    if (reduced) return;
    rings.push({ x: x * DPR, y: y * DPR, r: 6 * DPR, life: 520, age: 0, color: color || theme().color });
    start();
  }

  function start() { if (!raf) raf = requestAnimationFrame(loop); }

  function loop(now) {
    var dt = now - (loop.t || now); loop.t = now;
    dt = Math.min(34, dt);
    var t = dt / 16.67;
    ctx.clearRect(0, 0, W, H);
    var th = theme();

    for (var i = parts.length - 1; i >= 0; i--) {
      var p = parts[i];
      p.age += dt;
      if (p.age >= p.life) { parts.splice(i, 1); continue; }
      p.x += p.vx * t; p.y += p.vy * t;
      p.vy += th.grav * t; p.vx *= 0.99; p.rot += p.spin * t;
      var k = 1 - p.age / p.life;
      ctx.globalAlpha = k;
      ctx.fillStyle = p.color; ctx.strokeStyle = p.color;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      if (p.shape === 'dot' || p.shape === 'ember') {
        ctx.beginPath(); ctx.arc(0, 0, p.size * k, 0, 6.29); ctx.fill();
      } else if (p.shape === 'shard') {
        ctx.beginPath(); ctx.moveTo(0, -p.size); ctx.lineTo(p.size * 0.5, 0);
        ctx.lineTo(0, p.size); ctx.lineTo(-p.size * 0.5, 0); ctx.closePath(); ctx.fill();
      } else if (p.shape === 'leaf') {
        ctx.beginPath(); ctx.ellipse(0, 0, p.size * 1.5, p.size * 0.6, 0, 0, 6.29); ctx.fill();
      } else if (p.shape === 'arc') {
        ctx.lineWidth = 1.4 * DPR;
        ctx.beginPath(); ctx.moveTo(0, 0);
        ctx.lineTo(-p.vx * 2.2, -p.vy * 2.2); ctx.stroke();
      } else {
        ctx.lineWidth = 1.2 * DPR;
        ctx.beginPath(); ctx.arc(0, 0, p.size * (2 - k), 0, 6.29); ctx.stroke();
      }
      ctx.restore();
    }

    for (var j = rings.length - 1; j >= 0; j--) {
      var r = rings[j];
      r.age += dt;
      if (r.age >= r.life) { rings.splice(j, 1); continue; }
      var kk = r.age / r.life;
      ctx.globalAlpha = (1 - kk) * 0.8;
      ctx.strokeStyle = r.color; ctx.lineWidth = 2.5 * DPR * (1 - kk);
      ctx.beginPath(); ctx.arc(r.x, r.y, r.r + 90 * DPR * kk, 0, 6.29); ctx.stroke();
    }
    ctx.globalAlpha = 1;

    if (!parts.length && !rings.length) { raf = 0; loop.t = 0; ctx.clearRect(0, 0, W, H); return; }
    raf = requestAnimationFrame(loop);
  }

  /* ===================== 3. 浮动数字 ===================== */
  var stage = null;
  function findStage() {
    if (stage && document.contains(stage)) return stage;
    var cv = document.querySelector('canvas:not(#fxLayer)');
    stage = cv ? cv.parentNode : null;
    return stage;
  }

  function floatText(x, y, text, crit) {
    if (reduced) return;
    var el = document.createElement('span');
    el.textContent = text;
    el.style.cssText = 'position:fixed;left:' + x + 'px;top:' + y + 'px;transform:translate(-50%,-50%);' +
      'pointer-events:none;font-weight:700;font-size:' + (crit ? 20 : 14) + 'px;z-index:9001;' +
      'color:' + (crit ? '#ffd76a' : theme().color) + ';text-shadow:0 2px 8px rgba(0,0,0,.6);' +
      'transition:transform .8s cubic-bezier(.2,.7,.3,1),opacity .8s;opacity:1';
    document.body.appendChild(el);
    requestAnimationFrame(function () {
      el.style.transform = 'translate(-50%,-50%) translate(' + rnd(-18, 18) + 'px,-' + rnd(48, 78) + 'px) scale(' + (crit ? 1.3 : 1) + ')';
      el.style.opacity = '0';
    });
    setTimeout(function () { el.remove(); }, 850);
  }

  function shake(power) {
    if (reduced) return;
    var st = findStage(); if (!st) return;
    st.style.transition = 'none';
    st.style.transform = 'translate(' + rnd(-power, power) + 'px,' + rnd(-power, power) + 'px)';
    setTimeout(function () {
      st.style.transition = 'transform .18s ease-out';
      st.style.transform = '';
    }, 40);
  }

  /* ===================== 4. 事件挂载 ===================== */
  var lastWorld = -1, lastToast = 0;

  function isPlanetClick(el) {
    if (!el || el.tagName !== 'CANVAS' || el === layer) return false;
    var r = el.getBoundingClientRect();
    return r.width > 120 && r.height > 120;
  }

  var lastXY = { x: innerWidth / 2, y: innerHeight / 2 };
  document.addEventListener('pointerdown', function (e) {
    lastXY.x = e.clientX; lastXY.y = e.clientY;
    if (!isPlanetClick(e.target)) return;
    SFX.click(S().combo || 0, false);
  }, { passive: true });

  // 游戏自己会生成 .float 浮动数字 —— 盯着它，暴击就炸一波
  function watchFloats() {
    var host = document.getElementById('floatLayer') || document.querySelector('.stage');
    if (!host) { setTimeout(watchFloats, 600); return; }
    new MutationObserver(function (muts) {
      for (var m = 0; m < muts.length; m++) {
        var nodes = muts[m].addedNodes;
        for (var i = 0; i < nodes.length; i++) {
          var n = nodes[i];
          if (!n.classList || !n.classList.contains('float')) continue;
          var crit = n.classList.contains('crit');
          var box = n.getBoundingClientRect();
          var x = box.left + box.width / 2, y = box.top + box.height / 2;
          if (!x && !y) { x = lastXY.x; y = lastXY.y; }
          var combo = S().combo || 0;
          burst(x, y, crit ? 34 : Math.min(20, 7 + Math.floor(combo / 3)), 1 + Math.min(combo, 30) / 14);
          if (crit) {
            ring(x, y, '#ffd76a');
            shake(5);
            burst(x, y, 18, 2.2);
          }
          if (combo > 0 && combo % 10 === 0) ring(x, y);
        }
      }
    }).observe(host, { childList: true });
  }
  watchFloats();

  // 提示音：拦截 toast，按内容猜事件
  var rawToast = DD.toast;
  DD.toast = function (msg, ms) {
    var now = Date.now();
    if (now - lastToast > 260 && typeof msg === 'string') {
      lastToast = now;
      if (msg.indexOf('🎮') >= 0) SFX.mini(msg.indexOf('星尘') >= 0);
      else if (msg.indexOf('👑') >= 0 || msg.indexOf('晋级') >= 0 || msg.indexOf('身份') >= 0) SFX.rank();
      else if (msg.indexOf('🏆') >= 0 || msg.indexOf('成就') >= 0) SFX.rank();
      else if (msg.indexOf('🔭') >= 0 || msg.indexOf('星球') >= 0) SFX.world();
      else SFX.buy();
    }
    return rawToast.apply(DD, arguments);
  };

  /* ===================== 5. 新星球玩法 ===================== */
  // 量子裂隙：随机冒出光球，点中给奖励（第 5 颗星球起）
  // 虚空潮汐：定时开启双倍窗口（第 6 颗星球）
  var orb = null, tide = null, tideEnd = 0;

  function spawnOrb() {
    if (orb) return;
    var st = S();
    if (st.world < 4) return;
    var el = document.createElement('button');
    el.type = 'button';
    el.textContent = st.world >= 5 ? '🌑' : '⚛️';
    el.style.cssText = 'position:fixed;width:62px;height:62px;border-radius:50%;' +
      'border:2px solid ' + theme().color + ';background:radial-gradient(circle,rgba(255,255,255,.25),rgba(0,0,0,.35));' +
      'font-size:26px;line-height:1;z-index:9100;cursor:pointer;' +
      'box-shadow:0 0 26px ' + theme().color + ';animation:fxOrb 8s ease-out forwards';
    el.style.left = rnd(18, 78) + 'vw';
    el.style.top = rnd(22, 62) + 'vh';
    el.addEventListener('click', function () {
      var rew = Math.max(50, DD.cps * 45 + DD.clickPower * 12);
      DD.addDust(rew);
      var b = el.getBoundingClientRect();
      burst(b.left + b.width / 2, b.top + b.height / 2, 40, 1.6);
      ring(b.left + b.width / 2, b.top + b.height / 2, '#fff');
      SFX.orb();
      DD.toast('✨ 裂隙收获 +' + DD.fmt(rew) + ' 星尘', 2000);
      el.remove(); orb = null;
    });
    document.body.appendChild(el);
    orb = el;
    setTimeout(function () { if (orb === el) { el.remove(); orb = null; } }, 8200);
  }

  function startTide() {
    if (tide || S().world < 5) return;
    tideEnd = Date.now() + 12000;
    var el = document.createElement('div');
    el.className = 'fx-tide';
    el.textContent = '🌊 虚空潮汐 · 12 秒内点击 ×2';
    document.body.appendChild(el);
    tide = el;
    SFX.tide();
    for (var i = 0; i < 3; i++) setTimeout(function () { ring(innerWidth / 2, innerHeight / 2, '#c6a8ff'); }, i * 320);
  }

  setInterval(function () {
    if (S().world >= 4 && Math.random() < 0.5) spawnOrb();
  }, 26000);
  setInterval(function () {
    if (tide && Date.now() > tideEnd) { tide.remove(); tide = null; }
    if (S().world >= 5 && Math.random() < 0.35) startTide();
  }, 52000);

  // 双倍窗口：把这段时间内的增补一份
  var lastDust = null;
  setInterval(function () {
    var st = S();
    if (tide && lastDust !== null && st.dust > lastDust) {
      DD.addDust(st.dust - lastDust);
    }
    lastDust = st.dust;
  }, 1200);

  /* ===================== 6. 切换星球 & 主循环 ===================== */
  setInterval(function () {
    var w = S().world;
    if (w !== lastWorld) {
      if (lastWorld >= 0) {
        SFX.world();
        for (var i = 0; i < 5; i++) {
          setTimeout(function () {
            burst(rnd(innerWidth * 0.25, innerWidth * 0.75), rnd(innerHeight * 0.25, innerHeight * 0.65), 26, 1.8);
            ring(innerWidth / 2, innerHeight * 0.45);
          }, i * 130);
        }
      }
      lastWorld = w;
      document.body.setAttribute('data-fx-world', w);
    }
  }, 300);

  /* ===================== 7. 开关与样式 ===================== */
  var style = document.createElement('style');
  style.textContent =
    '@keyframes fxOrb{0%{opacity:0;transform:scale(.5)}12%{opacity:1;transform:scale(1.1)}' +
    '50%{transform:scale(1) rotate(8deg)}85%{opacity:1}100%{opacity:0;transform:scale(.7)}}' +
    '.fx-tide{position:fixed;left:50%;top:12%;transform:translateX(-50%);z-index:9100;' +
    'padding:8px 16px;border-radius:999px;font-size:13px;color:#e8e2ff;' +
    'background:rgba(90,60,150,.72);border:1px solid rgba(198,168,255,.7);' +
    'box-shadow:0 0 24px rgba(160,120,255,.6);animation:fxPulse 1.2s ease-in-out infinite}' +
    '@keyframes fxPulse{0%,100%{opacity:.85}50%{opacity:1}}' +
    '#fxToggle{position:fixed;right:10px;bottom:78px;width:40px;height:40px;border-radius:50%;z-index:9200;' +
    'border:1px solid rgba(255,255,255,.18);background:rgba(20,22,28,.78);color:#cfd6e0;' +
    'font-size:16px;line-height:1;cursor:pointer}';
  document.head.appendChild(style);

  var btn = document.createElement('button');
  btn.id = 'fxToggle';
  btn.type = 'button';
  btn.textContent = muted ? '🔇' : '🔊';
  btn.style.opacity = '0.75';
  btn.addEventListener('click', function () {
    muted = !muted;
    btn.textContent = muted ? '🔇' : '🔊';
    try { localStorage.setItem('aiweb.sfx.mute', muted ? '1' : '0'); } catch (e) {}
    if (!muted) { ac(); SFX.buy(); }
  });
  document.body.appendChild(btn);

  // 第一次交互解锁音频
  var unlocked = false;
  document.addEventListener('pointerdown', function once() {
    if (unlocked) return;
    unlocked = true;
    ac();
  }, { once: true, passive: true });

  window.DDFX = { burst: burst, ring: ring, sfx: SFX, toggle: function () { btn.click(); } };
})();
