// 点点星球 v6 —— 每星球独立数值 / 星核共振 / 星尘连锁 / 独立成就
// 阅读顺序：1 配置 → 2 状态 → 3 计算 → 4 存档 → 5 天气时间
//          → 6 场景与点击（含连锁） → 7 列表与图鉴 → 8 购买/身份/跃迁
//          → 9 星核共振 → 10 成就 → 11 渲染 → 12 启动
(() => {
  'use strict';

  /* ===================== 1. 配置 ===================== */

  const SAVE_KEY = 'aiweb.clicker.v4';
  const WX_KEY = 'aiweb.clicker.wx.v1';
  const CITY_KEY = 'aiweb.clicker.city.v1';
  const LOC_KEY = 'aiweb.clicker.loc.v1';
  const INTRO_KEY = 'aiweb.clicker.intro.v1';

  const AUTOSAVE_MS = 5000;
  const OFFLINE_CAP_MS = 12 * 3600 * 1000;
  const CRIT_MULTI = 3;          // 暴击倍率
  const CRIT_CAP = 0.35;         // 暴击率上限
  const CLICK_LIMIT = 16;        // 每秒最多算这么多次点击（防连点器）
  const CHAIN_WINDOW = 1500;     // 连击窗口（毫秒）
  const RESO_MAX = 8;            // 星核共振最高层数
  const RESO_STEP = 0.07;        // 每层共振的全产出加成
  const RESO_DECAY_MS = 22000;   // 多久没共振成功掉一层
  const WX_TTL = 8 * 60 * 1000;  // 天气缓存有效期

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  // 每颗星球：gain 收益倍率；升级/资产/共振门槛/成就全部独立
  // kind: click 点击 / cps 每秒 / crit 暴击率 / mult 全部产出加成
  /* ===================== 1.5 星球数据 =====================
     六颗星球 × 9 个身份 × 10 项升级。每颗星球的「收益倍率」和
     「物价」一起翻倍，所以节奏一致，只换皮和绝对数字。
     ======================================================= */

  const RANK_SETS = [
    [
      { name: '拾尘者', icon: '🌫️' }, { name: '星尘学徒', icon: '🌱' }, { name: '街角名人', icon: '✨' },
      { name: '有车一族', icon: '🚗' }, { name: '有房一族', icon: '🏠' }, { name: '星际商人', icon: '💼' },
      { name: '星系名流', icon: '🌟' }, { name: '暮紫巨富', icon: '💎' }, { name: '星尘君王', icon: '👑' }
    ],
    [
      { name: '火花', icon: '🔥' }, { name: '熔炉工', icon: '⚒️' }, { name: '烈焰骑士', icon: '🐉' },
      { name: '火焰车神', icon: '🏎️' }, { name: '熔岩豪宅主', icon: '🏡' }, { name: '火山大亨', icon: '🌋' },
      { name: '烈焰之王', icon: '👑' }, { name: '不灭薪王', icon: '♨️' }, { name: '太阳领主', icon: '☀️' }
    ],
    [
      { name: '冰晶', icon: '❄️' }, { name: '雪原旅人', icon: '🧊' }, { name: '寒霜骑士', icon: '🗡️' },
      { name: '极光车手', icon: '🌌' }, { name: '冰宫主人', icon: '🏰' }, { name: '霜蓝女皇', icon: '👸' },
      { name: '永夜守望', icon: '🌑' }, { name: '极地星神', icon: '🧿' }, { name: '永冻之主', icon: '🪙' }
    ],
    [
      { name: '孢子', icon: '🍃' }, { name: '林间行者', icon: '🚶' }, { name: '藤蔓术士', icon: '🌿' },
      { name: '兽群之主', icon: '🐾' }, { name: '翡翠城主', icon: '🌳' }, { name: '生命贤者', icon: '🧙' },
      { name: '世界树使', icon: '🌍' }, { name: '森罗万象', icon: '🪷' }, { name: '丛林星神', icon: '🐲' }
    ]
  ];

  const UP_NAMES = [
    ['星尘手指', '采集无人机', '幸运符', '星核反应堆', '引力透镜', '共鸣棱镜', '反物质引擎', '星尘矩阵', '恒星熔炉', '奇点反应堆'],
    ['熔岩指尖', '火种无人机', '烈焰幸运符', '熔炉反应堆', '岩浆透镜', '火山共鸣', '等离子引擎', '烈焰矩阵', '恒星锻炉', '超新星核心'],
    ['冰锥指尖', '霜翼无人机', '极光幸运符', '冰核反应堆', '寒冰透镜', '极光共鸣', '零度引擎', '霜蓝矩阵', '寒潮熔炉', '绝对零度核心'],
    ['藤蔓指尖', '叶脉无人机', '生命幸运符', '生命树反应堆', '光合透镜', '翡翠共鸣', '年轮引擎', '翡翠矩阵', '世界树熔炉', '创世种子']
  ];

  // 金额随星球倍率一起涨，收入也一起涨，节奏完全一致
  const UP_TIERS = [
    { kind: 'click', amount: 1,      base: 10,      growth: 1.16, max: 600 },
    { kind: 'cps',   amount: 1,      base: 80,      growth: 1.17, max: 2500 },
    { kind: 'crit',  amount: 0.03,   base: 900,     growth: 3.00, max: 8 },
    { kind: 'cps',   amount: 12,     base: 4800,    growth: 1.18, max: 2500 },
    { kind: 'cps',   amount: 144,    base: 288000,  growth: 1.19, max: 2500 },
    { kind: 'mult',  amount: 0.15,   base: 8000,    growth: 1.42, max: 150 },
    { kind: 'cps',   amount: 1728,   base: 1.7e7,   growth: 1.20, max: 2500 },
    { kind: 'mult',  amount: 0.5,    base: 4e5,     growth: 1.48, max: 150 },
    { kind: 'cps',   amount: 20736,  base: 1e9,     growth: 1.21, max: 2500 },
    { kind: 'cps',   amount: 248832, base: 6e10,    growth: 1.22, max: 2500 }
  ];

  const ASSET_SETS = [
    [
      { name: '小汽车', icon: '🚗', rep: 10 }, { name: '跑车', icon: '🏎️', rep: 30 },
      { name: '公寓', icon: '🏢', rep: 60 }, { name: '豪华跑车', icon: '🚙', rep: 120 },
      { name: '别墅', icon: '🏡', rep: 400 }, { name: '星际豪宅', icon: '🛸', rep: 1500 },
      { name: '私人空间站', icon: '🛰️', rep: 4000 }
    ],
    [
      { name: '熔岩摩托', icon: '🏍️', rep: 10 }, { name: '火焰跑车', icon: '🏎️', rep: 30 },
      { name: '熔岩公寓', icon: '🏢', rep: 60 }, { name: '火山飞机', icon: '✈️', rep: 120 },
      { name: '岩浆别墅', icon: '🏡', rep: 400 }, { name: '火山宫殿', icon: '🏰', rep: 1500 },
      { name: '恒星级熔炉', icon: '🌋', rep: 4000 }
    ],
    [
      { name: '冰原雪橇', icon: '🛷', rep: 10 }, { name: '极光跑车', icon: '🚘', rep: 30 },
      { name: '冰晶公寓', icon: '🧊', rep: 60 }, { name: '霜翼飞机', icon: '🛩️', rep: 120 },
      { name: '冰宫', icon: '🏰', rep: 400 }, { name: '极光城堡', icon: '🌌', rep: 1500 },
      { name: '永冻方舟', icon: '🚢', rep: 4000 }
    ],
    [
      { name: '藤蔓滑板', icon: '🛹', rep: 10 }, { name: '森林飞车', icon: '🚙', rep: 30 },
      { name: '树屋公寓', icon: '🌳', rep: 60 }, { name: '翡翠飞船', icon: '🛸', rep: 120 },
      { name: '树冠圣殿', icon: '🏛️', rep: 400 }, { name: '世界树宫殿', icon: '🌍', rep: 1500 },
      { name: '生命方舟', icon: '🌱', rep: 4000 }
    ]
  ];

  const ASSET_BASE = [500, 5000, 20000, 60000, 250000, 1500000, 8000000];
  const REP_NEED = [0, 20, 90, 300, 900, 2400, 6000, 14000, 30000];
  const RESO_SETS = [
    [0, 0, 1, 1, 2, 2, 3, 4, 5],
    [0, 1, 1, 2, 2, 3, 4, 5, 6],
    [0, 1, 2, 2, 3, 4, 5, 6, 7],
    [0, 1, 2, 3, 3, 4, 5, 6, 8]
  ];
  // 舰队战力门槛：只有后三颗星球的后期身份需要
  const FLEET_NEED = [
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 50, 150, 400],
    [0, 0, 0, 0, 0, 300, 800, 1600, 3000],
    [0, 0, 0, 0, 0, 900, 2500, 6000, 12000],
    [0, 0, 0, 0, 0, 1600, 4200, 9000, 18000],
    [0, 0, 0, 0, 0, 2400, 6000, 13000, 26000]
  ];
  // 星章门槛：小游戏打出来的
  const BADGE_NEED = [
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 2, 3, 4],
    [0, 0, 0, 0, 0, 3, 5, 8, 12]
  ];

  /* ---- 第 5、6 颗星球：量子 / 虚空（数据由上面同构，玩法逐级加码） ---- */
  RANK_SETS.push(
    [
      { name: '量子沫', icon: '⚛️' }, { name: '观测者', icon: '🔭' }, { name: '纠缠行者', icon: '🌀' },
      { name: '超导骑士', icon: '⚡' }, { name: '虫洞领航', icon: '🕳️' }, { name: '量子富豪', icon: '💠' },
      { name: '时空织者', icon: '🧵' }, { name: '薛定谔之主', icon: '🐈' }, { name: '量子之神', icon: '🌌' }
    ],
    [
      { name: '虚无', icon: '🕳️' }, { name: '熵之信徒', icon: '🌫️' }, { name: '寂静行者', icon: '👤' },
      { name: '暗物质君王', icon: '🖤' }, { name: '黑洞领主', icon: '⚫' }, { name: '维度吞噬者', icon: '🐙' },
      { name: '终焉守望', icon: '🕯️' }, { name: '虚空主宰', icon: '👁️' }, { name: '万有归零', icon: '♾️' }
    ]
  );
  UP_NAMES.push(
    ['量子指尖', '概率无人机', '纠缠幸运符', '量子反应堆', '观测透镜', '退相干棱镜', '虫洞引擎', '叠加矩阵', '时空熔炉', '量子奇点'],
    ['虚空触须', '熵流无人机', '寂静幸运符', '虚无反应堆', '黑洞透镜', '终焉共鸣', '维度引擎', '虚空矩阵', '永恒熔炉', '归零核心']
  );
  ASSET_SETS.push(
    [
      { name: '量子滑板', icon: '🛹', rep: 10 }, { name: '纠缠机车', icon: '🏍️', rep: 30 },
      { name: '叠加公寓', icon: '🏢', rep: 60 }, { name: '概率飞机', icon: '✈️', rep: 120 },
      { name: '虫洞别墅', icon: '🏡', rep: 400 }, { name: '时空城堡', icon: '🏰', rep: 1500 },
      { name: '量子方舟', icon: '🚀', rep: 4000 }
    ],
    [
      { name: '虚空浮舟', icon: '🛶', rep: 10 }, { name: '熵流战车', icon: '🚙', rep: 30 },
      { name: '寂灭居所', icon: '⬛', rep: 60 }, { name: '维度穿梭机', icon: '🛸', rep: 120 },
      { name: '黑洞宫殿', icon: '🏯', rep: 400 }, { name: '终焉圣殿', icon: '⛩️', rep: 1500 },
      { name: '万有归零环', icon: '♾️', rep: 4000 }
    ]
  );
  RESO_SETS.push([0, 1, 2, 3, 3, 4, 5, 6, 7], [0, 1, 2, 3, 4, 4, 5, 6, 7]);
  BADGE_NEED.push([0, 0, 0, 0, 0, 4, 7, 10, 14], [0, 0, 0, 0, 0, 5, 9, 13, 18]);

  const WORLD_META = [
    { name: '暮紫星球', emoji: '🪐', gain: 1 },
    { name: '烈焰星球', emoji: '🔥', gain: 4 },
    { name: '霜蓝星球', emoji: '❄️', gain: 16 },
    { name: '翡翠星球', emoji: '🌿', gain: 64 },
    { name: '量子星球', emoji: '⚛️', gain: 256 },
    { name: '虚空星球', emoji: '🌑', gain: 1024 }
  ];

  // 第 i 个身份要的累计星尘：500 × 28^i × 星球倍率
  // 28 这个比例配合晋升的 ×1.6 点击倍率，一颗星球大约 11 小时（模拟值）
  const DUST_NEED = (i, gain) => Math.round(500 * Math.pow(28, i) * gain);

  function upDesc(t, gain) {
    if (t.kind === 'click') return '每次点击 +' + t.amount + '（本星球收益 ×' + gain + '）';
    if (t.kind === 'cps') return '每秒 +' + t.amount + ' 星尘（再乘本星球倍率）';
    if (t.kind === 'crit') return '暴击率 +' + Math.round(t.amount * 100) + '%（×3 收益）';
    return '全部产出 +' + Math.round(t.amount * 100) + '%';
  }

  // 成就模板：每颗星球一套，尽量覆盖各个玩法
  function makeAchs(wi, gain) {
    const base = [
      { id: 'start', name: '落脚', desc: wi === 0 ? '第一次点星球' : '跃迁到' + WORLD_META[wi].name,
        reward: 50 * Math.pow(10, wi), ok: () => state.world >= wi || state.wclicks > 0 }
    ];
    base.push(
      { id: 'chain', name: '手感渐热', desc: '达成 ' + (25 * (wi + 1)) + ' 连击',
        reward: 120 * Math.pow(10, wi), ok: () => state.comboBest >= 25 * (wi + 1) },
      { id: 'reso', name: '共振入门', desc: '把星核共振推到 ' + (3 + wi) + ' 层',
        reward: 300 * Math.pow(10, wi), ok: () => state.reso >= 3 + wi || state.resoBest >= 3 + wi },
      { id: 'mini', name: '会玩小游戏', desc: '小游戏累计胜利 3 次',
        reward: 500 * Math.pow(10, wi), ok: () => state.mini.wins >= 3 },
      { id: 'stock', name: '第一桶金', desc: '股票持仓市值达到 ' + fmt(1e5 * gain) + ' 星尘',
        reward: 800 * Math.pow(10, wi), ok: () => window.DDSystems && DDSystems.capital() >= 1e5 * gain },
      { id: 'fleet', name: '舰队出航', desc: '完成 3 次远征',
        reward: 1200 * Math.pow(10, wi), ok: () => state.fleet.done >= 3 },
      { id: 'done', name: '星球毕业', desc: '拿满本星球全部身份',
        reward: 5000 * Math.pow(10, wi), ok: () => state.worldDone }
    );
    return base;
  }

  const WORLDS = WORLD_META.map((meta, wi) => {
    const gain = meta.gain;
    const ranks = RANK_SETS[wi].map((r, i) => ({
      name: r.name,
      icon: r.icon,
      dust: DUST_NEED(i, gain),
      rep: REP_NEED[i],
      cap: i >= 5 && wi > 0 ? Math.round(DUST_NEED(i, gain) * 0.02) : 0,
      fleet: FLEET_NEED[wi][i],
      badge: BADGE_NEED[wi][i]
    }));
    const upgrades = UP_TIERS.map((t, k) => ({
      id: 'u' + k,
      name: UP_NAMES[wi][k],
      desc: upDesc(t, gain),
      base: Math.round(t.base * gain),
      growth: t.growth,
      max: t.max,
      kind: t.kind,
      amount: t.amount
    }));
    const assets = ASSET_SETS[wi].map((a, k) => ({
      id: 'a' + k,
      name: a.name,
      icon: a.icon,
      base: Math.round(ASSET_BASE[k] * gain),
      growth: 1.9,
      rep: a.rep
    }));
    return {
      name: meta.name,
      emoji: meta.emoji,
      gain: gain,
      gate: Math.round(DUST_NEED(8, gain) * 0.25),
      resoNeed: RESO_SETS[wi],
      ranks: ranks,
      upgrades: upgrades,
      assets: assets,
      achs: makeAchs(wi, gain)
    };
  });

  // 全局成就：跨星球只解锁一次
  const GLOBAL_ACHS = [
    { id: 'g_world2', name: '第二颗星球', desc: '跃迁到第二颗星球',              reward: 50000,   ok: () => state.world >= 1 },
    { id: 'g_rain',   name: '雨中漫步',   desc: '在雨天打开游戏',                reward: 300,     ok: () => /rain|drizzle|thunder|shower/.test(wx.kind) },
    { id: 'g_night',  name: '夜观星象',   desc: '在夜里打开游戏',                reward: 300,     ok: () => SceneKit.timeInfo().phase === 'night' },
    { id: 'g_c5000',  name: '手指发烫',   desc: '累计点击 5000 次',              reward: 2000,    ok: () => state.clicks >= 5000 },
    { id: 'g_combo',  name: '连锁狂人',   desc: '任意一次达成 100 连击',         reward: 10000,   ok: () => state.comboBest >= 100 },
    { id: 'g_reso',   name: '共振老手',   desc: '累计共振成功 50 次',            reward: 20000,   ok: () => state.resoHits >= 50 },
    { id: 'g_trade',  name: '职业股民',   desc: '股市累计成交 200 笔',           reward: 200000,  ok: () => state.stats && state.stats.trades >= 200 },
    { id: 'g_cap',    name: '资本玩家',   desc: '股票持仓市值达到 1 亿',         reward: 800000,  ok: () => window.DDSystems && DDSystems.capital() >= 1e8 },
    { id: 'g_exp',    name: '远征队',     desc: '完成 20 次舰队远征',            reward: 300000,  ok: () => state.fleet && state.fleet.done >= 20 },
    { id: 'g_badge',  name: '星章收藏家', desc: '拿到 10 枚星章',                reward: 500000,  ok: () => state.mini && state.mini.badges >= 10 },
    { id: 'g_mini',   name: '小游戏高手', desc: '小游戏累计胜利 30 次',          reward: 400000,  ok: () => state.mini && state.mini.wins >= 30 },
    { id: 'g_idle',   name: '挂机也是玩', desc: '离线挂机累计收入 1 亿',         reward: 200000,  ok: () => state.stats && state.stats.idleDust >= 1e8 },
    { id: 'g_clear',  name: '全剧终',     desc: '通关全部六颗星球',              reward: 50000000, ok: () => state.cleared },
  ];

  // 天气城市（手动选择；默认用网络 IP 自动定位）
  const CITIES = [
    { name: '北京', lat: 39.90, lon: 116.41 },
    { name: '上海', lat: 31.23, lon: 121.47 },
    { name: '广州', lat: 23.13, lon: 113.26 },
    { name: '深圳', lat: 22.54, lon: 114.06 },
    { name: '成都', lat: 30.57, lon: 104.07 },
    { name: '杭州', lat: 30.27, lon: 120.15 },
    { name: '武汉', lat: 30.59, lon: 114.30 },
    { name: '西安', lat: 34.34, lon: 108.94 },
    { name: '南京', lat: 32.06, lon: 118.80 },
    { name: '重庆', lat: 29.56, lon: 106.55 },
    { name: '天津', lat: 39.08, lon: 117.20 },
    { name: '长沙', lat: 28.23, lon: 112.94 },
    { name: '青岛', lat: 36.07, lon: 120.38 },
    { name: '沈阳', lat: 41.81, lon: 123.43 },
    { name: '哈尔滨', lat: 45.80, lon: 126.53 },
    { name: '郑州', lat: 34.75, lon: 113.62 },
    { name: '昆明', lat: 25.04, lon: 102.72 },
    { name: '乌鲁木齐', lat: 43.83, lon: 87.62 },
    { name: '拉萨', lat: 29.65, lon: 91.14 },
    { name: '香港', lat: 22.32, lon: 114.17 },
    { name: '台北', lat: 25.03, lon: 121.57 },
  ];

  /* ===================== 2. 状态 ===================== */

  const newState = () => ({
    dust: 0,          // 当前星尘
    total: 0,         // 本星球累计获得（身份看这个）
    clicks: 0,        // 总点击（跨星球）
    wclicks: 0,       // 本星球点击
    world: 0,
    levels: {},
    assets: {},
    rank: 0,
    worldDone: false,
    ach: {},
    guideSeen: false,
    cleared: false,
    startedAt: Date.now(),
    lastSave: Date.now(),
    comboBest: 0,
    reso: 0,          // 星核共振层数
    resoBest: 0,      // 本星球最高层数
    resoHits: 0,      // 累计共振成功次数
    resoMiss: 0,      // 累计失误
    resoLastAt: 0,    // 上次共振时间（衰减用）

    // ===== 跨星球保留的四大系统 =====
    mini: { energy: 8, energyAt: Date.now(), wins: 0, plays: 0, badges: 0, best: {} },
    stocks: { hold: {}, prices: {}, news: [], newsAt: 0, divAt: 0, profit: 0 },
    fleet: { ships: {}, exps: [null, null, null], done: 0 },
    idle: { core: 0, auto: 0, report: null },
    stats: { trades: 0, exps: 0, miniDust: 0, stockProfit: 0, idleDust: 0 }
  });

  let state = newState();

  const $ = (id) => document.getElementById(id);

  const el = {
    dust: $('dust'), cps: $('cps'), rep: $('rep'),
    rankIcon: $('rankIcon'), rankName: $('rankName'), rankNext: $('rankNext'),
    worldEmoji: $('worldEmoji'), worldName: $('worldName'),
    worldSub: $('worldSub'), worldPct: $('worldPct'),
    hint: $('hint'),
    stage: $('stage'), scene: $('scene'),
    wxChip: $('wxChip'), timeChip: $('timeChip'),
    floats: $('floatLayer'), stageNote: $('stageNote'),
    combo: $('combo'), comboNum: $('comboNum'), comboBonus: $('comboBonus'), comboFill: $('comboFill'),
    ambient: $('ambient'),
    shop: $('shop'), assets: $('assets'), ranks: $('ranks'),
    resoLayers: $('resoLayers'), resoNeedle: $('resoNeedle'), resoZone: $('resoZone'),
    resoBtn: $('resoBtn'), resoRoot: $('reso'), resoHint: $('resoHint'),
    worlds: $('worlds'), achs: $('achs'), gachs: $('gachs'), achCount: $('achCount'),
    travelBox: $('travelBox'), travel: $('travel'), travelTip: $('travelTip'),
    tip: $('saveTip'), reset: $('reset'), toast: $('toast'),
    guide: $('guide'), help: $('help'), intro: $('intro'),
    clear: $('clear'), clearEmoji: $('clearEmoji'), clearTitle: $('clearTitle'),
    clearSub: $('clearSub'), clearStats: $('clearStats'),
    confetti: $('confetti'), flash: $('flash'),
    previewModal: $('previewModal'), pvCanvas: $('previewScene'),
    pvName: $('pvName'), pvDesc: $('pvDesc'), pvFacts: $('pvFacts'),
    pvRanks: $('pvRanks'), pvGo: $('pvGo'), pvCancel: $('pvCancel'),
    wxModal: $('wxModal'), wxStatus: $('wxStatus'), wxNow: $('wxNow'),
    citySelect: $('citySelect'), wxAuto: $('wxAuto'), wxRefresh: $('wxRefresh'), wxOk: $('wxOk'),
  };

  /* ===================== 3. 计算 ===================== */

  const W = () => WORLDS[state.world];
  const isLastWorld = () => state.world >= WORLDS.length - 1;

  // 新系统都放在 systems.js 里，这里只取结果；没加载时当作 0
  const SYS = () => window.DDSystems;
  const sysMult = () => (SYS() && SYS().mult ? SYS().mult() : 1);
  const capital = () => (SYS() && SYS().capital ? SYS().capital() : 0);
  const fleetPower = () => (SYS() && SYS().fleetPower ? SYS().fleetPower() : 0);
  const badges = () => (state.mini ? state.mini.badges : 0);

  function rankReqOK(i) {
    const r = W().ranks[i];
    if (!r) return false;
    if (state.total < r.dust) return false;
    if (totalRep() < r.rep) return false;
    if (state.reso < ((W().resoNeed || [])[i] || 0)) return false;
    if (r.cap && capital() < r.cap) return false;
    if (r.fleet && fleetPower() < r.fleet) return false;
    if (r.badge && badges() < r.badge) return false;
    return true;
  }

  function sumUp(kind) {
    let s = 0;
    const list = W().upgrades;
    for (let i = 0; i < list.length; i++) {
      const u = list[i];
      if (u.kind === kind) s += (state.levels[u.id] || 0) * u.amount;
    }
    return s;
  }

  function totalLevels() {
    let s = 0;
    const list = W().upgrades;
    for (let i = 0; i < list.length; i++) s += state.levels[list[i].id] || 0;
    return s;
  }

  // 共振每层 +7% 的全产出：层数越高越爽，但会随时间衰减
  const resoMult = () => 1 + RESO_STEP * Math.min(state.reso, RESO_MAX);

  const clickPower = () =>
    (1 + sumUp('click')) * (1 + sumUp('mult')) * W().gain *
    Math.pow(1.6, state.rank) * resoMult() * sysMult();

  const cps = () =>
    sumUp('cps') * (1 + sumUp('mult')) * W().gain *
    (1 + state.rank * 0.35) * resoMult() * sysMult();

  const critChance = () => Math.min(CRIT_CAP, sumUp('crit'));

  function assetRep() {
    let s = 0;
    const list = W().assets;
    for (let i = 0; i < list.length; i++) {
      s += (state.assets[list[i].id] || 0) * list[i].rep;
    }
    return s;
  }

  const totalRep = () => assetRep();

  const costOf = (item, level) => Math.floor(item.base * Math.pow(item.growth, level));

  function fmt(n) {
    if (!isFinite(n)) return '∞';
    if (n >= 1e16) return (n / 1e16).toFixed(2) + '京';
    if (n >= 1e12) return (n / 1e12).toFixed(2) + '万亿';
    if (n >= 1e8) return (n / 1e8).toFixed(2) + '亿';
    if (n >= 1e4) return (n / 1e4).toFixed(2) + '万';
    if (n >= 100) return String(Math.floor(n));
    return (Math.round(n * 10) / 10).toString().replace(/\.0$/, '');
  }

  function fmtDuration(ms) {
    const m = Math.floor(ms / 60000);
    if (m < 60) return m + ' 分钟';
    return (m / 60).toFixed(1) + ' 小时';
  }

  function toast(msg, ms = 2400) {
    el.toast.textContent = msg;
    el.toast.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.toast.classList.remove('show'), ms);
  }

  /* ===================== 4. 存档 ===================== */

  let saveBroken = false;
  let tipTimer = 0;

  function flashTip(msg, ms = 1400) {
    el.tip.textContent = msg;
    clearTimeout(tipTimer);
    tipTimer = setTimeout(() => { el.tip.textContent = '进度自动保存'; }, ms);
  }

  function save(silent = true) {
    if (saveBroken) return;
    state.lastSave = Date.now();
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(state));
      if (!silent) flashTip('已保存');
    } catch (e) {
      saveBroken = true;
      flashTip('这个浏览器不让存档');
    }
  }

  const num = (v) => Number(v) || 0;

  // 存档里的身份是「已经拿到」的下限；补齐只会往上补，不会因为共振掉了而倒退
  function recountRank(floor) {
    const ranks = W().ranks;
    let r = 0;
    while (r < ranks.length && rankReqOK(r)) r += 1;
    state.rank = clamp(Math.max(r, floor || 0), 0, ranks.length);
    state.worldDone = state.rank >= ranks.length;
  }

  function load() {
    try {
      let raw = localStorage.getItem(SAVE_KEY);
      if (!raw) {
        // 从 v4 存档迁移：数值会按新经济重算，升级/资产只保留本星球仍存在的项目
        raw = localStorage.getItem('aiweb.clicker.v1');
        if (raw) flashTip('已迁移旧存档', 3000);
      }
      if (!raw) return;
      const d = JSON.parse(raw) || {};
      const base = newState();

      state = Object.assign(base, {
        dust: num(d.dust),
        total: num(d.total),
        clicks: num(d.clicks),
        wclicks: num(d.wclicks) || num(d.clicks),
        world: clamp(num(d.world), 0, WORLDS.length - 1),
        rank: 0,
        worldDone: false,
        reso: clamp(num(d.reso), 0, RESO_MAX),
        ach: Object.assign({}, d.ach || {}),
        guideSeen: !!d.guideSeen,
        cleared: !!d.cleared,
        startedAt: num(d.startedAt) || Date.now(),
        lastSave: num(d.lastSave) || Date.now(),
        comboBest: num(d.comboBest),
        resoBest: clamp(num(d.resoBest), 0, RESO_MAX),
        resoHits: num(d.resoHits),
        resoMiss: num(d.resoMiss),
        resoLastAt: num(d.resoLastAt) || Date.now(),
      });

      // 新系统：整块合并，旧存档缺字段就用默认值
      state.mini = Object.assign(base.mini, d.mini || {});
      state.mini.best = Object.assign({}, (d.mini && d.mini.best) || {});
      state.stocks = Object.assign(base.stocks, d.stocks || {});
      state.stocks.hold = Object.assign({}, (d.stocks && d.stocks.hold) || {});
      state.stocks.prices = Object.assign({}, (d.stocks && d.stocks.prices) || {});
      state.stocks.news = Array.isArray(d.stocks && d.stocks.news) ? d.stocks.news : [];
      state.fleet = Object.assign(base.fleet, d.fleet || {});
      state.fleet.ships = Object.assign({}, (d.fleet && d.fleet.ships) || {});
      state.fleet.exps = Array.isArray(d.fleet && d.fleet.exps) ? d.fleet.exps : [null, null, null];
      while (state.fleet.exps.length < 3) state.fleet.exps.push(null);
      state.idle = Object.assign(base.idle, d.idle || {});
      state.stats = Object.assign(base.stats, d.stats || {});

      // 只保留本星球仍然存在的升级/资产 id
      state.levels = {};
      W().upgrades.forEach((u) => { if (d.levels && d.levels[u.id]) state.levels[u.id] = num(d.levels[u.id]); });
      state.assets = {};
      W().assets.forEach((a) => { if (d.assets && d.assets[a.id]) state.assets[a.id] = num(d.assets[a.id]); });

      recountRank(clamp(num(d.rank), 0, W().ranks.length));

      // 离线收益
      const away = Date.now() - state.lastSave;
      if (away > RESO_DECAY_MS) { state.reso = 0; state.resoLastAt = Date.now(); }
      // 挂机效率：基础 55%，自动采集核心每级 +2.5%，最高 100%
      const idleRate = Math.min(1, 0.55 + state.idle.core * 0.025);
      const gain = cps() * Math.min(away, OFFLINE_CAP_MS) / 1000 * idleRate;
      if (away > 60000 && gain >= 1) {
        state.dust += gain;
        state.total += gain;
        state.stats.idleDust += gain;
        state.idle.report = { away: away, gain: gain, rate: idleRate };
        flashTip('离线 ' + fmtDuration(away) + '，收入 +' + fmt(gain), 4000);
      }
    } catch (e) {
      state = newState(); // 存档坏了就当新档
    }
  }

  /* ===================== 5. 天气 / 时间 ===================== */

  let wx = { kind: 'clear', temp: null, code: null, source: 'sim', place: '模拟天气', ts: 0 };
  let cityPref = 'auto';
  let lastLoc = null;
  let wxLoading = false;
  let pvScene = null;
  let pvIndex = -1;

  try { cityPref = localStorage.getItem(CITY_KEY) || 'auto'; } catch (e) {}
  try { lastLoc = JSON.parse(localStorage.getItem(LOC_KEY) || 'null'); } catch (e) {}

  function fetchJSON(url, ms) {
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), ms || 8000) : null;
    return fetch(url, ctrl ? { signal: ctrl.signal, cache: 'no-store' } : { cache: 'no-store' })
      .then((r) => {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .finally(() => { if (timer) clearTimeout(timer); });
  }

  // 没网时的模拟天气：按“日期+小时”生成，稳定但会随时间变
  function simWx() {
    const now = new Date();
    const month = now.getMonth() + 1;
    let seed = (now.getFullYear() * 100000 + month * 1000 + now.getDate() * 31 + now.getHours()) % 2147483647;
    if (seed <= 0) seed += 2147483646;
    const r = () => (seed = seed * 16807 % 2147483647) / 2147483647;
    const pool = ['clear', 'clear', 'partly', 'partly', 'cloudy', 'overcast', 'drizzle', 'rain', 'fog', 'snow', 'thunder', 'shower'];
    const cold = month <= 2 || month >= 11;
    let kind = pool[Math.floor(r() * pool.length)];
    if (kind === 'snow' && !cold) kind = 'rain';
    if (kind === 'thunder' && cold) kind = 'snow';
    const base = cold ? 2 : (month >= 6 && month <= 8 ? 27 : 17);
    return { kind, temp: Math.round(base + (r() * 8 - 4)), code: null };
  }

  function applyWx(data, source, place) {
    wx = { kind: data.kind, temp: data.temp, code: data.code, source, place, ts: Date.now() };
    if (scene) scene.setWeather(wx);
    if (pvScene) pvScene.setWeather(wx);
    el.wxChip.textContent = SceneKit.iconOf(wx.kind) + ' ' + SceneKit.labelOf(wx.kind) +
      (wx.temp != null ? ' ' + wx.temp + '°' : '');
    refreshWxPanel();
    checkAchs();
  }

  function setWxStatus(text) {
    el.wxStatus.textContent = text;
  }

  function refreshWxPanel() {
    const ti = SceneKit.timeInfo();
    el.wxNow.innerHTML =
      '<div class="wx-cell"><b>' + SceneKit.iconOf(wx.kind) + ' ' + SceneKit.labelOf(wx.kind) + '</b>' +
        '<span>' + (wx.temp != null ? wx.temp + '°C' : '--') + '</span></div>' +
      '<div class="wx-cell"><b>' + ti.phaseIcon + ' ' + ti.phaseName + ' ' + ti.clock + '</b>' +
        '<span>' + (wx.place || '') + (wx.source === 'sim' ? ' · 模拟' : ' · 实时') + '</span></div>';
  }

  function writeWxCache() {
    try {
      localStorage.setItem(WX_KEY, JSON.stringify({
        ts: Date.now(), kind: wx.kind, temp: wx.temp, code: wx.code,
        source: wx.source, place: wx.place,
      }));
    } catch (e) {}
  }

  function readWxCache() {
    try {
      const c = JSON.parse(localStorage.getItem(WX_KEY) || 'null');
      if (!c || !c.kind) return null;
      if (Date.now() - c.ts > WX_TTL) return null;
      return c;
    } catch (e) { return null; }
  }

  async function resolveLoc() {
    if (cityPref && cityPref !== 'auto') {
      const c = CITIES.find((x) => x.name === cityPref);
      if (c) return { lat: c.lat, lon: c.lon, name: c.name };
    }
    if (lastLoc && Date.now() - (lastLoc.ts || 0) < 12 * 3600 * 1000) return lastLoc;
    try {
      const j = await fetchJSON('https://ipapi.co/json/', 7000);
      if (j && typeof j.latitude === 'number' && typeof j.longitude === 'number') {
        lastLoc = {
          lat: j.latitude, lon: j.longitude,
          name: j.city || j.region || j.country_name || '自动定位',
          ts: Date.now(),
        };
        try { localStorage.setItem(LOC_KEY, JSON.stringify(lastLoc)); } catch (e) {}
        return lastLoc;
      }
    } catch (e) {}
    return { lat: 39.9042, lon: 116.4074, name: '北京' };
  }

  async function loadWeather(manual) {
    if (wxLoading) return;
    wxLoading = true;
    setWxStatus('正在获取实时天气…');
    try {
      const loc = await resolveLoc();
      const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + loc.lat.toFixed(3) +
        '&longitude=' + loc.lon.toFixed(3) +
        '&current=temperature_2m,weather_code,is_day&timezone=auto';
      const j = await fetchJSON(url, 9000);
      const cur = j && j.current;
      if (!cur || typeof cur.weather_code !== 'number') throw new Error('天气数据不完整');

      applyWx(
        { kind: SceneKit.kindFromCode(cur.weather_code), temp: Math.round(cur.temperature_2m), code: cur.weather_code },
        'live', loc.name
      );
      writeWxCache();
      setWxStatus('实时天气 · ' + loc.name + ' · ' + SceneKit.timeInfo().clock + ' 更新');
    } catch (e) {
      if (wx.source !== 'live') {
        applyWx(simWx(), 'sim', '模拟天气');
        writeWxCache();
      }
      setWxStatus('拿不到实时天气（可能没网），现在用模拟天气。点「刷新」重试。');
    } finally {
      wxLoading = false;
    }
  }

  function buildCitySelect() {
    el.citySelect.innerHTML = '';
    el.citySelect.appendChild(new Option('自动定位（按网络 IP）', 'auto'));
    CITIES.forEach((c) => el.citySelect.appendChild(new Option(c.name, c.name)));
    el.citySelect.value = cityPref || 'auto';
  }

  /* ===================== 6. 场景与点击（含连锁） ===================== */

  const scene = new PlanetScene(el.scene, { world: state.world, weather: wx });
  scene.start();

  let pendingGain = 0;
  let lastNote = '';

  scene.onCollect = (x, y) => {
    if (pendingGain >= 1) {
      spawnFloatAt('+' + fmt(pendingGain), false, x, y, 'ship');
      pendingGain = 0;
    }
  };

  function stagePoint(clientX, clientY) {
    const rect = el.stage.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  function spawnFloatAt(text, crit, x, y, kind) {
    const span = document.createElement('span');
    span.className = 'float' + (crit ? ' crit' : '') + (kind ? ' ' + kind : '');
    span.textContent = text;
    const w = el.stage.clientWidth || 320;
    span.style.left = Math.max(26, Math.min(w - 26, x)) + 'px';
    span.style.top = Math.max(16, y) + 'px';
    el.floats.appendChild(span);
    while (el.floats.children.length > 26) el.floats.removeChild(el.floats.firstChild);
    span.addEventListener('animationend', () => span.remove());
  }

  /* ---- 星尘连锁：1.5 秒内连点累积，5 连 +10%，每 10 连爆发一次 ---- */
  let combo = 0;
  let comboAt = 0;

  const chainBonus = () => Math.min(0.6, Math.floor(combo / 5) * 0.06);

  function renderCombo() {
    const on = combo >= 2;
    el.combo.classList.toggle('hidden', !on);
    if (!on) return;
    const pct = Math.round(chainBonus() * 100);
    el.comboNum.textContent = combo;
    el.comboBonus.textContent = '+' + pct + '%';
    el.comboFill.style.width = pct + '%';
    el.combo.classList.toggle('hot', combo >= 30);
    el.combo.classList.toggle('blazing', combo >= 60);
  }

  function comboStep() {
    const now = performance.now();
    combo = (now - comboAt <= CHAIN_WINDOW) ? Math.min(combo + 1, 999) : 1;
    comboAt = now;
    if (combo > state.comboBest) state.comboBest = combo;
    renderCombo();
  }

  function comboBreak() {
    if (combo === 0) return;
    combo = 0;
    renderCombo();
  }

  /* ---- 点击星球 ---- */
  const clickStamps = [];
  let blockedAt = 0;

  function clickPlanet(x, y) {
    const now = performance.now();
    while (clickStamps.length && now - clickStamps[0] > 1000) clickStamps.shift();

    if (clickStamps.length >= CLICK_LIMIT) {
      if (now - blockedAt > 2500) {
        blockedAt = now;
        toast('⛔ 手速太快，星尘暂停增长', 1800);
        el.stage.classList.add('blocked');
        setTimeout(() => el.stage.classList.remove('blocked'), 700);
      }
      return;
    }
    clickStamps.push(now);

    comboStep();

    let gain = clickPower() * (1 + chainBonus());
    let crit = false;
    if (Math.random() < critChance()) {
      gain *= CRIT_MULTI;
      crit = true;
    }

    state.clicks += 1;
    state.wclicks += 1;
    state.dust += gain;
    state.total += gain;

    scene.burst(x, y, crit);
    spawnFloatAt((crit ? '暴击 +' : '+') + fmt(gain), crit, x, y);

    // 每 10 连：星尘爆发
    if (combo >= 10 && combo % 10 === 0) {
      const burst = clickPower() * (1 + chainBonus()) * Math.min(combo, 50) * 0.12;
      state.dust += burst;
      state.total += burst;
      spawnFloatAt('💥 连锁爆发 +' + fmt(burst), true, x, y - 34, 'burst');
      scene.kickIt();
      spawnConfetti(16);
      el.combo.classList.remove('burst');
      void el.combo.offsetWidth;
      el.combo.classList.add('burst');
      if (combo % 50 === 0) toast('⚡ ' + combo + ' 连击！星尘爆发 +' + fmt(burst), 2200);
    }

    checkRanks();
    checkAchs();
    render();
  }

  el.stage.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.chip')) return;
    e.preventDefault();
    const p = stagePoint(e.clientX, e.clientY);
    clickPlanet(p.x, p.y);
  });

  /* 标签页 */
  const tabs = Array.from(document.querySelectorAll('.tab'));
  const panels = {
    up: $('panel-up'),
    asset: $('panel-asset'),
    rank: $('panel-rank'),
    stock: $('panel-stock'),
    fleet: $('panel-fleet'),
    play: $('panel-play'),
  };

  function switchTab(name) {
    tabs.forEach((x) => x.classList.toggle('active', x.dataset.tab === name));
    Object.keys(panels).forEach((k) => {
      if (panels[k]) panels[k].classList.toggle('active', k === name);
    });
  }

  tabs.forEach((t) => {
    t.addEventListener('click', () => switchTab(t.dataset.tab));
  });

  /* ===================== 7. 列表 / 图鉴 / 预览 ===================== */

  let upRows = [];
  let assetRows = [];
  let rankRows = [];
  let achRows = [];
  let gachRows = [];

  function buildUpgrades() {
    el.shop.innerHTML = '';
    upRows = W().upgrades.map((u) => {
      const li = document.createElement('li');
      li.className = 'item';
      li.innerHTML =
        '<div class="item-main">' +
          '<div class="item-name">' + u.name + '</div>' +
          '<div class="item-desc">' + u.desc + '</div>' +
        '</div>' +
        '<div class="item-side">' +
          '<div class="item-lv">Lv.0</div>' +
          '<button type="button" class="buy">0</button>' +
        '</div>';

      const btn = li.querySelector('.buy');
      btn.addEventListener('click', () => buyUpgrade(u));
      el.shop.appendChild(li);
      return { u, btn, lv: li.querySelector('.item-lv') };
    });
  }

  function buildAssets() {
    el.assets.innerHTML = '';
    assetRows = W().assets.map((a) => {
      const li = document.createElement('li');
      li.className = 'item';
      li.innerHTML =
        '<div class="item-main">' +
          '<div class="item-name">' + a.icon + ' ' + a.name + '</div>' +
          '<div class="item-desc">每件 +' + a.rep + ' 声望</div>' +
        '</div>' +
        '<div class="item-side">' +
          '<div class="item-lv">拥有 0</div>' +
          '<button type="button" class="buy rep-buy">0</button>' +
        '</div>';

      const btn = li.querySelector('.buy');
      btn.addEventListener('click', () => buyAsset(a));
      el.assets.appendChild(li);
      return { a, btn, lv: li.querySelector('.item-lv') };
    });
  }

  function buildRanks() {
    el.ranks.innerHTML = '';
    rankRows = W().ranks.map((r, i) => {
      const li = document.createElement('li');
      li.className = 'rank-item';
      li.innerHTML =
        '<span class="rank-emoji">' + r.icon + '</span>' +
        '<div class="item-main">' +
          '<div class="rank-name">' + r.name + '</div>' +
          '<div class="rank-req">累计星尘 ' + fmt(r.dust) + ' · 声望 ' + fmt(r.rep) +
            ((W().resoNeed && W().resoNeed[i]) ? ' · 共振 ' + W().resoNeed[i] + ' 层' : '') +
            (r.cap ? ' · 市值 ' + fmt(r.cap) : '') +
            (r.fleet ? ' · 舰队 ' + fmt(r.fleet) : '') +
            (r.badge ? ' · 星章 ' + r.badge : '') + '</div>' +
        '</div>' +
        '<span class="rank-badge">未达成</span>';

      el.ranks.appendChild(li);
      return { li, badge: li.querySelector('.rank-badge') };
    });
  }

  function achKey(a) { return state.world + ':' + a.id; }

  function achItem(a, done) {
    const li = document.createElement('li');
    li.className = 'ach-item' + (done ? ' done' : '');
    li.innerHTML =
      '<span class="ach-dot">🏅</span>' +
      '<div class="item-main">' +
        '<div class="item-name">' + a.name + '</div>' +
        '<div class="item-desc">' + a.desc + ' · 奖励 ' + fmt(a.reward) + '</div>' +
      '</div>';
    return li;
  }

  function buildAchs() {
    el.achs.innerHTML = '';
    achRows = W().achs.map((a) => {
      const li = achItem(a, !!state.ach[achKey(a)]);
      el.achs.appendChild(li);
      return { a, li };
    });

    el.gachs.innerHTML = '';
    gachRows = GLOBAL_ACHS.map((a) => {
      const li = achItem(a, !!state.ach[a.id]);
      el.gachs.appendChild(li);
      return { a, li };
    });
    updateAchCount();
  }

  function updateAchCount() {
    const done = W().achs.filter((a) => state.ach[achKey(a)]).length;
    el.achCount.textContent = done + '/' + W().achs.length;
  }

  function worldStatus(i) {
    if (i === state.world) return state.worldDone ? '身份全满' : '当前星球';
    if (i < state.world) return '已点亮';
    if (i === state.world + 1) return state.worldDone ? '可以跃迁' : '下一站';
    return '未解锁';
  }

  function buildWorldCards() {
    el.worlds.innerHTML = '';
    WORLDS.forEach((w, i) => {
      const li = document.createElement('li');
      li.className = 'world-card' + (i === state.world ? ' on' : '');
      li.innerHTML =
        '<span class="mini-planet" data-w="' + i + '"></span>' +
        '<span class="wc-info">' +
          '<b>' + w.name + '</b>' +
          '<em>收益 ×' + w.gain + ' · ' + w.upgrades.length + ' 项升级 · ' + w.achs.length + ' 成就</em>' +
        '</span>' +
        '<span class="wc-badge">' + worldStatus(i) + '</span>';
      li.addEventListener('click', () => openPreview(i));
      el.worlds.appendChild(li);
    });
  }

  function closePreview() {
    el.previewModal.classList.add('hidden');
    if (pvScene) { pvScene.stop(); pvScene = null; }
    pvIndex = -1;
  }

  function openPreview(i) {
    pvIndex = i;
    const w = WORLDS[i];

    el.pvName.textContent = w.emoji + ' ' + w.name;
    el.pvDesc.textContent = i === state.world
      ? '这里就是你现在的家。'
      : (i < state.world ? '已经点亮过的星球，可以回头看看它现在的天气。'
                         : '跃迁到这里后，本星球的星尘、升级、资产、共振层数都会清零，从这颗星球重新发育。');

    el.pvFacts.innerHTML =
      '<div><b>×' + w.gain + '</b>收益倍率</div>' +
      '<div><b>' + w.upgrades.length + '</b>项升级</div>' +
      '<div><b>' + w.achs.length + '</b>个成就</div>' +
      '<div><b>' + (w.gate ? fmt(w.gate) : '0') + '</b>跃迁门槛</div>';

    el.pvRanks.innerHTML = w.ranks.map((r) =>
      '<li><span>' + r.icon + ' ' + r.name + '</span><em>星尘 ' + fmt(r.dust) + ' · 声望 ' + fmt(r.rep) + '</em></li>'
    ).join('');

    el.previewModal.classList.remove('hidden');

    if (pvScene) { pvScene.stop(); pvScene = null; }
    pvScene = new PlanetScene(el.pvCanvas, { world: i, preview: true, weather: wx });
    requestAnimationFrame(() => {
      if (!pvScene) return;
      pvScene.resize();
      pvScene.start();
    });

    updatePreviewGo();
  }

  function updatePreviewGo() {
    if (pvIndex < 0) return;
    const next = WORLDS[state.world + 1];
    const isCur = pvIndex === state.world;
    const isNext = pvIndex === state.world + 1;

    if (isCur) {
      el.pvGo.disabled = true;
      el.pvGo.textContent = '你就在这里';
    } else if (!isNext) {
      el.pvGo.disabled = true;
      el.pvGo.textContent = pvIndex < state.world ? '已点亮' : '还不能去';
    } else if (!state.worldDone) {
      el.pvGo.disabled = true;
      el.pvGo.textContent = '🔒 先把本星球身份拿满';
    } else if (state.dust < W().gate) {
      el.pvGo.disabled = true;
      el.pvGo.textContent = '🔒 还需要 ' + fmt(W().gate - state.dust) + ' 星尘';
    } else {
      el.pvGo.disabled = false;
      el.pvGo.textContent = '🚀 跃迁到「' + next.name + '」';
    }
  }

  /* ===================== 8. 购买 / 身份 / 跃迁 ===================== */

  function buyUpgrade(u) {
    const level = state.levels[u.id] || 0;
    if (level >= u.max) return;
    const cost = costOf(u, level);
    if (state.dust < cost) return;

    state.dust -= cost;
    state.levels[u.id] = level + 1;
    scene.kickIt();
    checkAchs();
    render();
    save();
  }

  function buyAsset(a) {
    const level = state.assets[a.id] || 0;
    const cost = costOf(a, level);
    if (state.dust < cost) return;

    state.dust -= cost;
    state.assets[a.id] = level + 1;

    checkRanks();
    checkAchs();
    render();
    save();
  }

  // 晋升：星尘翻倍 + 点击力 ×2 + 自动产出 +50%
  function checkRanks() {
    const ranks = W().ranks;
    let promoted = null;

    while (state.rank < ranks.length) {
      const r = ranks[state.rank];
      if (rankReqOK(state.rank)) {
        state.rank += 1;
        state.dust *= 2;
        promoted = r;
      } else {
        break;
      }
    }

    if (!promoted) return;

    save();
    scene.kickIt();
    spawnConfetti(36);
    toast('🎖 晋升「' + promoted.name + '」· 星尘翻倍，点击力 ×1.6', 2600);

    if (state.rank >= ranks.length && !state.worldDone) {
      state.worldDone = true;
      buildWorldCards();
      onWorldDone();
    }
  }

  function onWorldDone() {
    checkAchs();
    if (isLastWorld()) {
      state.cleared = true;
      save();
      setTimeout(showClear, 800);
    } else {
      save();
      spawnConfetti(60);
      toast('🏁 「' + W().name + '」身份全满！攒够 ' + fmt(W().gate) + ' 星尘就能跃迁', 4200);
    }
  }

  // 跃迁：清空本星球，换一套数值，去更容易赚钱的下一颗
  function travel() {
    const next = WORLDS[state.world + 1];
    if (!next || !state.worldDone || state.dust < W().gate) return false;
    state.world += 1;
    state.dust = 0;
    state.total = 0;
    state.wclicks = 0;
    state.levels = {};
    state.assets = {};
    state.rank = 0;
    state.worldDone = false;
    state.comboBest = 0;
    state.reso = 0;
    state.resoBest = 0;
    state.resoLastAt = Date.now();
    clickStamps.length = 0;
    pendingGain = 0;
    comboBreak();

    applyWorld();
    scene.setWorld(state.world);
    buildUpgrades();
    buildAssets();
    buildRanks();
    buildAchs();
    buildWorldCards();
    save();
    render();
    doFlash();
    checkAchs();

    toast('🚀 抵达「' + next.name + '」· 收益 ×' + next.gain + '，' + next.upgrades.length + ' 项升级', 3600);
    return true;
  }

  function applyWorld() {
    document.body.dataset.world = String(state.world);
  }

  function doFlash() {
    el.flash.classList.remove('on');
    void el.flash.offsetWidth;
    el.flash.classList.add('on');
  }

  let confettiTimer = 0;
  function spawnConfetti(count) {
    el.confetti.innerHTML = '';
    const colors = ['#d8b25a', '#7e9cb0', '#8fa9a3', '#b5654f', '#a8b87b'];
    const n = count || 60;
    for (let i = 0; i < n; i++) {
      const p = document.createElement('i');
      p.style.left = (Math.random() * 100) + '%';
      p.style.background = colors[i % colors.length];
      p.style.animationDuration = (1.6 + Math.random() * 1.8) + 's';
      p.style.animationDelay = (Math.random() * 0.9) + 's';
      el.confetti.appendChild(p);
    }
    clearTimeout(confettiTimer);
    confettiTimer = setTimeout(() => { el.confetti.innerHTML = ''; }, 4200);
  }

  function showClear() {
    el.clearEmoji.textContent = '🏆';
    el.clearTitle.textContent = '恭喜通关全部星球！';
    el.clearSub.textContent = '从一粒尘埃到宇宙之王，六颗星球都被你点亮了。';

    const mins = Math.max(1, Math.floor((Date.now() - state.startedAt) / 60000));
    el.clearStats.innerHTML =
      '<div><b>' + WORLDS.length + '</b>星球</div>' +
      '<div><b>' + fmt(state.clicks) + '</b>总点击</div>' +
      '<div><b>' + fmt(state.stats.trades) + '</b>交易</div>' +
      '<div><b>' + mins + ' 分钟</b>用时</div>';

    spawnConfetti(90);
    el.clear.classList.remove('hidden');
  }

  /* ===================== 9. 星核共振 ===================== */

  // 按住蓄力：指示条在 0~1 之间来回跑，松手时落在绿区就算成功
  const reso = { charging: false, p: 0, dir: 1, zoneAt: 0.5, zoneW: 0.26, last: 0, coolUntil: 0, raf: 0 };

  const resoZoneWidth = () => Math.max(0.11, 0.30 - state.reso * 0.018);
  const resoNeedFor = (rank) => (W().resoNeed && W().resoNeed[rank]) || 0;

  function resoDraw() {
    if (el.resoNeedle) el.resoNeedle.style.left = (reso.p * 100).toFixed(2) + '%';
  }

  function resoLoop(ts) {
    if (!reso.charging) return;
    const dt = reso.last ? Math.min(80, ts - reso.last) : 16;
    reso.last = ts;
    reso.p += (dt / 1100) * reso.dir;
    if (reso.p >= 1) { reso.p = 1; reso.dir = -1; }
    if (reso.p <= 0) { reso.p = 0; reso.dir = 1; }
    resoDraw();
    reso.raf = requestAnimationFrame(resoLoop);
  }

  function resoStart() {
    if (reso.charging || Date.now() < reso.coolUntil) return;
    reso.charging = true;
    reso.p = 0;
    reso.dir = 1;
    reso.last = 0;
    reso.zoneW = resoZoneWidth();
    reso.zoneAt = 0.2 + reso.zoneW / 2 + Math.random() * (0.6 - reso.zoneW);
    el.resoZone.style.left = ((reso.zoneAt - reso.zoneW / 2) * 100).toFixed(2) + '%';
    el.resoZone.style.width = (reso.zoneW * 100).toFixed(2) + '%';
    el.resoRoot.classList.add('on');
    el.resoBtn.textContent = '松手锁定';
    resoDraw();
    reso.raf = requestAnimationFrame(resoLoop);
  }

  function resoLock() {
    if (!reso.charging) return;
    reso.charging = false;
    cancelAnimationFrame(reso.raf);
    el.resoRoot.classList.remove('on');
    el.resoBtn.textContent = '按住蓄力，进绿区松手';

    const hit = Math.abs(reso.p - reso.zoneAt) <= reso.zoneW / 2;
    if (hit) {
      state.reso = Math.min(RESO_MAX, state.reso + 1);
      state.resoBest = Math.max(state.resoBest, state.reso);
      state.resoHits += 1;
      state.resoLastAt = Date.now();
      const burst = clickPower() * (10 + state.reso * 5);
      state.dust += burst;
      state.total += burst;
      spawnFloatAt('⚡ 共振 +' + fmt(burst), true,
        (el.stage.clientWidth || 320) / 2, (el.stage.clientHeight || 320) * 0.4, 'reso');
      scene.kickIt();
      spawnConfetti(10);
      toast('⚡ 共振成功 · ' + state.reso + ' 层，全产出 +' + Math.round((resoMult() - 1) * 100) + '%', 2200);
      checkRanks();
      checkAchs();
    } else {
      state.resoMiss += 1;
      state.reso = Math.max(0, state.reso - 1);
      state.resoLastAt = Date.now();
      reso.coolUntil = Date.now() + 2200;
      toast('💨 节奏歪了，共振掉到 ' + state.reso + ' 层', 1800);
    }
    render();
    save();
  }

  function resoTick() {
    if (state.reso <= 0) return;
    if (Date.now() - (state.resoLastAt || 0) < RESO_DECAY_MS) return;
    state.reso -= 1;
    state.resoLastAt = Date.now();
    toast('🌫 星核冷却，共振降到 ' + state.reso + ' 层', 1600);
    render();
  }

  function renderReso() {
    if (!el.resoLayers) return;
    const need = resoNeedFor(state.rank);
    el.resoLayers.textContent = '共振 ' + state.reso + '/' + RESO_MAX + ' 层 · 全产出 +' +
      Math.round((resoMult() - 1) * 100) + '%';
    el.resoLayers.classList.toggle('need', state.reso < need);
    const cd = Math.max(0, reso.coolUntil - Date.now());
    if (reso.charging) {
      el.resoBtn.textContent = '松手锁定';
    } else if (cd > 0) {
      el.resoBtn.textContent = '冷却 ' + Math.ceil(cd / 1000) + 's';
    } else {
      el.resoBtn.textContent = '按住蓄力，进绿区松手';
    }
    el.resoBtn.disabled = cd > 0;
    if (el.resoHint) {
      el.resoHint.textContent = need > 0
        ? '下一个身份要共振 ' + need + ' 层'
        : '先把层数堆起来';
    }
  }

  if (el.resoBtn) {
    el.resoBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); resoStart(); });
    window.addEventListener('pointerup', () => { if (reso.charging) resoLock(); });
    window.addEventListener('pointercancel', () => { if (reso.charging) resoLock(); });
  }

  /* ===================== 10. 成就 ===================== */

  function checkAchs() {
    let last = null;

    for (const a of W().achs) {
      const key = achKey(a);
      if (!state.ach[key] && a.ok()) {
        state.ach[key] = true;
        state.dust += a.reward;
        state.total += a.reward;
        last = a;
      }
    }

    for (const a of GLOBAL_ACHS) {
      if (!state.ach[a.id] && a.ok()) {
        state.ach[a.id] = true;
        state.dust += a.reward;
        state.total += a.reward;
        last = a;
      }
    }

    if (last) {
      toast('🏅 解锁成就「' + last.name + '」+' + fmt(last.reward) + ' 星尘', 2600);
      updateAchCount();
      save();
      checkRanks();
    }
  }

  /* ===================== 11. 渲染 ===================== */

  function renderClock() {
    const ti = SceneKit.timeInfo();
    el.timeChip.textContent = ti.phaseIcon + ' ' + ti.phaseName + ' ' + ti.clock;
    document.body.dataset.phase = ti.phase;

    const bg = {
      dawn: 'radial-gradient(120% 70% at 50% -10%, rgba(192,122,75,.16), transparent 62%)',
      day: 'radial-gradient(120% 70% at 50% -10%, rgba(126,156,176,.14), transparent 62%)',
      dusk: 'radial-gradient(120% 70% at 50% -10%, rgba(181,101,79,.16), transparent 62%)',
      night: 'radial-gradient(140% 90% at 50% -20%, rgba(26,18,12,.55), transparent 72%)',
    };
    el.ambient.style.background = bg[ti.phase] || bg.night;
  }

  function render() {
    const world = W();
    const ranks = world.ranks;
    const rep = totalRep();

    el.dust.textContent = fmt(state.dust);
    el.cps.textContent = cps() > 0 ? '+' + fmt(cps()) : '0';
    el.rep.textContent = fmt(rep);

    // 星球条
    el.worldEmoji.textContent = world.emoji;
    el.worldName.textContent = world.name;
    el.worldSub.textContent = '第 ' + (state.world + 1) + ' 颗 · 收益 ×' + world.gain + ' · 累计 ' + fmt(state.total);
    el.worldPct.textContent = state.rank + '/' + ranks.length;

    // 当前身份
    const cur = ranks[Math.min(state.rank, ranks.length - 1)];
    el.rankIcon.textContent = cur.icon;
    el.rankName.textContent = cur.name;

    const next = ranks[state.rank];
    if (next) {
      const needReso = resoNeedFor(state.rank);
      const bits = [];
      bits.push('还要 ' + fmt(Math.max(0, next.dust - state.total)) + ' 星尘');
      if (next.rep > rep) bits.push('声望 ' + fmt(next.rep - rep));
      if (needReso > 0) bits.push('共振 ' + Math.min(state.reso, needReso) + '/' + needReso);
      if (next.cap) bits.push('市值 ' + fmt(capital()) + '/' + fmt(next.cap));
      if (next.fleet) bits.push('舰队 ' + fmt(fleetPower()) + '/' + fmt(next.fleet));
      if (next.badge) bits.push('星章 ' + badges() + '/' + next.badge);
      el.rankNext.textContent =
        (state.rank === 0 ? '首个身份 ' : '下一站 ') + next.name + '：' + bits.join(' · ');
    } else {
      el.rankNext.textContent = state.worldDone ? '本星球身份已全满' : '…';
    }

    const crit = critChance();
    el.hint.textContent = '每次点击 +' + fmt(clickPower()) + ' 星尘' +
      (combo >= 2 ? '（连锁 +' + Math.round(chainBonus() * 100) + '%）' : '') +
      (crit > 0 ? ' · 暴击率 ' + Math.round(crit * 100) + '%' : '');

    // 飞船状态
    const note = cps() > 0
      ? '🛰 ' + scene.ships.length + ' 艘飞船 · 每秒 +' + fmt(cps())
      : '🛰 飞船待命中，升级无人机让它采集';
    if (note !== lastNote) {
      el.stageNote.textContent = note;
      lastNote = note;
    }

    // 升级
    for (const row of upRows) {
      const level = state.levels[row.u.id] || 0;
      row.lv.textContent = 'Lv.' + level;
      if (level >= row.u.max) {
        row.btn.textContent = '已满级';
        row.btn.disabled = true;
      } else {
        const cost = costOf(row.u, level);
        row.btn.textContent = fmt(cost);
        row.btn.disabled = state.dust < cost;
      }
    }

    // 资产
    for (const row of assetRows) {
      const level = state.assets[row.a.id] || 0;
      row.lv.textContent = '拥有 ' + level;
      const cost = costOf(row.a, level);
      row.btn.textContent = fmt(cost);
      row.btn.disabled = state.dust < cost;
    }

    // 身份列表
    rankRows.forEach((row, i) => {
      const done = i < state.rank;
      const now = i === state.rank;
      row.li.classList.toggle('done', done);
      row.li.classList.toggle('now', now);
      row.badge.textContent = done ? '已获得' : now ? '进行中' : '未达成';
    });

    // 成就
    for (const row of achRows) row.li.classList.toggle('done', !!state.ach[achKey(row.a)]);
    for (const row of gachRows) row.li.classList.toggle('done', !!state.ach[row.a.id]);

    // 跃迁入口
    const nextWorld = WORLDS[state.world + 1];
    const canTravel = state.worldDone && !!nextWorld;
    el.travelBox.classList.toggle('hidden', !canTravel);
    if (canTravel) {
      el.travel.disabled = false;
      el.travel.textContent = '🔭 预览下一颗星球';
      el.travelTip.textContent = state.dust >= world.gate
        ? '门槛 ' + fmt(world.gate) + ' 星尘已够，点开图鉴看看' + nextWorld.name + '，再决定跃迁。'
        : '身份已全满，还差 ' + fmt(world.gate - state.dust) + ' 星尘就能跃迁到' + nextWorld.name + '。';
    }

    renderReso();
    if (pvIndex >= 0) updatePreviewGo();
  }

  /* ===================== 12. 交互 / 启动 ===================== */

  function openGuide() { el.guide.classList.remove('hidden'); }

  $('guideOk').addEventListener('click', () => {
    el.guide.classList.add('hidden');
    state.guideSeen = true;
    save();
  });

  el.help.addEventListener('click', openGuide);

  $('clearOk').addEventListener('click', () => {
    el.clear.classList.add('hidden');
    el.confetti.innerHTML = '';
  });

  el.pvCancel.addEventListener('click', closePreview);

  el.previewModal.addEventListener('click', (e) => {
    if (e.target === el.previewModal) closePreview();
  });

  el.pvGo.addEventListener('click', () => {
    if (el.pvGo.disabled) return;
    if (travel()) closePreview();
    else updatePreviewGo();
  });

  el.travel.addEventListener('click', () => openPreview(state.world + 1));

  el.reset.addEventListener('click', () => {
    if (!confirm('清空所有进度、回到第一颗星球，确定吗？')) return;
    try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
    state = newState();
    state.guideSeen = true;   // 已经会玩了
    clickStamps.length = 0;
    pendingGain = 0;
    comboBreak();
    closePreview();
    applyWorld();
    scene.setWorld(0);
    buildUpgrades();
    buildAssets();
    buildRanks();
    buildAchs();
    buildWorldCards();
    el.clear.classList.add('hidden');
    el.confetti.innerHTML = '';
    render();
    save();
    flashTip('已重置');
  });

  /* 天气面板 */
  el.wxChip.addEventListener('click', () => {
    refreshWxPanel();
    el.wxModal.classList.remove('hidden');
  });

  el.timeChip.addEventListener('click', () => {
    refreshWxPanel();
    el.wxModal.classList.remove('hidden');
  });

  el.wxOk.addEventListener('click', () => el.wxModal.classList.add('hidden'));

  el.wxModal.addEventListener('click', (e) => {
    if (e.target === el.wxModal) el.wxModal.classList.add('hidden');
  });

  el.citySelect.addEventListener('change', () => {
    cityPref = el.citySelect.value;
    try { localStorage.setItem(CITY_KEY, cityPref); } catch (e) {}
    loadWeather(true);
  });

  el.wxAuto.addEventListener('click', () => {
    cityPref = 'auto';
    lastLoc = null;
    try {
      localStorage.setItem(CITY_KEY, 'auto');
      localStorage.removeItem(LOC_KEY);
    } catch (e) {}
    el.citySelect.value = 'auto';
    loadWeather(true);
  });

  el.wxRefresh.addEventListener('click', () => loadWeather(true));

  /* 开场动画 */
  function playIntro() {
    let seen = false;
    try {
      seen = localStorage.getItem(INTRO_KEY) === '1';
      localStorage.setItem(INTRO_KEY, '1');
    } catch (e) {}

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      el.intro.classList.add('out');
      setTimeout(() => el.intro.classList.add('hidden'), 700);
      if (!state.guideSeen) setTimeout(openGuide, 640);
    };

    el.intro.classList.toggle('quick', seen);
    setTimeout(finish, seen ? 1500 : 3000);
    el.intro.addEventListener('pointerdown', finish);
  }

  /* ---- 起步 ---- */
  load();

  applyWorld();
  buildUpgrades();
  buildAssets();
  buildRanks();
  buildAchs();
  buildWorldCards();
  buildCitySelect();

  checkRanks();
  checkAchs();

  if (state.worldDone && isLastWorld() && !state.cleared) {
    state.cleared = true;
    save();
    checkAchs();
    setTimeout(showClear, 700);
  }

  // 天气：先用缓存/模拟，再后台拉实时
  const cached = readWxCache();
  if (cached) {
    applyWx({ kind: cached.kind, temp: cached.temp, code: cached.code }, cached.source, cached.place);
  } else {
    applyWx(simWx(), 'sim', '模拟天气');
  }

  render();
  renderClock();
  loadWeather(false);

  playIntro();

  // 每秒自动产出：0.1s 一跳，顺便攒飞船回收的数字
  setInterval(() => {
    const gain = cps() * 0.1;
    if (gain > 0) {
      state.dust += gain;
      state.total += gain;
      pendingGain += gain;
    }

    if (combo > 0 && performance.now() - comboAt > CHAIN_WINDOW) comboBreak();
    resoTick();
    if (window.DDSystems) window.DDSystems.tick(100);
    render();
  }, 100);

  // 飞船定期下到星球表面采集
  setInterval(() => {
    if (cps() > 0) scene.collect();
  }, 1700);

  // 时间/天气轻量刷新
  setInterval(renderClock, 15000);

  setInterval(save, AUTOSAVE_MS);
  window.addEventListener('pagehide', save);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) save();
  });

  /* ===================== 14. 给扩展系统用的接口 ===================== */
  window.DD = {
    get state() { return state; },
    worlds: WORLDS,
    fmt: fmt,
    toast: toast,
    save: save,
    render: render,
    checkRanks: checkRanks,
    checkAchs: checkAchs,
    refreshRank: function () { recountRank(); checkRanks(); render(); },
    switchTab: switchTab,
    addDust: function (n) {
      if (!(n > 0)) return;
      state.dust += n; state.total += n;
      render();
    },
    get cps() { return cps(); },
    get clickPower() { return clickPower(); },
    get rep() { return totalRep(); }
  };
  if (window.DDSystems) window.DDSystems.attach();
})();
