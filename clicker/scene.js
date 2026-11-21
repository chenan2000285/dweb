/* ============================================================
   点点星球 · 星球场景引擎 v4  (scene.js)
   用 canvas 画：天空 / 星空 / 日月 / 星球本体 / 光环
                / 天气(云雨雪雾雷) / 采集飞船 / 点击特效
   对外只暴露 window.PlanetScene 和 window.SceneKit
   ============================================================ */
(function (global) {
  'use strict';

  var TAU = Math.PI * 2;

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function rand(a, b) { return a + Math.random() * (b - a); }

  /* ---------------- 颜色工具 ---------------- */
  var _hex = {};
  function hex2rgb(h) {
    if (_hex[h]) return _hex[h];
    var s = String(h).replace('#', '');
    if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
    var n = parseInt(s, 16) || 0;
    var c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    _hex[h] = c;
    return c;
  }
  function rgba(h, a) {
    var c = hex2rgb(h);
    return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
  }
  function mixRgb(a, b, t) {
    var A = hex2rgb(a), B = hex2rgb(b);
    return 'rgb(' + Math.round(lerp(A[0], B[0], t)) + ',' +
      Math.round(lerp(A[1], B[1], t)) + ',' +
      Math.round(lerp(A[2], B[2], t)) + ')';
  }

  /* ---------------- 固定种子随机 ---------------- */
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  /* ---------------- 四颗星球的场景配色 ----------------
     sky: 一天之内的天空颜色关键帧（小时 0→24）
     planet: 星球表面纹理用色
     ring: 光环颜色与倾斜
  ------------------------------------------------------- */
  var PALETTES = [
    { // 0 靛蓝：旧天文图上的墨蓝
      accent: '#7e9cb0',
      planet: { base: '#46636f', light: '#b9cbd6', dark: '#16232b', blotch: '#2e4750', blotch2: '#9fb3bf' },
      ring: { color: '#b9cbd6', tilt: -0.34 },
      sky: [
        { h: 0, top: '#14151a', bot: '#0b0b0e' },
        { h: 5, top: '#242a30', bot: '#12141a' },
        { h: 7, top: '#5c6b72', bot: '#2a3036' },
        { h: 12, top: '#6e7e84', bot: '#2c3338' },
        { h: 17.5, top: '#7a5e52', bot: '#33241e' },
        { h: 20, top: '#1a1a1e', bot: '#0c0c10' },
        { h: 24, top: '#14151a', bot: '#0b0b0e' },
      ],
    },
    { // 1 赤陶：窑火与锈红
      accent: '#c07a4b',
      planet: { base: '#8a4a2a', light: '#e6c6a2', dark: '#2a150c', blotch: '#5e2f1a', blotch2: '#d9a472' },
      ring: { color: '#d9a472', tilt: 0.30 },
      sky: [
        { h: 0, top: '#150f0b', bot: '#0a0705' },
        { h: 5, top: '#2a1810', bot: '#140b07' },
        { h: 7, top: '#7a4227', bot: '#2e1710' },
        { h: 12, top: '#6e3e2a', bot: '#2a150f' },
        { h: 17.5, top: '#8e4e2c', bot: '#3a1c10' },
        { h: 20, top: '#241310', bot: '#0d0706' },
        { h: 24, top: '#150f0b', bot: '#0a0705' },
      ],
    },
    { // 2 霜青：雨后的石绿
      accent: '#8fa9a3',
      planet: { base: '#4c6e68', light: '#d2dfd8', dark: '#172622', blotch: '#2f4a45', blotch2: '#b4c8c0' },
      ring: { color: '#cbd9d3', tilt: -0.22 },
      sky: [
        { h: 0, top: '#0f1517', bot: '#070b0c' },
        { h: 5, top: '#1b2a2c', bot: '#0c1517' },
        { h: 7, top: '#4a6a6a', bot: '#1d2e2e' },
        { h: 12, top: '#3f5f60', bot: '#182828' },
        { h: 17.5, top: '#6b4f46', bot: '#2a1e1a' },
        { h: 20, top: '#121a1b', bot: '#080d0e' },
        { h: 24, top: '#0f1517', bot: '#070b0c' },
      ],
    },
    { // 3 苔绿：旧地图上的橄榄
      accent: '#8a9a5b',
      planet: { base: '#536330', light: '#cbd6a9', dark: '#1c2413', blotch: '#3a471f', blotch2: '#abb87b' },
      ring: { color: '#c2cfa5', tilt: 0.26 },
      sky: [
        { h: 0, top: '#101309', bot: '#080a05' },
        { h: 5, top: '#1e2414', bot: '#0e110a' },
        { h: 7, top: '#4e5c33', bot: '#202814' },
        { h: 12, top: '#3f4c2a', bot: '#1a2010' },
        { h: 17.5, top: '#6e5a30', bot: '#2c2412' },
        { h: 20, top: '#14180c', bot: '#090b05' },
        { h: 24, top: '#101309', bot: '#080a05' },
      ],
    },
  ];

  /* ---------------- 时间 ---------------- */
  // 量子星球配色 / 虚空星球配色（复用已有天色，只换星球本体）
  PALETTES.push(
    {
      accent: '#8ff0ff',
      planet: { base: '#1d4d5a', light: '#c9f6ff', dark: '#06141a', blotch: '#2f7f92', blotch2: '#a8e8f5' },
      ring: { color: '#8ff0ff', tilt: 0.52 },
      sky: PALETTES[2].sky
    },
    {
      accent: '#c6a8ff',
      planet: { base: '#241b3a', light: '#cbb8ff', dark: '#08050f', blotch: '#3b2b5e', blotch2: '#a98ce0' },
      ring: { color: '#c6a8ff', tilt: -0.62 },
      sky: PALETTES[0].sky
    }
  );

  function skyOf(pal, hour) {
    var k = pal.sky, a = k[0], b = k[k.length - 1];
    for (var i = 0; i < k.length - 1; i++) {
      if (hour >= k[i].h && hour <= k[i + 1].h) { a = k[i]; b = k[i + 1]; break; }
    }
    var span = Math.max(0.001, b.h - a.h);
    var t = clamp((hour - a.h) / span, 0, 1);
    return { top: mixRgb(a.top, b.top, t), bot: mixRgb(a.bot, b.bot, t) };
  }

  function phaseOf(h) {
    if (h < 5) return { key: 'night', name: '深夜', icon: '🌙' };
    if (h < 7) return { key: 'dawn', name: '黎明', icon: '🌅' };
    if (h < 11) return { key: 'day', name: '上午', icon: '☀️' };
    if (h < 14) return { key: 'day', name: '正午', icon: '🌞' };
    if (h < 17) return { key: 'day', name: '下午', icon: '🌤' };
    if (h < 19.5) return { key: 'dusk', name: '黄昏', icon: '🌇' };
    if (h < 22) return { key: 'night', name: '夜晚', icon: '🌙' };
    return { key: 'night', name: '深夜', icon: '🌙' };
  }

  // 返回当前时间对场景的影响：日照强度、太阳在天空中的位置、时段名
  function timeInfo(date) {
    var d = date || new Date();
    var hour = d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
    var daylight = clamp(Math.sin(((hour - 6) / 12) * Math.PI), 0, 1);
    var phase = phaseOf(hour);
    // 月亮在 18:00~次日 6:00 之间走完一条弧线
    var moonT = ((hour - 18 + 24) % 24) / 12;
    return {
      hour: hour,
      daylight: daylight,
      sunT: clamp((hour - 6) / 12, 0, 1),
      moonT: clamp(moonT, 0, 1),
      phase: phase.key,
      phaseName: phase.name,
      phaseIcon: phase.icon,
      clock: ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2),
    };
  }

  /* ---------------- 天气 ---------------- */
  // clouds / rain / snow / fog / light: 0~1 强度；tint: 阴天压暗程度
  var WX = {
    clear:    { label: '晴',     icon: '☀️', clouds: 0.04, rain: 0,    snow: 0,    fog: 0,    light: 0, tint: 0 },
    partly:   { label: '少云',   icon: '🌤',  clouds: 0.30, rain: 0,    snow: 0,    fog: 0,    light: 0, tint: 0.04 },
    cloudy:   { label: '多云',   icon: '⛅',  clouds: 0.55, rain: 0,    snow: 0,    fog: 0,    light: 0, tint: 0.08 },
    overcast: { label: '阴',     icon: '☁️', clouds: 0.90, rain: 0,    snow: 0,    fog: 0,    light: 0, tint: 0.18 },
    fog:      { label: '雾',     icon: '🌫',  clouds: 0.45, rain: 0,    snow: 0,    fog: 1.0,  light: 0, tint: 0.20 },
    drizzle:  { label: '毛毛雨', icon: '🌦',  clouds: 0.70, rain: 0.35, snow: 0,    fog: 0.2,  light: 0, tint: 0.14 },
    rain:     { label: '下雨',   icon: '🌧',  clouds: 0.90, rain: 0.90, snow: 0,    fog: 0.1,  light: 0, tint: 0.22 },
    shower:   { label: '阵雨',   icon: '🌧',  clouds: 0.85, rain: 1.00, snow: 0,    fog: 0,    light: 0, tint: 0.20 },
    thunder:  { label: '雷雨',   icon: '⛈',  clouds: 1.00, rain: 1.00, snow: 0,    fog: 0,    light: 1, tint: 0.30 },
    snow:     { label: '下雪',   icon: '🌨',  clouds: 0.85, rain: 0,    snow: 0.95, fog: 0.1,  light: 0, tint: 0.14 },
  };

  // WMO 天气代码 → 场景天气类型
  function kindFromCode(code) {
    code = Number(code);
    if (code === 0) return 'clear';
    if (code === 1) return 'partly';
    if (code === 2) return 'cloudy';
    if (code === 3) return 'overcast';
    if (code === 45 || code === 48) return 'fog';
    if (code >= 51 && code <= 57) return 'drizzle';
    if (code >= 61 && code <= 67 && code !== 66 && code !== 67) return 'rain';
    if (code === 66 || code === 67) return 'rain';
    if (code >= 71 && code <= 77) return 'snow';
    if (code === 80 || code === 81) return 'rain';
    if (code === 82) return 'shower';
    if (code === 85 || code === 86) return 'snow';
    if (code >= 95) return 'thunder';
    return 'clear';
  }

  function iconOf(kind) { return (WX[kind] || WX.clear).icon; }
  function labelOf(kind) { return (WX[kind] || WX.clear).label; }

  /* ============================================================
     PlanetScene：一块 canvas 就是一颗会呼吸的星球
     ============================================================ */
  function PlanetScene(canvas, opts) {
    opts = opts || {};
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.world = opts.world || 0;
    this.preview = !!opts.preview;
    this.reduced = !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches);

    this.w = 0; this.h = 0; this.cx = 0; this.cy = 0; this.r = 60;
    this.t = 0; this.last = 0; this.running = false; this.raf = 0;
    this.texOff = 0; this.texture = null;
    this.time = timeInfo();

    this.stars = [];
    this.clouds = [];
    this.drops = [];
    this.flakes = [];
    this.lights = [];
    this.ships = [];
    this.parts = [];
    this.rings = [];
    this.kick = 0;
    this.bolt = null;
    this.boltFlash = 0;
    this.boltTimer = 5;

    this.weather = { kind: 'clear', temp: null };
    if (opts.weather) this.weather = opts.weather;

    this.onCollect = null;
    this.frame = this.frame.bind(this);

    this.resize();
    this.buildSky();
    this.buildPlanetBits();
    this.buildShips();
  }

  PlanetScene.prototype.setWorld = function (i) {
    this.world = i;
    this.texture = null;
    this.texOff = 0;
    this.buildPlanetBits();
    this.buildShips();
  };

  PlanetScene.prototype.setWeather = function (wx) {
    var changed = !this.weather || this.weather.kind !== wx.kind;
    this.weather = wx;
    this.buildPrecip();
    if (changed) this.buildClouds();
  };

  /* ---------- 布局 ---------- */
  PlanetScene.prototype.resize = function () {
    var dpr = Math.min(global.devicePixelRatio || 1, 2);
    var rect = this.cv.getBoundingClientRect ? this.cv.getBoundingClientRect() : { width: 0, height: 0 };
    var w = Math.max(60, Math.round(rect.width || this.cv.clientWidth || 300));
    var h = Math.max(60, Math.round(rect.height || this.cv.clientHeight || 220));
    this.w = w; this.h = h;
    this.cv.width = Math.round(w * dpr);
    this.cv.height = Math.round(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.cx = w / 2;
    this.cy = h * 0.545;
    this.r = Math.min(w * 0.265, h * 0.285);
    this.buildStars();
    this.buildClouds();
    this.buildPrecip();
    this.buildLights();
  };

  /* ---------- 场景元素 ---------- */
  PlanetScene.prototype.buildStars = function () {
    var n = this.reduced ? 34 : 74;
    this.stars = [];
    for (var i = 0; i < n; i++) {
      this.stars.push({
        x: Math.random(), y: Math.random() * 0.86,
        r: rand(0.5, 1.5), a: rand(0.25, 0.95),
        sp: rand(0.5, 2.2), ph: rand(0, TAU),
      });
    }
  };

  PlanetScene.prototype.buildClouds = function () {
    var cfg = WX[this.weather.kind] || WX.clear;
    var n = cfg.clouds > 0.1 ? Math.round(3 + cfg.clouds * 5) : 0;
    this.clouds = [];
    for (var i = 0; i < n; i++) {
      this.clouds.push({
        x: rand(-1.2, 1.2), y: rand(-0.65, 0.6),
        s: rand(0.35, 0.85), sp: rand(0.06, 0.22),
        a: rand(0.5, 1),
      });
    }
  };

  PlanetScene.prototype.buildPrecip = function () {
    var cfg = WX[this.weather.kind] || WX.clear;
    var drops = Math.round((this.reduced ? 40 : 78) * cfg.rain);
    var flakes = Math.round((this.reduced ? 26 : 52) * cfg.snow);
    while (this.drops.length < drops) {
      this.drops.push({ x: rand(-1, 1), y: rand(-1, 1), v: rand(0.7, 1.5), l: rand(0.6, 1.3) });
    }
    this.drops.length = drops;
    while (this.flakes.length < flakes) {
      this.flakes.push({ x: rand(-1, 1), y: rand(-1, 1), v: rand(0.18, 0.42), s: rand(0.6, 1.6), ph: rand(0, TAU) });
    }
    this.flakes.length = flakes;
    if (!cfg.light) { this.bolt = null; this.boltFlash = 0; }
  };

  // 夜里的城市灯光（固定位置）
  PlanetScene.prototype.buildLights = function () {
    var rng = mulberry32(this.world * 977 + 31);
    this.lights = [];
    for (var i = 0; i < 26; i++) {
      var a = rng() * TAU, d = Math.sqrt(rng()) * 0.82;
      this.lights.push({
        x: Math.cos(a) * d, y: Math.sin(a) * d,
        s: 0.008 + rng() * 0.016, ph: rng() * TAU,
      });
    }
  };

  PlanetScene.prototype.buildPlanetBits = function () { this.buildLights(); };
  PlanetScene.prototype.buildSky = function () { this.buildStars(); };

  PlanetScene.prototype.buildShips = function () {
    var n = this.preview ? 1 : 2;
    this.ships = [];
    for (var i = 0; i < n; i++) {
      var dir = i % 2 ? -1 : 1;
      this.ships.push({
        a: rand(0, TAU), sp: rand(0.22, 0.4) * dir,
        radK: rand(1.45, 1.8), tilt: 0.42,
        phase: 'orbit', p: 0, hold: 0,
        anchor: { x: 0, y: 0 }, target: { x: 0, y: 0 },
        trail: [], dir: 0,
      });
    }
  };

  /* ---------- 纹理（一张 512x256 的程序化星球表面） ---------- */
  PlanetScene.prototype.makeTexture = function () {
    var W = 512, H = 256;
    var c = document.createElement('canvas');
    c.width = W; c.height = H;
    var g = c.getContext('2d');
    var pal = PALETTES[this.world].planet;
    var rng = mulberry32(this.world * 131 + 7);
    var i, x, y, rr, gr;

    g.fillStyle = pal.base;
    g.fillRect(0, 0, W, H);

    // 大片色块 / 大陆
    for (i = 0; i < 34; i++) {
      x = rng() * W; y = rng() * H;
      rr = 18 + rng() * 74;
      gr = g.createRadialGradient(x, y, 0, x, y, rr);
      var col = rng() > 0.5 ? pal.blotch : pal.blotch2;
      gr.addColorStop(0, rgba(col, 0.24 + rng() * 0.36));
      gr.addColorStop(1, rgba(col, 0));
      g.fillStyle = gr;
      g.beginPath(); g.arc(x, y, rr, 0, TAU); g.fill();
    }

    // 两极淡色
    var pole = g.createLinearGradient(0, 0, 0, H);
    pole.addColorStop(0, rgba(pal.light, 0.34));
    pole.addColorStop(0.18, rgba(pal.light, 0));
    pole.addColorStop(0.82, rgba(pal.light, 0));
    pole.addColorStop(1, rgba(pal.light, 0.34));
    g.fillStyle = pole;
    g.fillRect(0, 0, W, H);

    // 每颗星球的专属细节
    if (this.world === 1) {
      // 烈焰：发光裂缝
      g.lineCap = 'round';
      for (i = 0; i < 26; i++) {
        var sx = rng() * W, sy = rng() * H;
        g.beginPath(); g.moveTo(sx, sy);
        for (var k = 0; k < 4; k++) {
          sx += (rng() - 0.5) * 60; sy += (rng() - 0.5) * 34;
          g.lineTo(sx, sy);
        }
        g.strokeStyle = rgba(i % 3 ? '#c07a4b' : '#d9a472', 0.30 + rng() * 0.45);
        g.lineWidth = 1 + rng() * 2.6;
        g.stroke();
      }
    } else if (this.world === 2) {
      // 霜蓝：冰面细纹
      for (i = 0; i < 40; i++) {
        var ax = rng() * W, ay = rng() * H;
        g.beginPath(); g.moveTo(ax, ay);
        g.lineTo(ax + (rng() - 0.5) * 90, ay + (rng() - 0.5) * 30);
        g.strokeStyle = rgba('#fff6e3', 0.14 + rng() * 0.3);
        g.lineWidth = 0.7 + rng() * 1.2;
        g.stroke();
      }
    } else if (this.world === 3) {
      // 翡翠：河流与深林
      g.lineCap = 'round';
      for (i = 0; i < 12; i++) {
        var rx = rng() * W, ry = rng() * H;
        g.beginPath(); g.moveTo(rx, ry);
        for (var j = 0; j < 5; j++) {
          rx += (rng() - 0.5) * 70; ry += (rng() - 0.3) * 40;
          g.lineTo(rx, ry);
        }
        g.strokeStyle = rgba('#a9c4c0', 0.20 + rng() * 0.25);
        g.lineWidth = 1.4 + rng() * 2.2;
        g.stroke();
      }
      for (i = 0; i < 16; i++) {
        var dx = rng() * W, dy = rng() * H, dr = 12 + rng() * 26;
        var dg = g.createRadialGradient(dx, dy, 0, dx, dy, dr);
        dg.addColorStop(0, rgba('#33482f', 0.55));
        dg.addColorStop(1, rgba('#33482f', 0));
        g.fillStyle = dg;
        g.beginPath(); g.arc(dx, dy, dr, 0, TAU); g.fill();
      }
    } else {
      // 暮紫：环形山
      for (i = 0; i < 14; i++) {
        var px = rng() * W, py = rng() * H, pr = 8 + rng() * 22;
        g.beginPath(); g.arc(px, py, pr, 0, TAU);
        g.strokeStyle = rgba(pal.light, 0.16 + rng() * 0.2);
        g.lineWidth = 1.4;
        g.stroke();
        g.beginPath(); g.arc(px, py, pr * 0.55, 0, TAU);
        g.fillStyle = rgba(pal.dark, 0.16);
        g.fill();
      }
    }

    return c;
  };

  /* ---------- 控制 ---------- */
  PlanetScene.prototype.start = function () {
    if (this.running) return;
    this.running = true;
    this.last = 0;
    this.raf = global.requestAnimationFrame(this.frame);
  };

  PlanetScene.prototype.stop = function () {
    this.running = false;
    if (this.raf) global.cancelAnimationFrame(this.raf);
    this.raf = 0;
  };

  PlanetScene.prototype.frame = function (now) {
    if (!this.running) return;
    var dt = this.last ? Math.min(0.05, (now - this.last) / 1000) : 0.016;
    this.last = now;
    this.t += dt;
    if (this.w < 40) this.resize();
    try {
      this.update(dt);
      this.draw();
    } catch (e) {
      if (global.console) console.error('[scene]', e);
    }
    this.raf = global.requestAnimationFrame(this.frame);
  };

  /* ---------- 交互特效 ---------- */
  PlanetScene.prototype.burst = function (x, y, crit) {
    var n = this.reduced ? 5 : (crit ? 26 : 10);
    var pal = PALETTES[this.world];
    for (var i = 0; i < n; i++) {
      var a = Math.random() * TAU;
      var sp = rand(40, crit ? 210 : 130);
      this.parts.push({
        x: x, y: y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 20,
        life: rand(0.4, 0.9), max: 0.9,
        size: rand(1.1, crit ? 3.4 : 2.4),
        color: i % 5 === 0 ? '#d8b25a' : (i % 3 === 0 ? '#fff6e3' : pal.accent),
      });
    }
    this.rings.push({ x: x, y: y, r: this.r * 0.16, life: 1, crit: !!crit });
    if (crit) this.kick = 1;
  };

  PlanetScene.prototype.collect = function () {
    if (!this.ships.length) return;
    var s = null;
    for (var i = 0; i < this.ships.length; i++) {
      if (this.ships[i].phase === 'orbit') { s = this.ships[i]; break; }
    }
    if (!s) return;
    var pd = this.shipPos(s);
    s.anchor.x = pd.x; s.anchor.y = pd.y;
    var ang = rand(0, TAU), d = rand(0.35, 0.78);
    s.target.x = this.cx + Math.cos(ang) * this.r * d;
    s.target.y = this.cy + Math.sin(ang) * this.r * d;
    s.phase = 'dive';
    s.p = 0;
    s.trail.length = 0;
  };

  PlanetScene.prototype.kickIt = function () { this.kick = 1; };

  PlanetScene.prototype.shipPos = function (s) {
    if (s.phase === 'orbit') {
      return {
        x: this.cx + Math.cos(s.a) * this.r * s.radK,
        y: this.cy + Math.sin(s.a) * this.r * s.radK * s.tilt,
      };
    }
    var e = s.phase === 'dive' ? s.p : (s.phase === 'rise' ? s.p : 1);
    e = e * e * (3 - 2 * e); // smoothstep
    var lift = Math.sin(Math.PI * s.p) * this.r * 0.18;
    return {
      x: lerp(s.anchor.x, s.target.x, e),
      y: lerp(s.anchor.y, s.target.y, e) - lift,
    };
  };

  /* ---------- 更新 ---------- */
  PlanetScene.prototype.update = function (dt) {
    this.time = timeInfo();
    var cfg = WX[this.weather.kind] || WX.clear;
    var i, s;

    this.texOff += dt * this.r * (this.reduced ? 0.03 : 0.075);
    this.kick = Math.max(0, this.kick - dt * 2.6);

    // 雨
    for (i = 0; i < this.drops.length; i++) {
      var d = this.drops[i];
      d.y += d.v * dt * (0.5 + cfg.rain);
      d.x -= dt * 0.08;
      if (d.y > 1.05) { d.y = -1.05; d.x = rand(-1, 1); }
    }
    // 雪
    for (i = 0; i < this.flakes.length; i++) {
      var f = this.flakes[i];
      f.y += f.v * dt;
      f.x += Math.sin(this.t * 0.9 + f.ph) * 0.22 * dt;
      if (f.y > 1.05) { f.y = -1.05; f.x = rand(-1, 1); }
    }
    // 雷
    if (cfg.light) {
      this.boltTimer -= dt;
      if (this.boltTimer <= 0) {
        this.boltTimer = rand(4, 11);
        this.boltFlash = 1;
        var pts = [], bx = this.cx + rand(-this.r, this.r), by = this.h * 0.12;
        for (var k = 0; k < 6; k++) {
          pts.push({ x: bx + rand(-this.r * 0.25, this.r * 0.25), y: by + (this.cy - this.r * 0.9 - by) * (k / 5) });
        }
        this.bolt = { pts: pts, t: 0.5 };
      }
    }
    if (this.bolt) { this.bolt.t -= dt; if (this.bolt.t <= 0) this.bolt = null; }
    this.boltFlash = Math.max(0, this.boltFlash - dt * 2.4);

    // 飞船
    for (i = 0; i < this.ships.length; i++) {
      s = this.ships[i];
      var prev = this.shipPos(s);
      if (s.phase === 'orbit') {
        s.a += s.sp * dt;
      } else if (s.phase === 'dive') {
        s.p += dt / 0.75;
        if (s.p >= 1) {
          s.p = 1; s.phase = 'hold'; s.hold = 0.2;
          this.sparkle(s.target.x, s.target.y);
          if (this.onCollect) this.onCollect(s.target.x, s.target.y);
        }
      } else if (s.phase === 'hold') {
        s.hold -= dt;
        if (s.hold <= 0) { s.phase = 'rise'; s.p = 1; }
      } else {
        s.p -= dt / 0.85;
        if (s.p <= 0) { s.p = 0; s.phase = 'orbit'; s.a = Math.atan2(s.anchor.y - this.cy, s.anchor.x - this.cx); }
      }
      var now = this.shipPos(s);
      s.trail.push({ x: now.x, y: now.y });
      if (s.trail.length > 16) s.trail.shift();
      if (Math.abs(now.x - prev.x) + Math.abs(now.y - prev.y) > 0.4) {
        s.dir = Math.atan2(now.y - prev.y, now.x - prev.x);
      }
    }

    // 点击粒子
    for (i = this.parts.length - 1; i >= 0; i--) {
      var p = this.parts[i];
      p.vy += 90 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 0.985;
      p.life -= dt;
      if (p.life <= 0) this.parts.splice(i, 1);
    }
    // 涟漪
    for (i = this.rings.length - 1; i >= 0; i--) {
      var rg = this.rings[i];
      rg.life -= dt * 1.5;
      rg.r += dt * this.r * 1.5;
      if (rg.life <= 0) this.rings.splice(i, 1);
    }
  };

  PlanetScene.prototype.sparkle = function (x, y) {
    var pal = PALETTES[this.world];
    for (var i = 0; i < 14; i++) {
      var a = Math.random() * TAU, sp = rand(20, 90);
      this.parts.push({
        x: x, y: y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30,
        life: rand(0.35, 0.8), max: 0.8,
        size: rand(1, 2.2),
        color: i % 3 ? '#e3c27a' : pal.accent,
      });
    }
  };

  /* ============================================================
     绘制
     ============================================================ */
  PlanetScene.prototype.draw = function () {
    var ctx = this.ctx, w = this.w, h = this.h;
    var pal = PALETTES[this.world];
    var cfg = WX[this.weather.kind] || WX.clear;
    var t = this.time;

    ctx.clearRect(0, 0, w, h);

    /* 天空 */
    var sk = skyOf(pal, t.hour);
    var g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, sk.top);
    g.addColorStop(1, sk.bot);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    /* 星云 */
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    var n1 = ctx.createRadialGradient(w * 0.16, h * 0.16, 0, w * 0.16, h * 0.16, w * 0.48);
    n1.addColorStop(0, rgba(pal.accent, 0.16));
    n1.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = n1; ctx.fillRect(0, 0, w, h);
    var n2 = ctx.createRadialGradient(w * 0.88, h * 0.10, 0, w * 0.88, h * 0.10, w * 0.36);
    n2.addColorStop(0, rgba(pal.planet.light, 0.10));
    n2.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = n2; ctx.fillRect(0, 0, w, h);
    ctx.restore();

    this.drawStars();
    this.drawCelestial();
    this.drawPlanet();
    this.drawShips();
    this.drawParticles();
    this.drawWeatherSky(cfg);
    this.drawVignette();
  };

  PlanetScene.prototype.drawStars = function () {
    var a = clamp(1 - this.time.daylight * 1.9, 0, 1);
    if (a < 0.02) return;
    var ctx = this.ctx;
    for (var i = 0; i < this.stars.length; i++) {
      var s = this.stars[i];
      var tw = this.reduced ? 0.85 : 0.5 + 0.5 * Math.sin(this.t * s.sp + s.ph);
      ctx.globalAlpha = a * tw * s.a;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(s.x * this.w, s.y * this.h, s.r, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  };

  PlanetScene.prototype.drawCelestial = function () {
    var ctx = this.ctx, w = this.w, h = this.h, t = this.time, r = this.r;

    if (t.daylight > 0.01) {
      var x = w * (0.10 + 0.80 * t.sunT);
      var y = h * 1.02 - Math.sin(Math.PI * t.sunT) * h * 0.78;
      var sr = Math.max(9, r * 0.17);
      var sg = ctx.createRadialGradient(x, y, 0, x, y, sr * 6);
      sg.addColorStop(0, 'rgba(255,244,205,' + (0.5 * t.daylight) + ')');
      sg.addColorStop(0.3, 'rgba(255,205,140,' + (0.16 * t.daylight) + ')');
      sg.addColorStop(1, 'rgba(255,180,110,0)');
      ctx.fillStyle = sg;
      ctx.beginPath(); ctx.arc(x, y, sr * 6, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,252,232,' + (0.9 * t.daylight) + ')';
      ctx.beginPath(); ctx.arc(x, y, sr, 0, TAU); ctx.fill();
    }

    var night = clamp(1 - t.daylight * 2.4, 0, 1);
    if (night > 0.03) {
      var mx = w * (0.12 + 0.76 * t.moonT);
      var my = h * 1.0 - Math.sin(Math.PI * t.moonT) * h * 0.62;
      var mr = Math.max(7, r * 0.12);
      var mg = ctx.createRadialGradient(mx, my, mr * 0.6, mx, my, mr * 4.2);
      mg.addColorStop(0, 'rgba(230,223,206,' + (0.22 * night) + ')');
      mg.addColorStop(1, 'rgba(230,223,206,0)');
      ctx.fillStyle = mg;
      ctx.beginPath(); ctx.arc(mx, my, mr * 4.2, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(240,234,219,' + (0.92 * night) + ')';
      ctx.beginPath(); ctx.arc(mx, my, mr, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(206,197,178,' + (0.35 * night) + ')';
      ctx.beginPath(); ctx.arc(mx - mr * 0.3, my + mr * 0.2, mr * 0.22, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(mx + mr * 0.35, my - mr * 0.3, mr * 0.15, 0, TAU); ctx.fill();
    }
  };

  PlanetScene.prototype.drawRing = function (front) {
    var ctx = this.ctx, pal = PALETTES[this.world], r = this.r;
    var tilt = pal.ring.tilt;
    ctx.save();
    ctx.translate(this.cx, this.cy);
    ctx.rotate(tilt);
    var grad = ctx.createLinearGradient(-r * 1.7, 0, r * 1.7, 0);
    grad.addColorStop(0, rgba(pal.planet.dark, 0.05));
    grad.addColorStop(0.3, pal.ring.color);
    grad.addColorStop(0.62, rgba(pal.planet.light, 0.85));
    grad.addColorStop(1, rgba(pal.planet.dark, 0.05));

    ctx.beginPath();
    if (front) ctx.ellipse(0, 0, r * 1.62, r * 0.40, 0, 0, Math.PI);
    else ctx.ellipse(0, 0, r * 1.62, r * 0.40, 0, Math.PI, TAU);
    ctx.strokeStyle = grad;
    ctx.globalAlpha = front ? 0.55 : 0.30;
    ctx.lineWidth = Math.max(2, r * 0.15);
    ctx.stroke();

    // 外侧细环
    ctx.beginPath();
    if (front) ctx.ellipse(0, 0, r * 1.86, r * 0.46, 0, 0, Math.PI);
    else ctx.ellipse(0, 0, r * 1.86, r * 0.46, 0, Math.PI, TAU);
    ctx.globalAlpha = front ? 0.34 : 0.18;
    ctx.lineWidth = Math.max(1, r * 0.03);
    ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = 1;
  };

  PlanetScene.prototype.drawPlanet = function () {
    var ctx = this.ctx, pal = PALETTES[this.world], r = this.r;
    var sh = this.kick > 0 && !this.reduced ? Math.sin(this.t * 70) * r * 0.022 * this.kick : 0;
    var cx = this.cx + sh, cy = this.cy;
    var t = this.time;
    var dl = t.daylight, night = 1 - dl;
    var cfg = WX[this.weather.kind] || WX.clear;

    this.drawRing(0);

    // 大气光晕
    var atm = ctx.createRadialGradient(cx, cy, r * 0.88, cx, cy, r * 1.6);
    atm.addColorStop(0, rgba(pal.planet.light, 0.30 + 0.22 * dl));
    atm.addColorStop(0.55, rgba(pal.accent, 0.10 + 0.10 * dl));
    atm.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = atm;
    ctx.beginPath(); ctx.arc(cx, cy, r * 1.6, 0, TAU); ctx.fill();

    if (!this.texture) this.texture = this.makeTexture();

    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.clip();

    // 表面纹理（水平平移做自转）
    var tw = r * 3.4, th = r * 2.45;
    var off = ((this.texOff % tw) + tw) % tw;
    for (var i = -1; i <= 1; i++) {
      ctx.drawImage(this.texture, cx - tw / 2 - off + i * tw, cy - th / 2, tw, th);
    }

    // 光照
    var sx = cx + (t.sunT - 0.5) * r * 2.2;
    var sy = cy - r * 0.8;
    var lg = ctx.createRadialGradient(sx, sy, r * 0.04, sx, sy, r * 1.95);
    lg.addColorStop(0, 'rgba(255,250,240,' + (0.24 + 0.26 * dl) + ')');
    lg.addColorStop(0.5, 'rgba(255,250,240,0.05)');
    lg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = lg;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

    // 夜面压暗
    var dg = ctx.createLinearGradient(sx, sy, cx * 2 - sx, cy * 2 - sy);
    dg.addColorStop(0, 'rgba(10,8,6,0)');
    dg.addColorStop(0.5, 'rgba(10,8,6,' + (0.22 + 0.42 * night) + ')');
    dg.addColorStop(1, 'rgba(8,7,5,' + (0.45 + 0.4 * night) + ')');
    ctx.fillStyle = dg;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

    // 城市灯
    if (night > 0.2) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (var j = 0; j < this.lights.length; j++) {
        var L = this.lights[j];
        var a = night * (0.35 + 0.3 * Math.sin(this.t * 1.4 + L.ph));
        ctx.fillStyle = rgba('#d9a472', clamp(a, 0, 0.8));
        ctx.beginPath();
        ctx.arc(cx + L.x * r, cy + L.y * r, Math.max(0.6, L.s * r), 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }

    this.drawPlanetWeather(cfg, cx, cy);

    ctx.restore();

    // 晨昏线边缘光
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, Math.max(1, r - 1), 0, TAU);
    var rim = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
    rim.addColorStop(0, rgba(pal.planet.light, 0.6));
    rim.addColorStop(0.4, rgba(pal.planet.light, 0.10));
    rim.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.strokeStyle = rim;
    ctx.lineWidth = Math.max(1.2, r * 0.014);
    ctx.stroke();
    ctx.restore();

    this.drawRing(1);
  };

  // 星球表面的天气：云、雨、雪、雾、雷光（已经裁剪在星球圆内）
  PlanetScene.prototype.drawPlanetWeather = function (cfg, cx, cy) {
    var ctx = this.ctx, r = this.r, i;

    // 云
    if (cfg.clouds > 0.05 && this.clouds.length) {
      for (i = 0; i < this.clouds.length; i++) {
        var c = this.clouds[i];
        var nx = ((c.x + this.t * c.sp + 1.3) % 2.6) - 1.3;
        var px = cx + nx * r, py = cy + c.y * r;
        var rad = c.s * r * 0.55;
        var cg = ctx.createRadialGradient(px, py, 0, px, py, rad);
        cg.addColorStop(0, 'rgba(244,239,225,' + (0.26 * cfg.clouds * c.a) + ')');
        cg.addColorStop(0.6, 'rgba(244,239,225,' + (0.10 * cfg.clouds * c.a) + ')');
        cg.addColorStop(1, 'rgba(244,239,225,0)');
        ctx.fillStyle = cg;
        ctx.beginPath(); ctx.arc(px, py, rad, 0, TAU); ctx.fill();
      }
    }

    // 雨
    if (this.drops.length) {
      ctx.beginPath();
      for (i = 0; i < this.drops.length; i++) {
        var d = this.drops[i];
        var x = cx + d.x * r, y = cy + d.y * r;
        ctx.moveTo(x, y);
        ctx.lineTo(x - r * 0.035, y + r * 0.11 * d.l);
      }
      ctx.strokeStyle = 'rgba(214,206,186,.55)';
      ctx.lineWidth = Math.max(0.8, r * 0.012);
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    // 雪
    if (this.flakes.length) {
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      for (i = 0; i < this.flakes.length; i++) {
        var f = this.flakes[i];
        ctx.beginPath();
        ctx.arc(cx + f.x * r, cy + f.y * r, Math.max(0.7, f.s * r * 0.011), 0, TAU);
        ctx.fill();
      }
    }

    // 雾
    if (cfg.fog > 0.05) {
      for (i = 0; i < 3; i++) {
        var fy = cy + (i - 1) * r * 0.45 + Math.sin(this.t * 0.4 + i) * r * 0.05;
        var fg = ctx.createLinearGradient(cx - r, 0, cx + r, 0);
        fg.addColorStop(0, 'rgba(232,226,209,0)');
        fg.addColorStop(0.5, 'rgba(232,226,209,' + (0.16 * cfg.fog) + ')');
        fg.addColorStop(1, 'rgba(232,226,209,0)');
        ctx.fillStyle = fg;
        ctx.beginPath();
        ctx.ellipse(cx + Math.sin(this.t * 0.3 + i) * r * 0.12, fy, r * 0.98, r * 0.16, 0, 0, TAU);
        ctx.fill();
      }
    }

    // 雷雨闪光
    if (this.boltFlash > 0.01) {
      ctx.fillStyle = 'rgba(226,219,201,' + (this.boltFlash * 0.4) + ')';
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    }
  };

  PlanetScene.prototype.drawShips = function () {
    var ctx = this.ctx, pal = PALETTES[this.world], r = this.r;
    var scale = r / 120;

    for (var i = 0; i < this.ships.length; i++) {
      var s = this.ships[i];
      var pos = this.shipPos(s);

      // 尾巴
      if (s.trail.length > 1) {
        ctx.beginPath();
        ctx.moveTo(s.trail[0].x, s.trail[0].y);
        for (var k = 1; k < s.trail.length; k++) ctx.lineTo(s.trail[k].x, s.trail[k].y);
        ctx.strokeStyle = rgba(pal.planet.light, 0.5);
        ctx.lineWidth = Math.max(0.8, 1.4 * scale);
        ctx.lineCap = 'round';
        ctx.stroke();
      }

      ctx.save();
      ctx.translate(pos.x, pos.y);
      ctx.rotate(s.dir);

      // 尾焰
      var fg = ctx.createRadialGradient(-5 * scale, 0, 0, -5 * scale, 0, 12 * scale);
      fg.addColorStop(0, rgba('#c8d6d6', 0.85));
      fg.addColorStop(1, rgba('#c8d6d6', 0));
      ctx.fillStyle = fg;
      ctx.beginPath(); ctx.arc(-5 * scale, 0, 12 * scale, 0, TAU); ctx.fill();

      // 机身
      ctx.beginPath();
      ctx.moveTo(6.5 * scale, 0);
      ctx.lineTo(-2.5 * scale, 4.2 * scale);
      ctx.lineTo(-5 * scale, 0);
      ctx.lineTo(-2.5 * scale, -4.2 * scale);
      ctx.closePath();
      ctx.fillStyle = '#efe3cb';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.6)';
      ctx.lineWidth = Math.max(0.5, 0.6 * scale);
      ctx.stroke();

      // 舷窗
      ctx.fillStyle = pal.accent;
      ctx.beginPath();
      ctx.arc(1.6 * scale, 0, Math.max(0.6, 1.5 * scale), 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  };

  PlanetScene.prototype.drawParticles = function () {
    var ctx = this.ctx;

    // 涟漪
    for (var i = 0; i < this.rings.length; i++) {
      var rg = this.rings[i];
      ctx.beginPath();
      ctx.arc(rg.x, rg.y, rg.r, 0, TAU);
      ctx.strokeStyle = rgba(rg.crit ? '#d8b25a' : '#fff6e3', Math.max(0, rg.life) * (rg.crit ? 0.85 : 0.55));
      ctx.lineWidth = Math.max(1, (rg.crit ? 3 : 2) * clamp(rg.life + 0.2, 0, 1));
      ctx.stroke();
    }

    // 火花
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (var j = 0; j < this.parts.length; j++) {
      var p = this.parts[j];
      var a = clamp(p.life / p.max, 0, 1);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  };

  // 天空层的天气：闪电 + 阴天压暗
  PlanetScene.prototype.drawWeatherSky = function (cfg) {
    var ctx = this.ctx, w = this.w, h = this.h;

    if (cfg.tint > 0) {
      ctx.fillStyle = 'rgba(34,28,21,' + cfg.tint + ')';
      ctx.fillRect(0, 0, w, h);
    }

    if (this.bolt) {
      var a = clamp(this.bolt.t / 0.5, 0, 1);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(216,209,190,' + (0.16 * a) + ')';
      ctx.fillRect(0, 0, w, h);
      ctx.beginPath();
      for (var i = 0; i < this.bolt.pts.length; i++) {
        var pt = this.bolt.pts[i];
        if (i === 0) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y);
      }
      ctx.strokeStyle = 'rgba(236,230,214,' + (0.9 * a) + ')';
      ctx.lineWidth = 2;
      ctx.shadowBlur = 14;
      ctx.shadowColor = '#c4d2d8';
      ctx.stroke();
      ctx.restore();
    }
  };

  PlanetScene.prototype.drawVignette = function () {
    var ctx = this.ctx, w = this.w, h = this.h;
    var g = ctx.createRadialGradient(w / 2, h * 0.52, Math.min(w, h) * 0.28, w / 2, h * 0.52, Math.max(w, h) * 0.78);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.42)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  };

  /* ---------------- 导出 ---------------- */
  global.PlanetScene = PlanetScene;
  global.SceneKit = {
    PALETTES: PALETTES,
    WX: WX,
    timeInfo: timeInfo,
    skyOf: skyOf,
    kindFromCode: kindFromCode,
    iconOf: iconOf,
    labelOf: labelOf,
  };
})(typeof window !== 'undefined' ? window : this);
