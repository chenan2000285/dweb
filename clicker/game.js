// 点点星球 v5 —— 每星球独立数值 / 股市 / 星尘连锁 / 独立成就
// 阅读顺序：1 配置 → 2 状态 → 3 计算 → 4 存档 → 5 天气时间
//          → 6 场景与点击（含连锁） → 7 列表与图鉴 → 8 购买/身份/跃迁
//          → 9 股市 → 10 成就 → 11 渲染 → 12 启动
(() => {
  'use strict';

  /* ===================== 1. 配置 ===================== */

  const SAVE_KEY = 'aiweb.clicker.v2';
  const WX_KEY = 'aiweb.clicker.wx.v1';
  const CITY_KEY = 'aiweb.clicker.city.v1';
  const LOC_KEY = 'aiweb.clicker.loc.v1';
  const INTRO_KEY = 'aiweb.clicker.intro.v1';

  const AUTOSAVE_MS = 5000;
  const OFFLINE_CAP_MS = 8 * 3600 * 1000;
  const CRIT_MULTI = 5;
  const CLICK_LIMIT = 50;        // 每秒最多算这么多次点击
  const CHAIN_WINDOW = 1500;     // 连击窗口（毫秒）
  const STOCK_MS = 60000;        // 股票一轮 60 秒
  const WX_TTL = 8 * 60 * 1000;  // 天气缓存有效期

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  // 每颗星球：gain 收益倍率；升级/资产/股票/成就全部独立
  // kind: click 点击 / cps 每秒 / crit 暴击率 / mult 全部产出加成
  const WORLDS = [
    {
      name: '暮紫星球', emoji: '🪐', gate: 1000000, gain: 1, stockMin: 100, stockRepUnit: 300,
      ranks: [
        { name: '拾尘者',   icon: '🌫️', dust: 100,     rep: 0 },
        { name: '星尘学徒', icon: '🌱', dust: 1000,    rep: 10 },
        { name: '街角名人', icon: '✨', dust: 5000,    rep: 50 },
        { name: '有车一族', icon: '🚗', dust: 20000,   rep: 150 },
        { name: '有房一族', icon: '🏠', dust: 100000,  rep: 400 },
        { name: '星际商人', icon: '💼', dust: 500000,  rep: 1000 },
        { name: '星系名流', icon: '🌟', dust: 1000000, rep: 3000 },
      ],
      upgrades: [
        { id: 'finger',  name: '星尘手指',   desc: '每次点击 +1',            base: 10,   growth: 1.15, max: 200, kind: 'click', amount: 1 },
        { id: 'drone',   name: '采集无人机', desc: '每秒 +0.5，多一艘飞船',  base: 50,   growth: 1.18, max: 200, kind: 'cps',   amount: 0.5 },
        { id: 'crit',    name: '幸运符',     desc: '暴击率 +5%（×5 收益）',  base: 300,  growth: 2.6,  max: 10,  kind: 'crit',  amount: 0.05 },
        { id: 'reactor', name: '星核反应堆', desc: '每秒 +5 星尘',           base: 1200, growth: 1.20, max: 200, kind: 'cps',   amount: 5 },
      ],
      assets: [
        { id: 'car',    name: '小汽车',   icon: '🚗', base: 500,     growth: 1.9, rep: 10 },
        { id: 'sport',  name: '跑车',     icon: '🏎️', base: 5000,    growth: 1.9, rep: 30 },
        { id: 'flat',   name: '公寓',     icon: '🏢', base: 20000,   growth: 1.9, rep: 60 },
        { id: 'luxury', name: '豪华跑车', icon: '🚙', base: 60000,   growth: 1.9, rep: 120 },
        { id: 'villa',  name: '别墅',     icon: '🏡', base: 250000,  growth: 1.9, rep: 400 },
        { id: 'palace', name: '星际豪宅', icon: '🛸', base: 1500000, growth: 1.9, rep: 1500 },
      ],
      stocks: [
        { id: 's1', name: '紫晶储蓄', icon: '🏦', risk: 'low',  vol: 0.006, drift: 0.0016, lev: 1, desc: '稳得像定期，涨得也慢。' },
        { id: 's2', name: '星尘矿业', icon: '⛏️', risk: 'mid',  vol: 0.016, drift: 0.0018, lev: 2, desc: '本星球最大的矿企，跟着行情慢慢爬。' },
        { id: 's3', name: '紫晶重工', icon: '🏭', risk: 'high', vol: 0.042, drift: 0.0015, lev: 3, desc: '三倍杠杆，一秒天堂一秒地狱。' },
      ],
      achs: [
        { id: 'first',  name: '第一次触碰', desc: '点击星球 1 次',            reward: 5,    ok: () => state.wclicks >= 1 },
        { id: 'asset1', name: '有点家当',   desc: '买下任意一件资产',        reward: 60,   ok: () => Object.keys(state.assets).some((k) => state.assets[k] > 0) },
        { id: 'chain25',name: '手感来了',   desc: '达成 25 连击',            reward: 150,  ok: () => state.comboBest >= 25 },
        { id: 'rep200', name: '小有名气',   desc: '声望达到 200',            reward: 500,  ok: () => totalRep() >= 200 },
        { id: 'done',   name: '暮紫毕业',   desc: '拿满暮紫星球全部身份',    reward: 2000, ok: () => state.worldDone },
      ],
    },
    {
      name: '烈焰星球', emoji: '🔥', gate: 6000000, gain: 8, stockMin: 800, stockRepUnit: 1500,
      ranks: [
        { name: '火花',       icon: '🔥', dust: 500,     rep: 0 },
        { name: '熔炉工',     icon: '⚒️', dust: 4000,    rep: 8 },
        { name: '烈焰骑士',   icon: '🐉', dust: 20000,   rep: 40 },
        { name: '火焰车神',   icon: '🏎️', dust: 100000,  rep: 120 },
        { name: '熔岩豪宅主', icon: '🏡', dust: 400000,  rep: 300 },
        { name: '火山大亨',   icon: '🌋', dust: 1500000, rep: 700 },
        { name: '烈焰之王',   icon: '👑', dust: 4000000, rep: 2000 },
      ],
      upgrades: [
        { id: 'l1', name: '熔岩指尖',     desc: '每次点击 +40（本星球 ×8）',  base: 1200,    growth: 1.16, max: 200, kind: 'click', amount: 40 },
        { id: 'l2', name: '火种无人机',   desc: '每秒 +20 星尘',              base: 9000,    growth: 1.18, max: 200, kind: 'cps',   amount: 20 },
        { id: 'l3', name: '烈焰幸运符',   desc: '暴击率 +6%',                 base: 4000,    growth: 2.6,  max: 10,  kind: 'crit',  amount: 0.06 },
        { id: 'l4', name: '熔炉反应堆',   desc: '每秒 +250 星尘',             base: 30000,   growth: 1.20, max: 200, kind: 'cps',   amount: 250 },
        { id: 'l5', name: '火山共鸣',     desc: '全部产出 +12%',              base: 90000,   growth: 1.35, max: 40,  kind: 'mult',  amount: 0.12 },
        { id: 'l6', name: '熔金收割机',   desc: '每次点击 +220',              base: 200000,  growth: 1.24, max: 200, kind: 'click', amount: 220 },
      ],
      assets: [
        { id: 'a1', name: '熔岩摩托', icon: '🏍️', base: 1500,     growth: 1.9, rep: 15 },
        { id: 'a2', name: '火焰跑车', icon: '🏎️', base: 12000,    growth: 1.9, rep: 40 },
        { id: 'a3', name: '熔岩公寓', icon: '🏢', base: 60000,    growth: 1.9, rep: 90 },
        { id: 'a4', name: '火山飞机', icon: '✈️', base: 200000,   growth: 1.9, rep: 180 },
        { id: 'a5', name: '岩浆别墅', icon: '🏡', base: 800000,   growth: 1.9, rep: 600 },
        { id: 'a6', name: '火山宫殿', icon: '🏰', base: 4000000,  growth: 1.9, rep: 2000 },
      ],
      stocks: [
        { id: 's1', name: '熔火能源', icon: '🔥', risk: 'low',  vol: 0.007, drift: 0.0020, lev: 1, desc: '给整颗星球供能，稳稳向上。' },
        { id: 's2', name: '火山重工', icon: '🏗️', risk: 'mid',  vol: 0.018, drift: 0.0020, lev: 2, desc: '造飞船的，订单多了就飞。' },
        { id: 's3', name: '陨铁资本', icon: '☄️', risk: 'high', vol: 0.050, drift: 0.0015, lev: 3, desc: '高风险高回报，心脏不好的别碰。' },
      ],
      achs: [
        { id: 'arrive',  name: '抵达烈焰',   desc: '跃迁到烈焰星球',            reward: 300,   ok: () => state.world >= 1 },
        { id: 'trade1',  name: '第一次交易', desc: '完成一笔股市交易',          reward: 250,   ok: () => state.trades >= 1 },
        { id: 'profit1', name: '股市首胜',   desc: '任意一笔股票盈利',          reward: 500,   ok: () => state.stockWins >= 1 },
        { id: 'chain50', name: '连锁达人',   desc: '达成 50 连击',              reward: 1200,  ok: () => state.comboBest >= 50 },
        { id: 'done',    name: '烈焰毕业',   desc: '拿满烈焰星球全部身份',      reward: 8000,  ok: () => state.worldDone },
      ],
    },
    {
      name: '霜蓝星球', emoji: '❄️', gate: 30000000, gain: 60, stockMin: 6000, stockRepUnit: 8000,
      ranks: [
        { name: '冰晶',     icon: '❄️', dust: 2000,     rep: 0 },
        { name: '雪原旅人', icon: '🧊', dust: 15000,    rep: 6 },
        { name: '寒霜骑士', icon: '🗡️', dust: 80000,    rep: 30 },
        { name: '极光车手', icon: '🌌', dust: 400000,   rep: 90 },
        { name: '冰宫主人', icon: '🏰', dust: 1500000,  rep: 250 },
        { name: '霜蓝女皇', icon: '👸', dust: 8000000,  rep: 2500 },
      ],
      upgrades: [
        { id: 'i1', name: '冰锥指尖',   desc: '每次点击 +300（本星球 ×60）', base: 9000,     growth: 1.16, max: 200, kind: 'click', amount: 300 },
        { id: 'i2', name: '霜翼无人机', desc: '每秒 +150 星尘',              base: 60000,    growth: 1.18, max: 200, kind: 'cps',   amount: 150 },
        { id: 'i3', name: '极光幸运符', desc: '暴击率 +8%',                  base: 25000,    growth: 2.6,  max: 10,  kind: 'crit',  amount: 0.08 },
        { id: 'i4', name: '冰核反应堆', desc: '每秒 +1800 星尘',             base: 200000,   growth: 1.20, max: 200, kind: 'cps',   amount: 1800 },
        { id: 'i5', name: '极光共鸣',   desc: '全部产出 +15%',               base: 400000,   growth: 1.35, max: 40,  kind: 'mult',  amount: 0.15 },
        { id: 'i6', name: '冰晶钻头',   desc: '每次点击 +1500',              base: 700000,   growth: 1.24, max: 200, kind: 'click', amount: 1500 },
        { id: 'i7', name: '寒潮引擎',   desc: '每秒 +12000 星尘',            base: 2500000,  growth: 1.20, max: 200, kind: 'cps',   amount: 12000 },
        { id: 'i8', name: '极光矩阵',   desc: '全部产出 +25%',               base: 9000000,  growth: 1.40, max: 40,  kind: 'mult',  amount: 0.25 },
      ],
      assets: [
        { id: 'b1', name: '冰原雪橇', icon: '🛷', base: 4000,      growth: 1.9, rep: 20 },
        { id: 'b2', name: '极光跑车', icon: '🚘', base: 40000,     growth: 1.9, rep: 50 },
        { id: 'b3', name: '冰晶公寓', icon: '🧊', base: 200000,    growth: 1.9, rep: 110 },
        { id: 'b4', name: '霜翼飞机', icon: '🛩️', base: 800000,    growth: 1.9, rep: 250 },
        { id: 'b5', name: '冰宫',     icon: '🏰', base: 3000000,   growth: 1.9, rep: 800 },
        { id: 'b6', name: '极光城堡', icon: '🌌', base: 15000000,  growth: 1.9, rep: 2500 },
      ],
      stocks: [
        { id: 's1', name: '极光能源', icon: '🌌', risk: 'low',  vol: 0.008, drift: 0.0022, lev: 1, desc: '极光发电，长夜里的稳定现金流。' },
        { id: 's2', name: '冰川航运', icon: '🚢', risk: 'mid',  vol: 0.020, drift: 0.0020, lev: 2, desc: '冰层一开，货就来了。' },
        { id: 's3', name: '霜核资本', icon: '🥶', risk: 'high', vol: 0.055, drift: 0.0015, lev: 3, desc: '冻住的不只是资产，还有你的心跳。' },
      ],
      achs: [
        { id: 'arrive',  name: '抵达霜蓝', desc: '跃迁到霜蓝星球',        reward: 1200,   ok: () => state.world >= 2 },
        { id: 'snow',    name: '雪中漫步', desc: '在雪天打开游戏',        reward: 1500,   ok: () => /snow/.test(wx.kind) },
        { id: 'rank3',   name: '霜蓝上位', desc: '本星球晋升 3 个身份',   reward: 4000,   ok: () => state.rank >= 3 },
        { id: 'trade5',  name: '老练玩家', desc: '累计完成 5 笔股市交易', reward: 8000,   ok: () => state.trades >= 5 },
        { id: 'done',    name: '霜蓝毕业', desc: '拿满霜蓝星球全部身份',  reward: 60000,  ok: () => state.worldDone },
      ],
    },
    {
      name: '翡翠星球', emoji: '🌿', gate: 0, gain: 400, stockMin: 40000, stockRepUnit: 40000,
      ranks: [
        { name: '嫩芽',     icon: '🌱', dust: 10000,    rep: 0 },
        { name: '林间行者', icon: '🍃', dust: 80000,    rep: 5 },
        { name: '翡翠猎人', icon: '🏹', dust: 400000,   rep: 25 },
        { name: '绿荫车主', icon: '🚙', dust: 2000000,  rep: 70 },
        { name: '树冠宫主', icon: '🌳', dust: 8000000,  rep: 200 },
        { name: '翡翠之王', icon: '💎', dust: 40000000, rep: 2800 },
      ],
      upgrades: [
        { id: 'g1',  name: '藤蔓指尖',     desc: '每次点击 +2200（本星球 ×400）', base: 60000,     growth: 1.16, max: 200, kind: 'click', amount: 2200 },
        { id: 'g2',  name: '叶脉无人机',   desc: '每秒 +1200 星尘',                base: 400000,    growth: 1.18, max: 200, kind: 'cps',   amount: 1200 },
        { id: 'g3',  name: '生命幸运符',   desc: '暴击率 +10%',                    base: 150000,    growth: 2.6,  max: 10,  kind: 'crit',  amount: 0.10 },
        { id: 'g4',  name: '生命树反应堆', desc: '每秒 +15000 星尘',               base: 1200000,   growth: 1.20, max: 200, kind: 'cps',   amount: 15000 },
        { id: 'g5',  name: '翡翠共鸣',     desc: '全部产出 +15%',                  base: 2000000,   growth: 1.35, max: 40,  kind: 'mult',  amount: 0.15 },
        { id: 'g6',  name: '光合收割机',   desc: '每次点击 +12000',                base: 3500000,   growth: 1.24, max: 200, kind: 'click', amount: 12000 },
        { id: 'g7',  name: '星尘藤网',     desc: '每秒 +100000 星尘',              base: 12000000,  growth: 1.20, max: 200, kind: 'cps',   amount: 100000 },
        { id: 'g8',  name: '翡翠矩阵',     desc: '全部产出 +30%',                  base: 30000000,  growth: 1.40, max: 40,  kind: 'mult',  amount: 0.30 },
        { id: 'g9',  name: '远古种子',     desc: '每次点击 +80000',                base: 45000000,  growth: 1.28, max: 200, kind: 'click', amount: 80000 },
        { id: 'g10', name: '世界树引擎',   desc: '每秒 +900000 星尘',              base: 120000000, growth: 1.20, max: 200, kind: 'cps',   amount: 900000 },
      ],
      assets: [
        { id: 'c1', name: '藤蔓滑板', icon: '🛹', base: 12000,     growth: 1.9, rep: 25 },
        { id: 'c2', name: '森林飞车', icon: '🚙', base: 150000,    growth: 1.9, rep: 60 },
        { id: 'c3', name: '树屋公寓', icon: '🌳', base: 700000,    growth: 1.9, rep: 140 },
        { id: 'c4', name: '翡翠飞船', icon: '🛸', base: 2500000,   growth: 1.9, rep: 320 },
        { id: 'c5', name: '树冠圣殿', icon: '🏛️', base: 12000000,  growth: 1.9, rep: 1000 },
        { id: 'c6', name: '世界树宫殿', icon: '🌍', base: 60000000, growth: 1.9, rep: 3000 },
      ],
      stocks: [
        { id: 's1', name: '世界树银行', icon: '🏦', risk: 'low',  vol: 0.009, drift: 0.0025, lev: 1, desc: '全星系最古老的银行，慢但可靠。' },
        { id: 's2', name: '林海贸易',   icon: '🌿', risk: 'mid',  vol: 0.022, drift: 0.0022, lev: 2, desc: '星尘与种子一起倒卖。' },
        { id: 's3', name: '翡翠投机',   icon: '💎', risk: 'high', vol: 0.060, drift: 0.0018, lev: 3, desc: '一天翻倍，也可能一天归零。' },
      ],
      achs: [
        { id: 'arrive',   name: '抵达翡翠', desc: '跃迁到翡翠星球',                reward: 6000,   ok: () => state.world >= 3 },
        { id: 'chain100', name: '百连神话', desc: '达成 100 连击',                 reward: 30000,  ok: () => state.comboBest >= 100 },
        { id: 'bigwin',   name: '一次赚够', desc: '股市单笔盈利达到 10 万',        reward: 50000,  ok: () => state.bestProfit >= 100000 },
        { id: 'up30',     name: '全面强化', desc: '本星球升级总等级达到 30',       reward: 60000,  ok: () => totalLevels() >= 30 },
        { id: 'done',     name: '翡翠毕业', desc: '拿满翡翠星球全部身份',          reward: 300000, ok: () => state.worldDone },
      ],
    },
  ];

  // 全局成就：跨星球只解锁一次
  const GLOBAL_ACHS = [
    { id: 'g_world2', name: '第二颗星球', desc: '跃迁到第二颗星球',              reward: 5000,    ok: () => state.world >= 1 },
    { id: 'g_rain',   name: '雨中漫步',   desc: '在雨天打开游戏',                reward: 300,     ok: () => /rain|drizzle|thunder|shower/.test(wx.kind) },
    { id: 'g_night',  name: '夜观星象',   desc: '在夜里打开游戏',                reward: 300,     ok: () => SceneKit.timeInfo().phase === 'night' },
    { id: 'g_c5000',  name: '手指发烫',   desc: '累计点击 5000 次',              reward: 2000,    ok: () => state.clicks >= 5000 },
    { id: 'g_combo',  name: '连锁狂人',   desc: '任意一次达成 100 连击',         reward: 10000,   ok: () => state.comboBest >= 100 },
    { id: 'g_stock',  name: '股市老手',   desc: '累计股票盈利 10 次',            reward: 20000,   ok: () => state.stockWins >= 10 },
    { id: 'g_clear',  name: '全剧终',     desc: '通关全部四颗星球',              reward: 1000000, ok: () => state.cleared },
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
    stock: null,      // { id, amount, start, path:[...] }
    stockLast: {},    // 每支股票上次结果
    stockRep: 0,      // 股市贡献的声望（本星球）
    stockWins: 0,
    stockProfit: 0,
    bestProfit: 0,
    trades: 0,
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
    stocks: $('stocks'), stockActive: $('stockActive'), stockNote: $('stockNote'),
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

  const clickPower = () =>
    (1 + sumUp('click')) * (1 + sumUp('mult')) * W().gain * Math.pow(2, state.rank);

  const cps = () =>
    sumUp('cps') * (1 + sumUp('mult')) * W().gain * (1 + state.rank * 0.5);

  const critChance = () => Math.min(0.65, sumUp('crit'));

  function assetRep() {
    let s = 0;
    const list = W().assets;
    for (let i = 0; i < list.length; i++) {
      s += (state.assets[list[i].id] || 0) * list[i].rep;
    }
    return s;
  }

  const totalRep = () => assetRep() + (state.stockRep || 0);

  const costOf = (item, level) => Math.floor(item.base * Math.pow(item.growth, level));

  function fmt(n) {
    if (!isFinite(n)) return '∞';
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

  function recountRank() {
    const ranks = W().ranks;
    let r = 0;
    while (r < ranks.length && state.total >= ranks[r].dust && totalRep() >= ranks[r].rep) {
      r += 1;
    }
    state.rank = r;
    state.worldDone = r >= ranks.length;
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
        ach: Object.assign({}, d.ach || {}),
        guideSeen: !!d.guideSeen,
        cleared: !!d.cleared,
        startedAt: num(d.startedAt) || Date.now(),
        lastSave: num(d.lastSave) || Date.now(),
        comboBest: num(d.comboBest),
        stock: d.stock && d.stock.path ? d.stock : null,
        stockLast: Object.assign({}, d.stockLast || {}),
        stockRep: num(d.stockRep),
        stockWins: num(d.stockWins),
        stockProfit: num(d.stockProfit),
        bestProfit: num(d.bestProfit),
        trades: num(d.trades),
      });

      // 只保留本星球仍然存在的升级/资产 id
      state.levels = {};
      W().upgrades.forEach((u) => { if (d.levels && d.levels[u.id]) state.levels[u.id] = num(d.levels[u.id]); });
      state.assets = {};
      W().assets.forEach((a) => { if (d.assets && d.assets[a.id]) state.assets[a.id] = num(d.assets[a.id]); });

      recountRank();

      // 离线收益
      const away = Date.now() - state.lastSave;
      const gain = cps() * Math.min(away, OFFLINE_CAP_MS) / 1000;
      if (away > 30000 && gain >= 1) {
        state.dust += gain;
        state.total += gain;
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

  const chainBonus = () => Math.min(1, Math.floor(combo / 5) * 0.1);

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
      const burst = clickPower() * (1 + chainBonus()) * Math.min(combo, 50) * 0.4;
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
    stock: $('panel-stock'),
    rank: $('panel-rank'),
  };

  tabs.forEach((t) => {
    t.addEventListener('click', () => {
      tabs.forEach((x) => x.classList.toggle('active', x === t));
      Object.keys(panels).forEach((k) => {
        panels[k].classList.toggle('active', k === t.dataset.tab);
      });
      if (t.dataset.tab === 'stock') renderStockPanel();
    });
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
    rankRows = W().ranks.map((r) => {
      const li = document.createElement('li');
      li.className = 'rank-item';
      li.innerHTML =
        '<span class="rank-emoji">' + r.icon + '</span>' +
        '<div class="item-main">' +
          '<div class="rank-name">' + r.name + '</div>' +
          '<div class="rank-req">累计星尘 ' + fmt(r.dust) + ' · 声望 ' + fmt(r.rep) + '</div>' +
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
                         : '跃迁到这里后，本星球的星尘、升级、资产、股市都会清零，从这颗星球重新发育。');

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
    } else if (state.stock) {
      el.pvGo.disabled = true;
      el.pvGo.textContent = '📈 等股市结算完';
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
      if (state.total >= r.dust && totalRep() >= r.rep) {
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
    toast('🎖 晋升「' + promoted.name + '」· 星尘翻倍，点击力 ×2', 2600);

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
    if (state.stock) {
      toast('📈 股市还没结算，60 秒后再跃迁', 2600);
      return false;
    }

    state.world += 1;
    state.dust = 0;
    state.total = 0;
    state.wclicks = 0;
    state.levels = {};
    state.assets = {};
    state.rank = 0;
    state.worldDone = false;
    state.stockRep = 0;
    state.comboBest = 0;
    state.stockLast = {};
    clickStamps.length = 0;
    pendingGain = 0;
    comboBreak();

    applyWorld();
    scene.setWorld(state.world);
    buildUpgrades();
    buildAssets();
    buildRanks();
    buildAchs();
    buildStocks();
    buildWorldCards();
    save();
    render();
    renderStockPanel();
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
    const colors = ['#ffd166', '#8b7bff', '#5ce1e6', '#ff7b9c', '#9dff8b'];
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
    el.clearSub.textContent = '从一粒尘埃到宇宙之王，四颗星球都被你点亮了。';

    const mins = Math.max(1, Math.floor((Date.now() - state.startedAt) / 60000));
    el.clearStats.innerHTML =
      '<div><b>' + WORLDS.length + '</b>星球</div>' +
      '<div><b>' + fmt(state.clicks) + '</b>总点击</div>' +
      '<div><b>' + fmt(state.trades) + '</b>交易</div>' +
      '<div><b>' + mins + ' 分钟</b>用时</div>';

    spawnConfetti(90);
    el.clear.classList.remove('hidden');
  }

  /* ===================== 9. 股市 ===================== */

  const riskName = (r) => (r === 'low' ? '稳健' : r === 'mid' ? '均衡' : '激进');

  let stockRows = [];
  let activeId = -1;
  let activeRefs = {};
  let lastChart = 0;

  function stockMeta(id) {
    const list = W().stocks;
    for (let i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  function gauss() {
    let u = 0, v = 0;
    while (!u) u = Math.random();
    while (!v) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  function makePath(st) {
    const pts = [100];
    let p = 100;
    for (let i = 0; i < 60; i++) {
      p = Math.max(4, p * (1 + st.drift + gauss() * st.vol));
      pts.push(p);
    }
    return pts;
  }

  function stockRatio(price) {
    const s = state.stock;
    const meta = s ? stockMeta(s.id) : null;
    if (!meta) return 0;
    return clamp((price / s.path[0] - 1) * meta.lev, -1, 5);
  }

  function openStock(meta, pct) {
    if (state.stock) { toast('📈 已有一笔持仓，等它结算完', 2000); return; }
    const min = W().stockMin;
    const amount = Math.floor(state.dust * pct);
    if (amount < min) { toast('单笔最低 ' + fmt(min) + ' 星尘', 2000); return; }

    state.dust -= amount;
    state.stock = { id: meta.id, amount, start: Date.now(), path: makePath(meta) };
    save();
    render();
    renderStockPanel();
    toast('📈 买入「' + meta.name + '」' + fmt(amount) + ' 星尘，60 秒后结算', 2600);
  }

  function settleStock() {
    const s = state.stock;
    if (!s) return;
    const meta = stockMeta(s.id);
    state.stock = null;
    state.trades += 1;

    let ratio = 0, payout = 0, profit = 0, repGain = 0;
    if (meta) {
      const end = s.path[s.path.length - 1];
      ratio = clamp((end / s.path[0] - 1) * meta.lev, -1, 5);
      payout = Math.max(0, Math.round(s.amount * (1 + ratio)));
      profit = payout - s.amount;
      state.dust += payout;

      if (profit > 0) {
        state.total += profit;
        state.stockWins += 1;
        state.stockProfit += profit;
        state.bestProfit = Math.max(state.bestProfit, profit);
        repGain = Math.max(1, Math.floor(profit / W().stockRepUnit));
        state.stockRep += repGain;
      }
      state.stockLast[meta.id] = { pct: Math.round(ratio * 100), profit };
    }

    activeId = -1;
    activeRefs = {};
    renderStockPanel();
    render();
    save();
    checkRanks();
    checkAchs();

    if (profit > 0) {
      spawnConfetti(20);
      toast('📈 「' + (meta ? meta.name : '股票') + '」结算 +' + fmt(profit) +
        ' 星尘' + (repGain ? ' · 声望 +' + fmt(repGain) : ''), 3200);
    } else if (profit < 0) {
      toast('📉 「' + (meta ? meta.name : '股票') + '」结算 ' + fmt(profit) +
        ' 星尘，本轮亏掉 ' + Math.round(Math.abs(ratio) * 100) + '%', 3200);
    } else {
      toast('➖ 平仓，本金全部拿回', 2400);
    }
  }

  function drawChart(cv, path, count) {
    if (!cv) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = cv.clientWidth || 280;
    const h = cv.clientHeight || 68;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
    }
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const n = path.length - 1;
    let min = path[0], max = path[0];
    for (let i = 0; i <= n; i++) { if (path[i] < min) min = path[i]; if (path[i] > max) max = path[i]; }
    if (max - min < 0.5) { max += 0.5; min -= 0.5; }
    const pad = (max - min) * 0.12;
    min -= pad; max += pad;

    const xOf = (i) => 4 + (w - 8) * (i / n);
    const yOf = (v) => h - 8 - ((v - min) / (max - min)) * (h - 16);

    // 起始价基准线
    ctx.strokeStyle = 'rgba(255,255,255,.14)';
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(4, yOf(path[0]));
    ctx.lineTo(w - 4, yOf(path[0]));
    ctx.stroke();
    ctx.setLineDash([]);

    const up = path[Math.max(0, count - 1)] >= path[0];
    const line = up ? '#63e6a0' : '#ff6b8a';

    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, up ? 'rgba(99,230,160,.35)' : 'rgba(255,107,138,.35)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');

    ctx.beginPath();
    ctx.moveTo(xOf(0), yOf(path[0]));
    for (let i = 1; i < count; i++) ctx.lineTo(xOf(i), yOf(path[i]));
    const lastX = xOf(count - 1);
    ctx.lineTo(lastX, h - 2);
    ctx.lineTo(4, h - 2);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(xOf(0), yOf(path[0]));
    for (let i = 1; i < count; i++) ctx.lineTo(xOf(i), yOf(path[i]));
    ctx.strokeStyle = line;
    ctx.lineWidth = 1.8;
    ctx.lineJoin = 'round';
    ctx.stroke();

    const lx = xOf(count - 1), ly = yOf(path[count - 1]);
    ctx.beginPath();
    ctx.arc(lx, ly, 3, 0, Math.PI * 2);
    ctx.fillStyle = line;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(lx, ly, 6, 0, Math.PI * 2);
    ctx.fillStyle = up ? 'rgba(99,230,160,.18)' : 'rgba(255,107,138,.18)';
    ctx.fill();
  }

  function buildStocks() {
    el.stocks.innerHTML = '';
    stockRows = W().stocks.map((meta) => {
      const li = document.createElement('li');
      li.className = 'stock-card';
      li.innerHTML =
        '<div class="stock-top">' +
          '<div class="stock-name">' + meta.icon + ' ' + meta.name + '</div>' +
          '<span class="risk risk-' + meta.risk + '">' + riskName(meta.risk) + '</span>' +
        '</div>' +
        '<div class="stock-desc">' + meta.desc + '</div>' +
        '<div class="stock-meta">' +
          '<span>波动 ' + (meta.vol * 100).toFixed(1) + '%/秒</span>' +
          '<span>杠杆 ×' + meta.lev + '</span>' +
          '<span>60 秒</span>' +
        '</div>' +
        '<div class="stock-last"></div>' +
        '<div class="stock-btns"></div>';

      const btnBox = li.querySelector('.stock-btns');
      const btns = [0.1, 0.25, 0.5, 1].map((pct) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'stock-btn';
        b.innerHTML = '<b>' + (pct === 1 ? '全部' : Math.round(pct * 100) + '%') + '</b><s></s>';
        b.addEventListener('click', () => openStock(meta, pct));
        btnBox.appendChild(b);
        return { pct, btn: b, amt: b.querySelector('s') };
      });

      el.stocks.appendChild(li);
      return { meta, li, btns, lastEl: li.querySelector('.stock-last') };
    });
  }

  function renderStockPanel() {
    const s = state.stock;

    if (!s) {
      if (!el.stockActive.classList.contains('hidden')) {
        el.stockActive.classList.add('hidden');
        el.stockActive.innerHTML = '';
      }
      activeId = -1;
      activeRefs = {};
    } else if (activeId !== s.id) {
      const meta = stockMeta(s.id);
      activeId = s.id;
      el.stockActive.classList.remove('hidden');
      el.stockActive.innerHTML =
        '<div class="active-top">' +
          '<span class="active-name">' + (meta ? meta.icon + ' ' + meta.name : '持仓') + '</span>' +
          '<span class="active-timer">60s</span>' +
        '</div>' +
        '<canvas class="stock-chart"></canvas>' +
        '<div class="active-foot">' +
          '<span class="active-inv">投入 ' + fmt(s.amount) + '</span>' +
          '<span class="active-pl">±0</span>' +
        '</div>';
      activeRefs = {
        timer: el.stockActive.querySelector('.active-timer'),
        cv: el.stockActive.querySelector('.stock-chart'),
        inv: el.stockActive.querySelector('.active-inv'),
        pl: el.stockActive.querySelector('.active-pl'),
      };
      lastChart = 0;
    }

    const min = W().stockMin;
    for (const row of stockRows) {
      for (const b of row.btns) {
        const amt = Math.floor(state.dust * b.pct);
        b.amt.textContent = fmt(amt);
        b.btn.disabled = !!s || amt < min;
      }
      const last = state.stockLast[row.meta.id];
      if (last) {
        const up = last.profit >= 0;
        row.lastEl.className = 'stock-last ' + (up ? 'up' : 'down');
        row.lastEl.textContent = '上次 ' + (up ? '+' : '') + last.pct + '% · ' +
          (last.profit >= 0 ? '赚 ' : '亏 ') + fmt(Math.abs(last.profit));
      } else {
        row.lastEl.className = 'stock-last';
        row.lastEl.textContent = '';
      }
    }

    el.stockNote.textContent = '单笔最低 ' + fmt(min) + ' 星尘 · 已交易 ' + state.trades +
      ' 次 · 股市声望 +' + fmt(state.stockRep) + ' · 盈 ' + state.stockWins + ' 次';

    const stockTab = document.querySelector('.tab[data-tab="stock"]');
    if (stockTab) stockTab.classList.toggle('has-stock', !!s);
  }

  function tickStock() {
    const s = state.stock;
    if (!s) return;
    const elapsed = Date.now() - s.start;

    if (elapsed >= STOCK_MS) { settleStock(); return; }

    const sec = Math.ceil((STOCK_MS - elapsed) / 1000);
    const idx = clamp(Math.floor(elapsed / 1000) + 1, 1, 60);

    if (activeRefs.timer) activeRefs.timer.textContent = sec + 's';

    const price = s.path[idx];
    const ratio = stockRatio(price);
    if (activeRefs.pl) {
      const pl = s.amount * ratio;
      activeRefs.pl.textContent = (ratio >= 0 ? '+' : '') + Math.round(ratio * 100) + '% · ' +
        (pl >= 0 ? '+' : '') + fmt(pl);
      activeRefs.pl.classList.toggle('up', ratio > 0);
      activeRefs.pl.classList.toggle('down', ratio < 0);
    }

    if (performance.now() - lastChart > 250) {
      lastChart = performance.now();
      drawChart(activeRefs.cv, s.path, idx);
    }
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
      dawn: 'radial-gradient(120% 70% at 50% -10%, rgba(255,140,90,.18), transparent 62%)',
      day: 'radial-gradient(120% 70% at 50% -10%, rgba(120,160,255,.14), transparent 62%)',
      dusk: 'radial-gradient(120% 70% at 50% -10%, rgba(255,110,140,.18), transparent 62%)',
      night: 'radial-gradient(140% 90% at 50% -20%, rgba(20,16,60,.5), transparent 72%)',
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
      el.rankNext.textContent =
        (state.rank === 0 ? '首个身份 ' : '下一站 ') + next.name +
        '：还要 ' + fmt(Math.max(0, next.dust - state.total)) + ' 星尘 · ' +
        fmt(Math.max(0, next.rep - rep)) + ' 声望';
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
      el.travelTip.textContent = state.stock
        ? '股市还在持仓，结算完才能跃迁。'
        : (state.dust >= world.gate
          ? '门槛 ' + fmt(world.gate) + ' 星尘已够，点开图鉴看看' + nextWorld.name + '，再决定跃迁。'
          : '身份已全满，还差 ' + fmt(world.gate - state.dust) + ' 星尘就能跃迁到' + nextWorld.name + '。');
    }

    renderStockPanel();
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
    buildStocks();
    buildWorldCards();
    el.clear.classList.add('hidden');
    el.confetti.innerHTML = '';
    activeId = -1;
    activeRefs = {};
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
  buildStocks();
  buildWorldCards();
  buildCitySelect();

  if (state.stock && Date.now() - state.stock.start >= STOCK_MS) settleStock();

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
  renderStockPanel();
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
    tickStock();
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
})();
