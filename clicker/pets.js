/* ============================================================
   点点星球 · 宠物与皮肤  (pets.js)
   1 皮肤数据  2 宠物数据  3 战力与加成  4 探索
   5 互动与说话  6 皮肤商店  7 面板渲染  8 画宠物  9 挂载
   ============================================================ */
(function (global) {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var D = function () { return window.DD; };
  var S = function () { return window.DD ? window.DD.state : null; };
  var TAU = Math.PI * 2;

  var MAX_LV = 20;
  var PAT_CD = 20000;
  var SLOTS = 3;

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function rgba(hex, a) {
    var s = String(hex).replace('#', '');
    if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
    var n = parseInt(s, 16) || 0;
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  /* ===================== 1. 皮肤 =====================
     每颗星球 4 款：第一款自带，后三款用星尘购买。
     price 是「第一颗星球的价钱」，实际价格会乘本星球倍率。
     穿在宠物身上后，身体、肚皮、眼睛、光晕、头顶饰品一起换。
     ================================================= */
  var SKINS = [
    [ // 0 暮紫
      { id: 'w0s0', name: '星尘', price: 0, acc: 'none',    desc: '出生自带，毛色像晒过月光的紫绒。',
        c: { body: '#8b78bd', shade: '#4b3f6e', belly: '#ded4f5', accent: '#e8c477', eye: '#221a36', glow: '#b9a6f0' } },
      { id: 'w0s1', name: '月白', price: 1800, acc: 'star',    desc: '整只泡在月光里，毛尖会轻轻发亮。',
        c: { body: '#cfd6e6', shade: '#98a2bb', belly: '#f6f8ff', accent: '#e8c477', eye: '#2c3550', glow: '#e8eeff' } },
      { id: 'w0s2', name: '熔金', price: 7200, acc: 'crown',   desc: '把黄昏的金边缝在身上，走路带火星。',
        c: { body: '#dda94e', shade: '#a06f28', belly: '#ffeec9', accent: '#fff1c9', eye: '#3b2a12', glow: '#ffd27a' } },
      { id: 'w0s3', name: '极光', price: 26000, acc: 'halo',   desc: '极光裁成的披风，一转头就是一道绿。',
        c: { body: '#6fd6c8', shade: '#2f8f94', belly: '#d6fff6', accent: '#b98cff', eye: '#12323a', glow: '#7effe0' } }
    ],
    [ // 1 烈焰
      { id: 'w1s0', name: '熔岩', price: 0, acc: 'none',      desc: '天生带一层余温，抱起来像暖手宝。',
        c: { body: '#d1652f', shade: '#8a3315', belly: '#ffd9a8', accent: '#ffcf6a', eye: '#2b0f07', glow: '#ff8a4a' } },
      { id: 'w1s1', name: '余烬', price: 5000, acc: 'star',   desc: '灰里还藏着红，风一吹就亮一下。',
        c: { body: '#8a4a3a', shade: '#4a1f18', belly: '#d8a48a', accent: '#ff7a3a', eye: '#1b0a06', glow: '#ff5a2a' } },
      { id: 'w1s2', name: '焰心', price: 20000, acc: 'crown', desc: '最中间那撮火，亮得看不清轮廓。',
        c: { body: '#ffb03a', shade: '#d96a1a', belly: '#fff0c0', accent: '#fff7e0', eye: '#3a1d05', glow: '#ffcf6a' } },
      { id: 'w1s3', name: '琉璃', price: 68000, acc: 'halo',  desc: '冷却后的火山玻璃，蓝得不像火家的人。',
        c: { body: '#7fd8e8', shade: '#3a8fa8', belly: '#e0fbff', accent: '#ff9ad8', eye: '#14323a', glow: '#9ff0ff' } }
    ],
    [ // 2 霜蓝
      { id: 'w2s0', name: '霜白', price: 0, acc: 'none',      desc: '毛上永远挂着一层薄霜。',
        c: { body: '#cfe3ee', shade: '#8fa9c0', belly: '#ffffff', accent: '#8fe0ff', eye: '#24405a', glow: '#bfefff' } },
      { id: 'w2s1', name: '极光', price: 18000, acc: 'halo',  desc: '整夜趴在冰原上看极光，把自己看成了极光。',
        c: { body: '#7fe0c0', shade: '#3aa088', belly: '#e0fff4', accent: '#b48cff', eye: '#143a30', glow: '#8fffd8' } },
      { id: 'w2s2', name: '深海', price: 56000, acc: 'star',  desc: '从冰层下最深的海沟里捞上来的颜色。',
        c: { body: '#3a6fa8', shade: '#1a3a5e', belly: '#bfe0ff', accent: '#7fd8ff', eye: '#08182a', glow: '#5fb8ff' } },
      { id: 'w2s3', name: '冰晶', price: 180000, acc: 'crystal', desc: '每一根毛都是一枚六角冰晶。',
        c: { body: '#a8c8ff', shade: '#5f7fc0', belly: '#f0f6ff', accent: '#ff9ad8', eye: '#1a2540', glow: '#c0d8ff' } }
    ],
    [ // 3 翡翠
      { id: 'w3s0', name: '苔绿', price: 0, acc: 'none',      desc: '在树根下睡了一整个雨季的毛色。',
        c: { body: '#7fa04a', shade: '#4a6628', belly: '#e0e8b0', accent: '#ffd36a', eye: '#1e2a10', glow: '#b8e07a' } },
      { id: 'w3s1', name: '花朝', price: 70000, acc: 'flower', desc: '走过的地方会多出一小丛花。',
        c: { body: '#e88fb0', shade: '#b05a7a', belly: '#ffe0ec', accent: '#ffe08a', eye: '#3a1420', glow: '#ffb8d8' } },
      { id: 'w3s2', name: '金秋', price: 220000, acc: 'star', desc: '叶子落下来那天的阳光，全部收进毛里。',
        c: { body: '#d8a03a', shade: '#a06a18', belly: '#ffeec0', accent: '#ff7a3a', eye: '#2e1e06', glow: '#ffcb6a' } },
      { id: 'w3s3', name: '雨林', price: 640000, acc: 'crown', desc: '深绿到发亮，还带着雨后的水汽。',
        c: { body: '#3aa88a', shade: '#16705a', belly: '#c0ffe8', accent: '#7fe0ff', eye: '#06281e', glow: '#5fffc0' } }
    ],
    [ // 4 量子
      { id: 'w4s0', name: '电蓝', price: 0, acc: 'none',      desc: '同时存在又不同时存在的一只。',
        c: { body: '#4ab8d8', shade: '#1a6f8a', belly: '#c9f6ff', accent: '#8ff0ff', eye: '#06222a', glow: '#8ff0ff' } },
      { id: 'w4s1', name: '干涉', price: 240000, acc: 'halo', desc: '两束光叠在一起，颜色一直在变。',
        c: { body: '#8f7aff', shade: '#4a3ab0', belly: '#e0d9ff', accent: '#8ff0ff', eye: '#140a3a', glow: '#b8a8ff' } },
      { id: 'w4s2', name: '超导', price: 780000, acc: 'crystal', desc: '零下两百度也不掉电的毛。',
        c: { body: '#d8d8e8', shade: '#8a8aa8', belly: '#ffffff', accent: '#58ffff', eye: '#22223a', glow: '#e8e8ff' } },
      { id: 'w4s3', name: '星云', price: 2600000, acc: 'star', desc: '在星云里洗过澡，身上有整片宇宙。',
        c: { body: '#ff7ad8', shade: '#b03a98', belly: '#ffd9f4', accent: '#8ff0ff', eye: '#3a0a2a', glow: '#ff9ae8' } }
    ],
    [ // 5 虚空
      { id: 'w5s0', name: '虚空', price: 0, acc: 'none',      desc: '看着它的时候，它也在看着你。',
        c: { body: '#4a3a6a', shade: '#241a3a', belly: '#b8a8d8', accent: '#c6a8ff', eye: '#0a0614', glow: '#a98ce0' } },
      { id: 'w5s1', name: '暗蚀', price: 900000, acc: 'halo', desc: '把光吞进去，只留下一点红。',
        c: { body: '#1a1a26', shade: '#080810', belly: '#6a6a8a', accent: '#ff4a6a', eye: '#ff2a4a', glow: '#ff5a7a' } },
      { id: 'w5s2', name: '星骸', price: 3200000, acc: 'star', desc: '一颗死去的星星剩下的骨头，被它捡来当外衣。',
        c: { body: '#d8cfb8', shade: '#9a9078', belly: '#fff8e8', accent: '#ffd27a', eye: '#2a2418', glow: '#ffebbf' } },
      { id: 'w5s3', name: '创世', price: 9800000, acc: 'crown', desc: '站在它旁边，会觉得一切刚要开始。',
        c: { body: '#ffffff', shade: '#b8c8ff', belly: '#ffffff', accent: '#ffd27a', eye: '#2a3a8a', glow: '#ffffff' } }
    ]
  ];

  /* ===================== 2. 宠物 =====================
     kind 决定画出来的骨架；base 是 1 级战力；
     idle/big/feed/back 是它说话的语气库。
     ================================================= */
  var PETS = [
    [ // 0 暮紫：只有一只
      { id: 'mochi', name: '紫团', title: '星尘猫', kind: 'cat', base: 10,
        idle: ['喵～', '喵喵喵！', '星星在打哈欠，喵', '摸摸头嘛，主人', '那块星尘归我，喵'],
        big: ['喵呜！主人好厉害！', '喵喵喵，爆发啦！', '爪子都看呆了，喵'],
        feed: ['好吃！喵～', '再来一口，喵', '这是星星味的，喵'],
        back: ['喵！我捡到好多星星！', '我回来啦，喵喵喵！'] }
    ],
    [ // 1 烈焰：两只
      { id: 'pyra', name: '火苗', title: '熔岩狐', kind: 'fox', base: 42,
        idle: ['嗷～尾巴又烧起来了', '主人，摸摸头', '地上的火星是俺踩出来的'],
        big: ['嗷呜！！太猛了主人！', '烧起来了烧起来了！', '俺的尾巴都竖起来了！'],
        feed: ['热乎！再来点！', '这个好吃，嗷呜'],
        back: ['嗷！背回来一袋火星！', '俺回来啦，快夸俺！'] },
      { id: 'cinder', name: '灰团', title: '余烬犬', kind: 'wolf', base: 50,
        idle: ['汪。', '我守在门口呢', '灰里还有一点红，汪'],
        big: ['汪汪汪！主人最棒！', '汪！我看见了，好厉害！', '尾巴停不下来，汪'],
        feed: ['嚼嚼……好吃', '还有吗，汪？'],
        back: ['汪！矿石在这儿。', '我回来了，汪！'] }
    ],
    [ // 2 霜蓝：三只
      { id: 'snow', name: '雪球', title: '霜原兔', kind: 'rabbit', base: 130,
        idle: ['噗叽～', '耳朵冻得有点硬', '跳一下，抖一层霜'],
        big: ['噗叽噗叽！好厉害！', '我跳起来了！', '主人小心，别把冰踩碎啦'],
        feed: ['冰镇的，好吃！', '啊呜，再来一根'],
        back: ['噗叽！我带回一兜霜！', '跳回来了，冷吗主人？'] },
      { id: 'icefox', name: '冰尾', title: '极光狐', kind: 'fox', base: 140,
        idle: ['极光今晚会来吗', '尾巴借你暖手', '在冰上看星星最清楚'],
        big: ['啊！整片极光都亮了！', '尾巴都炸开了！', '主人，你比极光还亮'],
        feed: ['温的？我喜欢', '谢谢主人，啊呜'],
        back: ['我沿着极光走了一圈', '带回来一点会发光的雪'] },
      { id: 'frost', name: '霜羽', title: '冰羽雀', kind: 'bird', base: 150,
        idle: ['啾～', '翅膀上结霜了，啾', '我在最高的冰塔上看见你了'],
        big: ['啾啾啾！飞起来啦！', '羽毛全亮了！', '主人，接住这片冰羽！'],
        feed: ['啾！甜的', '小口小口吃，啾'],
        back: ['啾！从云上带回来的', '我飞得比风还快'] }
    ],
    [ // 3 翡翠：四只
      { id: 'moss', name: '苔苔', title: '林间鹿', kind: 'deer', base: 320,
        idle: ['沙沙……', '角上又长出两片叶子', '森林今天很安静'],
        big: ['沙沙沙！整片林子都在响！', '角上的花开了！', '主人，风都在帮你'],
        feed: ['嫩的叶子，好吃', '嚼嚼……谢谢你'],
        back: ['带回来一篮果子', '我闻到星尘的味道了'] },
      { id: 'bell', name: '花铃', title: '花间兔', kind: 'rabbit', base: 350,
        idle: ['叮铃～', '我给你编了个花环', '花都朝你这边开'],
        big: ['叮铃铃！好厉害呀！', '花瓣全飞起来了！', '主人快看，天上下花了'],
        feed: ['是蜜糖花！啊呜', '再吃一朵'],
        back: ['捧回来一怀花', '花香把星尘引来了'] },
      { id: 'gulu', name: '咕噜', title: '雨林团', kind: 'blob', base: 380,
        idle: ['咕噜咕噜', '我在冒泡泡', '地上有点湿，正好'],
        big: ['咕噜噜噜！冒泡啦！', '我要被夸化了', '主人好厉害，咕噜'],
        feed: ['咕噜！好甜', '再喂一口嘛'],
        back: ['咕噜！肚子装满了星尘', '我滚回来的'] },
      { id: 'wing', name: '森翼', title: '翡翠雀', kind: 'bird', base: 410,
        idle: ['啾～树叶在响', '我停在最高的枝上', '要一起飞一圈吗'],
        big: ['啾啾！整座森林都在鼓掌！', '我飞得比叶子还快！', '主人，风在给你让路'],
        feed: ['啾！浆果味', '再来一颗'],
        back: ['从树冠带回来的', '我看见了很远的地方'] }
    ],
    [ // 4 量子：五只
      { id: 'wave', name: '电波', title: '量子猫', kind: 'cat', base: 600,
        idle: ['喵……或者没喵', '我可能在这儿，也可能不在', '观测我一下，喵'],
        big: ['喵喵喵！概率塌缩成好事了！', '所有可能性都在夸你！', '主人，这次发挥太好了'],
        feed: ['这只我在吃，那只也在吃', '喵，味道叠加了'],
        back: ['我同时去了三个地方', '喵，带回来一份确定的结果'] },
      { id: 'ghost', name: '叠影', title: '纠缠灵', kind: 'ghost', base: 640,
        idle: ['我在这儿，也在那儿', '别看太久，会散', '有点冷，但我不介意'],
        big: ['两个我都看呆了！', '我们同时鼓了掌！', '主人，你把时间拉长了'],
        feed: ['一半给我，一半也给我', '谢谢，虽然我没胃'],
        back: ['我带回了另一个我的礼物', '影子里全是星尘'] },
      { id: 'pulse', name: '脉冲', title: '超导团', kind: 'blob', base: 680,
        idle: ['嗡～', '我在导电，别碰', '泡泡是圆的，世界也是'],
        big: ['嗡嗡嗡！电流拉满了！', '整条线路都亮了！', '主人，你的手速超导了'],
        feed: ['嗡，能量+1', '再来一格电'],
        back: ['充好电回来了', '嗡，带回来一包电荷'] },
      { id: 'scope', name: '观测', title: '观测雀', kind: 'bird', base: 720,
        idle: ['啾，我在记录你', '今天的数据很好看', '再靠近一点，啾'],
        big: ['啾！这个样本太漂亮了！', '记录完毕：主人很强', '误差为零，啾'],
        feed: ['啾，补充观测能量', '这一口有数据味'],
        back: ['观测到一片星尘带', '啾，样本带回来了'] },
      { id: 'knot', name: '纠缠', title: '纠缠狐', kind: 'fox', base: 760,
        idle: ['你动一下，我也动一下', '尾巴和你连着', '嗷，我们是一对'],
        big: ['嗷呜！我们同时跳起来了！', '我一高兴，另一个我也高兴', '主人，我们是同步的'],
        feed: ['你吃一口，我也饱了', '嗷，谢谢'],
        back: ['我们分头找，找到双份', '嗷，回来了'] }
    ],
    [ // 5 虚空：六只
      { id: 'void', name: '虚无', title: '空之灵', kind: 'ghost', base: 1000,
        idle: ['……', '这里很安静，很好', '我不占地方'],
        big: ['我竟然有点高兴', '这一下，连虚空都晃了', '主人，你填满了一块空'],
        feed: ['我不饿，但谢谢你', '味道像很久以前'],
        back: ['带回来一点没有的东西', '我走了很远，也很近'] },
      { id: 'bone', name: '星骸', title: '骸之鹿', kind: 'deer', base: 1060,
        idle: ['骨头有点凉', '我背着一颗死星', '别怕，我不咬人'],
        big: ['星骸在发光！', '这颗死星好像又要亮了', '主人，你让它活过来了'],
        feed: ['嚼起来像石头，谢谢', '很久没人喂我了'],
        back: ['从星骸堆里捡的', '我带回来一段旧光'] },
      { id: 'abyss', name: '深渊', title: '渊之龙', kind: 'dragon', base: 1120,
        idle: ['呼……', '我在最深的地方睡过', '你身上有光的味道'],
        big: ['吼！这才叫爆发！', '深渊在为你让路', '主人，把天撕开吧'],
        feed: ['火要灭了，再来一口', '……好吃'],
        back: ['从裂隙底下带回来的', '我喷开了一条路'] },
      { id: 'zero', name: '归零', title: '零之团', kind: 'blob', base: 1180,
        idle: ['咕噜……零', '一切都会回到这里', '我在慢慢变小'],
        big: ['咕噜！从零开始也能这么亮！', '归零之前，先夸你', '主人，你让零变成了一'],
        feed: ['咕噜，谢谢', '这一口抵消了一点虚无'],
        back: ['我带回了零，也带回了很多', '咕噜，装满了'] },
      { id: 'whisper', name: '低语', title: '寂之雀', kind: 'bird', base: 1240,
        idle: ['啾……很轻', '我在你耳边说话', '听见了吗，风里有字'],
        big: ['啾！整片虚空都听见了！', '我把这件事说出去了', '主人，低语变成了回声'],
        feed: ['啾，一点点就够', '谢谢，很轻的甜'],
        back: ['我衔回来一句话', '啾，从很远的地方'] },
      { id: 'end', name: '终焉', title: '末之狼', kind: 'wolf', base: 1300,
        idle: ['汪……', '我见过所有的结尾', '你还在，很好'],
        big: ['汪！这个结尾我不认！', '还能再亮一点！', '主人，把终焉往后推'],
        feed: ['谢谢，汪', '很久没吃过热的东西了'],
        back: ['我从终点走回来', '汪，带回了最后一点星尘'] }
    ]
  ];

  var BY_ID = {};
  PETS.forEach(function (list, wi) {
    list.forEach(function (p, i) {
      p.world = wi;
      p.index = i;
      BY_ID[p.id] = p;
    });
  });

  /* ===================== 3. 战力 / 加成 ===================== */

  function gain() { return D() ? D().worlds[S().world].gain : 1; }
  function pets() { return S().pets; }
  function owned(id) { var p = S() && S().pets; return (p && p.owned[id]) || null; }
  function species() { return PETS[(S() && S().world) || 0]; }

  function levelOf(id) {
    var o = owned(id);
    return o ? clamp(Math.round(o.lv) || 1, 1, MAX_LV) : 0;
  }

  function powerOf(p, lv) {
    return Math.round(p.base * (1 + (lv - 1) * 0.35));
  }

  function petPower() {
    var st = S();
    if (!st || !st.pets) return 0;
    var sum = 0;
    species().forEach(function (p) {
      var o = owned(p.id);
      if (o) sum += powerOf(p, levelOf(p.id));
    });
    return sum;
  }

  function skinList(wi) { return SKINS[wi] || SKINS[0]; }

  function ownedSkinCount() {
    var st = S();
    if (!st || !st.pets) return 0;
    var n = 0;
    skinList(st.world).forEach(function (s) {
      if (s.price === 0 || (st.pets.skins && st.pets.skins[s.id])) n += 1;
    });
    return n;
  }

  // 宠物加成：比星舰更狠一点（星舰是 log×0.45，宠物是 log×0.55 + 皮肤收藏）
  function petMult() {
    var p = petPower();
    return 1 + Math.log10(1 + p) * 0.55 + ownedSkinCount() * 0.015;
  }

  function skinFor(p) {
    var o = owned(p.id);
    var list = skinList(p.world);
    var idx = o && typeof o.skin === 'number' ? o.skin : 0;
    return list[idx] || list[0];
  }

  function scenePets() {
    var st = S();
    if (!st || !st.pets) return [];
    var out = [];
    species().forEach(function (p) {
      if (owned(p.id)) {
        var sk = skinFor(p);
        out.push({ id: p.id, kind: p.kind, name: p.name, colors: sk.c, acc: sk.acc });
      }
    });
    return out;
  }

  function previewPet(wi) {
    var list = PETS[wi] || PETS[0];
    var p = list[0];
    var sk = (SKINS[wi] || SKINS[0])[0];
    return { id: p.id, kind: p.kind, name: p.name, colors: sk.c, acc: sk.acc };
  }

  function refreshScene() {
    var st = S();
    if (st && D() && D().scene && D().scene.setPets) D().scene.setPets(scenePets());
  }

  /* ===================== 4. 探索 ===================== */

  var DESTS = [
    { id: 'd1', name: '星草坡', icon: '🌿', min: 5,  need: 0,   rate: 30 },
    { id: 'd2', name: '流星旷野', icon: '☄️', min: 20, need: 80,  rate: 44 },
    { id: 'd3', name: '幻境裂隙', icon: '🌌', min: 60, need: 400, rate: 60 }
  ];

  function fmtLeft(ms) {
    var s = Math.max(0, Math.ceil(ms / 1000));
    var m = Math.floor(s / 60);
    var ss = s % 60;
    return m + ':' + (ss < 10 ? '0' : '') + ss;
  }

  function launch(slot, dest) {
    if (petPower() < dest.need) {
      D().toast('宠物战力不够，先喂喂它们', 1600);
      return;
    }
    var secs = dest.min * 60;
    var reward = Math.round(D().cps * secs * dest.rate + 600 * gain() + petPower() * dest.rate * 0.5);
    pets().exps[slot] = {
      dest: dest.id, name: dest.name, icon: dest.icon,
      endsAt: Date.now() + secs * 1000, reward: reward, startedAt: Date.now(),
      pet: pickOwnedId()
    };
    var pet = BY_ID[pets().exps[slot].pet];
    if (pet) speakLine(pet, 'idle', '我去' + dest.name + '啦！');
    D().toast('🐾 ' + (pet ? pet.name : '宠物') + ' 出发去' + dest.name + '（' + dest.min + ' 分钟）', 2200);
    render(true);
    D().save();
  }

  function claim(slot) {
    var e = pets().exps[slot];
    if (!e || Date.now() < e.endsAt) return;
    pets().exps[slot] = null;
    pets().done += 1;
    if (S().stats) S().stats.exps = (S().stats.exps || 0) + 1;
    D().addDust(e.reward);
    var pet = BY_ID[e.pet] || species()[0];
    speakLine(pet, 'back');
    D().toast('🎁 ' + pet.name + ' 带回来 +' + D().fmt(e.reward) + ' 星尘', 2400);
    if (window.DDFX) DDFX.sfx.mini(true);
    D().checkAchs();
    D().checkRanks();
    render(true);
    D().save();
  }

  /* ===================== 5. 互动 / 说话 ===================== */

  function affNeed(lv) { return lv * 40; }

  function feedCost(lv) {
    return Math.round(150 * gain() * Math.pow(1.28, Math.max(0, lv - 1)));
  }

  function adoptCost(p) {
    return Math.round(4000 * gain() * Math.pow(2.2, Math.max(0, p.index - 1)));
  }

  function addAff(o, n) {
    o.aff = (o.aff || 0) + n;
    var lv = clamp(o.lv || 1, 1, MAX_LV);
    var up = false;
    while (lv < MAX_LV && o.aff >= affNeed(lv)) {
      o.aff -= affNeed(lv);
      lv += 1;
      up = true;
    }
    if (lv >= MAX_LV) { lv = MAX_LV; o.aff = Math.min(o.aff, affNeed(MAX_LV)); }
    o.lv = lv;
    return up;
  }

  function pat(id) {
    var st = S(), o = owned(id), p = BY_ID[id];
    if (!o || !p) return;
    var now = Date.now();
    if (st.pets.pat[id] && now - st.pets.pat[id] < PAT_CD) {
      D().toast('它刚被摸过，等一会儿再摸', 1400);
      return;
    }
    st.pets.pat[id] = now;
    var up = addAff(o, 4);
    if (window.DDFX) DDFX.sfx.orb();
    speakLine(p, up ? 'big' : 'idle');
    if (up) onLevel(p, o);
    D().checkAchs();
    render(true);
    D().save();
  }

  function feed(id) {
    var st = S(), o = owned(id), p = BY_ID[id];
    if (!o || !p) return;
    var cost = feedCost(o.lv || 1);
    if (st.dust < cost) { D().toast('星尘不够，喂不起啦', 1400); return; }
    st.dust -= cost;
    var up = addAff(o, 15);
    if (window.DDFX) DDFX.sfx.buy();
    speakLine(p, up ? 'big' : 'feed');
    if (up) onLevel(p, o);
    D().checkAchs();
    D().render();
    render(true);
    D().save();
  }

  function onLevel(p, o) {
    D().toast('✨ ' + p.name + ' 升到 Lv.' + o.lv + '，战力 ' + powerOf(p, o.lv), 2000);
    if (window.DDFX) DDFX.sfx.mini(true);
    refreshScene();
  }

  function adopt(id) {
    var st = S(), p = BY_ID[id];
    if (!p || owned(id)) return;
    var cost = adoptCost(p);
    if (st.dust < cost) { D().toast('星尘不够招募它', 1400); return; }
    st.dust -= cost;
    st.pets.owned[id] = { lv: 1, aff: 0, skin: 0 };
    if (window.DDFX) DDFX.sfx.mini(true);
    D().toast('🎉 ' + p.name + ' 加入了你！', 2200);
    speakLine(p, 'idle');
    refreshScene();
    D().checkAchs();
    D().checkRanks();
    D().render();
    render(true);
    D().save();
  }

  function equip(id, skinIdx) {
    var st = S(), o = owned(id), p = BY_ID[id];
    if (!o || !p) return;
    var skin = skinList(p.world)[skinIdx];
    if (!skin) return;
    if (skin.price > 0 && !(st.pets.skins && st.pets.skins[skin.id])) {
      D().toast('还没买这款皮肤', 1400);
      return;
    }
    o.skin = skinIdx;
    if (window.DDFX) DDFX.sfx.buy();
    D().toast('👗 ' + p.name + ' 换上了「' + skin.name + '」', 1800);
    refreshScene();
    D().render();
    render(true);
    D().save();
  }

  function buySkin(skin) {
    var st = S();
    if (!skin || skin.price <= 0) return;
    if (st.pets.skins && st.pets.skins[skin.id]) { D().toast('已经买过了', 1200); return; }
    var price = Math.round(skin.price * gain());
    if (st.dust < price) { D().toast('星尘不够', 1400); return; }
    st.dust -= price;
    st.pets.skins[skin.id] = true;
    if (window.DDFX) DDFX.sfx.mini(true);
    var pet = species().filter(function (p) { return owned(p.id); })[0];
    if (pet) {
      var idx = skinList(st.world).indexOf(skin);
      owned(pet.id).skin = idx;
      refreshScene();
    }
    D().toast('👗 皮肤「' + skin.name + '」已收藏' + (pet ? '，' + pet.name + ' 先穿上了' : ''), 2400);
    D().checkAchs();
    D().render();
    render(true);
    D().save();
  }

  /* ---- 说话气泡 ---- */
  var sayTimer = 0;
  var lastSaid = 0;

  function pickOwnedId() {
    var list = [];
    species().forEach(function (p) { if (owned(p.id)) list.push(p.id); });
    if (!list.length) return null;
    return list[Math.floor(Math.random() * list.length)];
  }

  function lineOf(p, kind) {
    var arr = p[kind] && p[kind].length ? p[kind] : (p.idle || ['…']);
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function showBubble(p, text) {
    var box = $('petSay');
    if (!box || !p) return;
    $('petSayText').textContent = p.name + '：' + text;
    var av = $('petSayAv');
    if (av) {
      av.innerHTML = '';
      var sk = skinFor(p);
      var cv = document.createElement('canvas');
      cv.width = 72; cv.height = 72;
      cv.style.width = '36px'; cv.style.height = '36px';
      av.appendChild(cv);
      paintPortrait(cv, p, sk, 36);
    }
    box.classList.remove('hidden');
    box.classList.add('on');
    clearTimeout(sayTimer);
    sayTimer = setTimeout(function () { box.classList.remove('on'); }, 4600);
  }

  // 让某只宠物说一句；不指定就随机挑一只
  function speakLine(p, kind, forced) {
    if (!p) p = BY_ID[pickOwnedId()];
    if (!p || !owned(p.id)) return;
    var text = forced || lineOf(p, kind || 'idle');
    lastSaid = Date.now();
    showBubble(p, text);
  }

  function speak(kind, id) {
    var p = id ? BY_ID[id] : BY_ID[pickOwnedId()];
    speakLine(p, kind || 'idle');
  }

  /* ===================== 6. 面板渲染 ===================== */

  var sig = '';
  var slotEls = [];
  var interactiveEls = [];
  var lastWorld = -1;

  function signature() {
    var st = S();
    if (!st || !st.pets) return '';
    var ids = [];
    Object.keys(st.pets.owned).forEach(function (k) {
      var o = st.pets.owned[k];
      ids.push(k + ':' + o.lv + ':' + o.skin);
    });
    ids.sort();
    var exps = st.pets.exps.map(function (e) { return e ? e.dest + e.endsAt : '-'; }).join(',');
    return st.world + '|' + ids.join(',') + '|' + exps + '|' + Object.keys(st.pets.skins || {}).sort().join(',');
  }

  function statLine() {
    $('petPower').textContent = D().fmt(petPower());
    $('petMult').textContent = '×' + petMult().toFixed(2);
    $('petDone').textContent = D().fmt(pets().done);
  }

  function paintPortrait(cv, p, skin, size) {
    var dpr = Math.min(global.devicePixelRatio || 1, 2);
    cv.width = Math.round(size * dpr);
    cv.height = Math.round(size * dpr);
    cv.style.width = size + 'px';
    cv.style.height = size + 'px';
    var ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var g = ctx.createRadialGradient(size * 0.5, size * 0.46, 0, size * 0.5, size * 0.5, size * 0.55);
    g.addColorStop(0, rgba(skin.c.glow, 0.30));
    g.addColorStop(1, rgba(skin.c.glow, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    drawCreature(ctx, size * 0.5, size * 0.52, size * 0.92, p.kind, skin.c, 0.6, false, 0, skin.acc);
  }

  function petCard(p) {
    var st = S();
    var o = owned(p.id);
    var li = document.createElement('li');
    li.className = 'pet-card' + (o ? '' : ' locked');
    var av = document.createElement('div');
    av.className = 'pet-av';
    var skin = o ? skinFor(p) : skinList(st.world)[0];
    var cv = document.createElement('canvas');
    av.appendChild(cv);
    paintPortrait(cv, p, skin, 56);
    li.appendChild(av);

    var info = document.createElement('div');
    info.className = 'pet-info';

    if (o) {
      var lv = clamp(o.lv || 1, 1, MAX_LV);
      var need = affNeed(lv);
      var pct = Math.round(clamp((o.aff || 0) / need, 0, 1) * 100);
      var cost = feedCost(lv);
      info.innerHTML =
        '<div class="pet-line"><b>' + p.name + '</b><span class="pet-title">' + p.title + '</span>' +
          '<em class="pet-lv">Lv.' + lv + '</em></div>' +
        '<div class="pet-bar"><s style="width:' + pct + '%"></s></div>' +
        '<div class="pet-meta">战力 ' + D().fmt(powerOf(p, lv)) +
          ' · 亲密度 ' + Math.floor(o.aff || 0) + '/' + need +
          ' · 皮肤「' + skin.name + '」</div>' +
        '<div class="pet-ops">' +
          '<button type="button" data-pat="' + p.id + '">摸摸</button>' +
          '<button type="button" data-feed="' + p.id + '" data-cost="' + cost + '">喂食 ' + D().fmt(cost) + '</button>' +
          '<button type="button" data-skin="' + p.id + '">换肤</button>' +
        '</div>' +
        '<div class="pet-skins hidden" data-skins="' + p.id + '"></div>';

      info.querySelector('[data-pat]').addEventListener('click', function () { pat(p.id); });
      var fb = info.querySelector('[data-feed]');
      fb.addEventListener('click', function () { feed(p.id); });
      interactiveEls.push({ el: fb, cost: cost });
      info.querySelector('[data-skin]').addEventListener('click', function () {
        var box = info.querySelector('[data-skins]');
        if (!box.classList.contains('hidden')) { box.classList.add('hidden'); return; }
        box.classList.remove('hidden');
        box.innerHTML = '';
        skinList(st.world).forEach(function (s, idx) {
          var has = s.price === 0 || (st.pets.skins && st.pets.skins[s.id]);
          var btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'skin-dot' + (idx === (o.skin || 0) ? ' on' : '') + (has ? '' : ' off');
          btn.title = s.name;
          var sc = document.createElement('canvas');
          sc.width = 48; sc.height = 48;
          sc.style.width = '24px'; sc.style.height = '24px';
          btn.appendChild(sc);
          drawSwatch(sc.getContext('2d'), s.c, 24);
          var lab = document.createElement('i');
          lab.textContent = s.name;
          btn.appendChild(lab);
          btn.addEventListener('click', function () {
            if (!has) { D().toast('这款皮肤还没买，去下面皮肤商店看看', 1600); return; }
            equip(p.id, idx);
          });
          box.appendChild(btn);
        });
      });
    } else {
      var acost = adoptCost(p);
      info.innerHTML =
        '<div class="pet-line"><b>？？？</b><span class="pet-title">' + p.title + '</span></div>' +
        '<div class="pet-meta">还没遇见它 · 战力 ' + D().fmt(powerOf(p, 1)) + ' 起步</div>' +
        '<div class="pet-ops"><button type="button" data-adopt="' + p.id + '" data-cost="' + acost + '">招募 ' +
          D().fmt(acost) + '</button></div>';
      var ab = info.querySelector('[data-adopt]');
      ab.addEventListener('click', function () { adopt(p.id); });
      interactiveEls.push({ el: ab, cost: acost });
    }

    li.appendChild(info);
    return li;
  }

  function drawSwatch(ctx, c, size) {
    var g = ctx.createLinearGradient(0, 0, 0, size);
    g.addColorStop(0, c.body);
    g.addColorStop(1, c.shade);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size * 0.45, 0, TAU);
    ctx.fill();
    ctx.fillStyle = c.belly;
    ctx.beginPath();
    ctx.ellipse(size / 2, size * 0.62, size * 0.20, size * 0.13, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = c.accent;
    ctx.beginPath();
    ctx.arc(size * 0.68, size * 0.3, size * 0.1, 0, TAU);
    ctx.fill();
  }

  function rebuild() {
    var st = S();
    if (!st || !$('petList')) return;
    interactiveEls = [];
    slotEls = [];
    lastWorld = st.world;

    $('petCount').textContent = species().filter(function (p) { return owned(p.id); }).length + '/' + species().length;

    var list = $('petList');
    list.innerHTML = '';
    species().forEach(function (p) { list.appendChild(petCard(p)); });

    // 探索泊位
    var wrap = $('petExp');
    wrap.innerHTML = '';
    for (var i = 0; i < SLOTS; i++) {
      (function (idx) {
        var e = st.pets.exps[idx];
        var li = document.createElement('li');
        li.className = 'exp-item';
        if (!e) {
          li.innerHTML = '<div class="exp-title">探索位 ' + (idx + 1) + ' · 空着' +
            '<em data-left="' + idx + '">空闲</em></div>' +
            '<div class="exp-ops">' + DESTS.map(function (d, k) {
              return '<button type="button" data-slot="' + idx + '" data-d="' + k + '"' +
                (petPower() < d.need ? ' disabled' : '') + '>' + d.icon + ' ' + d.name + ' · ' + d.min + '分</button>';
            }).join('') + '</div>';
          li.querySelectorAll('[data-d]').forEach(function (b) {
            b.addEventListener('click', function () { launch(Number(b.dataset.slot), DESTS[Number(b.dataset.d)]); });
          });
          slotEls.push({ li: li, left: li.querySelector('[data-left]'), btn: null });
        } else {
          var pet = BY_ID[e.pet];
          li.innerHTML =
            '<div class="exp-title">' + (e.icon || '🐾') + ' ' + e.name +
              '<em data-left="' + idx + '">' + fmtLeft(e.endsAt - Date.now()) + '</em></div>' +
            '<div class="exp-reward">' + (pet ? pet.name : '宠物') + ' 预计带回 ' + D().fmt(e.reward) + ' 星尘</div>' +
            '<button type="button" class="exp-claim" data-claim="' + idx + '"' +
              (Date.now() < e.endsAt ? ' disabled' : '') + '>' +
              (Date.now() < e.endsAt ? '探索中' : '领取') + '</button>';
          var c = li.querySelector('[data-claim]');
          c.addEventListener('click', function () { claim(idx); });
          slotEls.push({ li: li, left: li.querySelector('[data-left]'), btn: c, endsAt: e.endsAt });
        }
        wrap.appendChild(li);
      })(i);
    }

    // 皮肤商店
    var shop = $('skinList');
    shop.innerHTML = '';
    var sl = skinList(st.world);
    sl.forEach(function (s, idx) {
      var has = s.price === 0 || (st.pets.skins && st.pets.skins[s.id]);
      var price = Math.round(s.price * gain());
      var li = document.createElement('li');
      li.className = 'skin-card' + (has ? ' own' : '');
      var cv = document.createElement('canvas');
      cv.width = 96; cv.height = 96;
      cv.style.width = '48px'; cv.style.height = '48px';
      drawSwatch(cv.getContext('2d'), s.c, 48);
      li.appendChild(cv);
      var info = document.createElement('div');
      info.className = 'item-main';
      info.innerHTML = '<div class="item-name">' + s.name + '</div>' +
        '<div class="item-desc">' + s.desc + '</div>';
      li.appendChild(info);
      var side = document.createElement('div');
      side.className = 'item-side';
      if (has) {
        side.innerHTML = '<span class="skin-owned">已收藏</span>';
      } else {
        side.innerHTML = '<button type="button" class="buy" data-buy="' + idx + '">' + D().fmt(price) + '</button>';
        var b = side.querySelector('button');
        b.addEventListener('click', function () { buySkin(s); });
        interactiveEls.push({ el: b, cost: price });
      }
      li.appendChild(side);
      shop.appendChild(li);
    });

    statLine();
    tickSlots();
    tickAfford();
  }

  function tickSlots() {
    var now = Date.now();
    slotEls.forEach(function (s) {
      if (!s.endsAt) return;
      var left = s.endsAt - now;
      if (s.left) s.left.textContent = left > 0 ? fmtLeft(left) : '已归来';
      if (s.btn) {
        var ready = left <= 0;
        if (s.btn.disabled === ready) {
          s.btn.disabled = !ready;
          s.btn.textContent = ready ? '领取' : '探索中';
        }
      }
    });
  }

  function tickAfford() {
    var st = S();
    if (!st) return;
    interactiveEls.forEach(function (it) {
      if (!it.el || !it.el.isConnected) return;
      it.el.disabled = st.dust < it.cost;
    });
  }

  function render(force) {
    var st = S();
    if (!st || !st.pets || !$('petList')) return;
    var ns = signature();
    if (force || ns !== sig) {
      sig = ns;
      if (st.world !== lastWorld) { interactiveEls = []; }
      rebuild();
    } else {
      statLine();
      tickSlots();
      tickAfford();
    }
  }

  /* ===================== 7. 画宠物 ===================== */

  // 一只圆滚滚的小家伙，占 100×100 的局部坐标系
  function drawCreature(ctx, cx, cy, size, kind, c, t, flip, hop, acc) {
    var k = size / 100;
    if (!(k > 0)) return;
    var bob = Math.sin(t * 2.2) * 1.6 + (hop > 0 ? Math.sin(Math.PI * clamp(hop, 0, 1)) * 10 : 0);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(k * (flip ? -1 : 1), k);

    // 影子
    if (kind !== 'ghost') {
      ctx.fillStyle = 'rgba(0,0,0,.26)';
      ctx.beginPath();
      ctx.ellipse(0, 46, 27 - bob * 0.3, 6.5, 0, 0, TAU);
      ctx.fill();
    }

    // 光晕
    var gl = ctx.createRadialGradient(0, 0, 3, 0, 0, 52);
    gl.addColorStop(0, rgba(c.glow, 0.20));
    gl.addColorStop(1, rgba(c.glow, 0));
    ctx.fillStyle = gl;
    ctx.beginPath(); ctx.arc(0, 0, 52, 0, TAU); ctx.fill();

    ctx.translate(0, -bob);

    var bodyGrad = ctx.createLinearGradient(0, -48, 0, 46);
    bodyGrad.addColorStop(0, c.body);
    bodyGrad.addColorStop(1, c.shade);

    // 尾巴（画在身体后面）
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (kind === 'cat' || kind === 'fox' || kind === 'wolf' || kind === 'dragon') {
      ctx.beginPath();
      ctx.moveTo(20, 30);
      if (kind === 'cat') {
        ctx.quadraticCurveTo(44, 24, 38, 2);
        ctx.strokeStyle = c.body; ctx.lineWidth = 6; ctx.stroke();
        ctx.beginPath(); ctx.arc(38, 2, 3.4, 0, TAU);
        ctx.fillStyle = c.accent; ctx.fill();
      } else if (kind === 'fox') {
        ctx.quadraticCurveTo(52, 20, 40, -2);
        ctx.strokeStyle = c.body; ctx.lineWidth = 12; ctx.stroke();
        ctx.beginPath(); ctx.arc(40, -2, 7, 0, TAU);
        ctx.fillStyle = c.accent; ctx.fill();
      } else if (kind === 'wolf') {
        ctx.quadraticCurveTo(46, 26, 42, 10);
        ctx.strokeStyle = c.body; ctx.lineWidth = 8; ctx.stroke();
      } else {
        ctx.moveTo(18, 32);
        ctx.lineTo(40, 36); ctx.lineTo(30, 26); ctx.lineTo(46, 24);
        ctx.strokeStyle = c.body; ctx.lineWidth = 7; ctx.stroke();
      }
    }
    if (kind === 'rabbit') {
      ctx.beginPath(); ctx.arc(24, 34, 7, 0, TAU);
      ctx.fillStyle = c.belly; ctx.fill();
      ctx.strokeStyle = rgba(c.shade, 0.5); ctx.lineWidth = 1.4; ctx.stroke();
    }
    if (kind === 'bird') {
      ctx.beginPath();
      ctx.moveTo(14, 34); ctx.lineTo(38, 40); ctx.lineTo(30, 30);
      ctx.closePath();
      ctx.fillStyle = c.shade; ctx.fill();
    }
    if (kind === 'blob') {
      for (var q = 0; q < 3; q++) {
        ctx.beginPath();
        ctx.arc(26 + q * 5, 26 - q * 5, 3.4 - q * 0.4, 0, TAU);
        ctx.fillStyle = rgba(c.accent, 0.6);
        ctx.fill();
      }
    }

    // 龙 / 鸟的翅膀
    if (kind === 'dragon' || kind === 'bird') {
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.moveTo(-14, -6);
      ctx.quadraticCurveTo(-46, -22, -40, 10);
      ctx.quadraticCurveTo(-30, 6, -14, 12);
      ctx.closePath();
      ctx.fillStyle = rgba(c.accent, kind === 'bird' ? 0.75 : 0.55);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(14, -6);
      ctx.quadraticCurveTo(46, -22, 40, 10);
      ctx.quadraticCurveTo(30, 6, 14, 12);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // 身体
    if (kind === 'blob') {
      ctx.beginPath();
      ctx.moveTo(-26, 36);
      ctx.bezierCurveTo(-34, 4, -20, -22, 0, -22);
      ctx.bezierCurveTo(20, -22, 34, 4, 26, 36);
      ctx.quadraticCurveTo(0, 46, -26, 36);
      ctx.closePath();
      ctx.fillStyle = bodyGrad;
      ctx.fill();
    } else if (kind === 'ghost') {
      ctx.beginPath();
      ctx.moveTo(-24, 30);
      ctx.bezierCurveTo(-26, -6, -18, -30, 0, -30);
      ctx.bezierCurveTo(18, -30, 26, -6, 24, 30);
      for (var w = 0; w < 4; w++) {
        var wx = 24 - w * 12;
        ctx.quadraticCurveTo(wx - 6, 30 + (w % 2 ? 10 : -4), wx - 12, 30);
      }
      ctx.closePath();
      ctx.fillStyle = bodyGrad;
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.ellipse(0, 22, 24, 21, 0, 0, TAU);
      ctx.fillStyle = bodyGrad;
      ctx.fill();
      // 肚皮
      ctx.beginPath();
      ctx.ellipse(0, 27, 13, 13, 0, 0, TAU);
      ctx.fillStyle = rgba(c.belly, 0.95);
      ctx.fill();
      // 脚
      ctx.fillStyle = c.shade;
      ctx.beginPath(); ctx.ellipse(-10, 42, 8, 5, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(10, 42, 8, 5, 0, 0, TAU); ctx.fill();
    }

    // 耳朵 / 角
    if (kind === 'cat') {
      triEar(ctx, -22, -24, -16, -52, -2, -30, c, rgba(c.accent, 0.55));
      triEar(ctx, 22, -24, 16, -52, 2, -30, c, rgba(c.accent, 0.55));
    } else if (kind === 'fox') {
      triEar(ctx, -24, -20, -17, -56, -1, -30, c, rgba(c.belly, 0.9));
      triEar(ctx, 24, -20, 17, -56, 1, -30, c, rgba(c.belly, 0.9));
    } else if (kind === 'wolf') {
      ctx.save();
      ctx.translate(-18, -24); ctx.rotate(-0.5);
      ctx.beginPath(); ctx.ellipse(0, 0, 10, 15, 0, 0, TAU);
      ctx.fillStyle = c.shade; ctx.fill(); ctx.restore();
      ctx.save();
      ctx.translate(18, -24); ctx.rotate(0.5);
      ctx.beginPath(); ctx.ellipse(0, 0, 10, 15, 0, 0, TAU);
      ctx.fillStyle = c.shade; ctx.fill(); ctx.restore();
    } else if (kind === 'rabbit') {
      ctx.save();
      ctx.translate(-11, -34); ctx.rotate(-0.18);
      ctx.beginPath(); ctx.ellipse(0, 0, 7.5, 22, 0, 0, TAU);
      ctx.fillStyle = c.body; ctx.fill();
      ctx.beginPath(); ctx.ellipse(0, 2, 4, 15, 0, 0, TAU);
      ctx.fillStyle = rgba(c.accent, 0.55); ctx.fill();
      ctx.restore();
      ctx.save();
      ctx.translate(11, -34); ctx.rotate(0.18);
      ctx.beginPath(); ctx.ellipse(0, 0, 7.5, 22, 0, 0, TAU);
      ctx.fillStyle = c.body; ctx.fill();
      ctx.beginPath(); ctx.ellipse(0, 2, 4, 15, 0, 0, TAU);
      ctx.fillStyle = rgba(c.accent, 0.55); ctx.fill();
      ctx.restore();
    } else if (kind === 'deer') {
      ctx.strokeStyle = c.accent;
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(-8, -34); ctx.lineTo(-14, -50); ctx.moveTo(-14, -50); ctx.lineTo(-24, -54);
      ctx.moveTo(-13, -44); ctx.lineTo(-20, -42);
      ctx.moveTo(8, -34); ctx.lineTo(14, -50); ctx.moveTo(14, -50); ctx.lineTo(24, -54);
      ctx.moveTo(13, -44); ctx.lineTo(20, -42);
      ctx.stroke();
      ctx.beginPath(); ctx.ellipse(-22, -30, 6, 9, 0.5, 0, TAU);
      ctx.fillStyle = c.body; ctx.fill();
      ctx.beginPath(); ctx.ellipse(22, -30, 6, 9, -0.5, 0, TAU);
      ctx.fillStyle = c.body; ctx.fill();
    } else if (kind === 'dragon') {
      ctx.fillStyle = c.accent;
      ctx.beginPath(); ctx.moveTo(-14, -34); ctx.lineTo(-22, -50); ctx.lineTo(-6, -40); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(14, -34); ctx.lineTo(22, -50); ctx.lineTo(6, -40); ctx.closePath(); ctx.fill();
    }

    // 头
    var headY = kind === 'ghost' || kind === 'blob' ? -8 : -10;
    var hg = ctx.createRadialGradient(-8, headY - 12, 2, 0, headY, 30);
    hg.addColorStop(0, c.body);
    hg.addColorStop(1, c.shade);
    ctx.beginPath();
    ctx.ellipse(0, headY, 25, 23, 0, 0, TAU);
    ctx.fillStyle = hg;
    ctx.fill();

    // 脸
    if (kind === 'bird') {
      ctx.beginPath();
      ctx.moveTo(-3, headY + 6); ctx.lineTo(3, headY + 6); ctx.lineTo(0, headY + 14);
      ctx.closePath();
      ctx.fillStyle = c.accent; ctx.fill();
    }
    // 眼睛
    var ex = 9.5, ey = headY - 1;
    eyes(ctx, -ex, ey, c);
    eyes(ctx, ex, ey, c);
    // 腮红
    ctx.fillStyle = rgba(c.accent, 0.32);
    ctx.beginPath(); ctx.ellipse(-17, headY + 7, 5, 3, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(17, headY + 7, 5, 3, 0, 0, TAU); ctx.fill();
    // 嘴
    if (kind !== 'bird') {
      ctx.strokeStyle = rgba(c.eye, 0.85);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(-0.2, headY + 8, 3.4, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
    }
    // 胡须
    if (kind === 'cat' || kind === 'fox') {
      ctx.strokeStyle = rgba(c.belly, 0.8);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-25, headY + 4); ctx.lineTo(-36, headY + 2);
      ctx.moveTo(-25, headY + 8); ctx.lineTo(-36, headY + 10);
      ctx.moveTo(25, headY + 4); ctx.lineTo(36, headY + 2);
      ctx.moveTo(25, headY + 8); ctx.lineTo(36, headY + 10);
      ctx.stroke();
    }

    // 饰品
    drawAcc(ctx, acc, c, t);

    ctx.restore();
  }

  // 三角耳朵：外圈主色，内圈衬色
  function triEar(ctx, ax, ay, bx, by, cx2, cy2, c, inner) {
    ctx.beginPath();
    ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(cx2, cy2);
    ctx.closePath();
    ctx.fillStyle = c.body;
    ctx.fill();
    var gx = (ax + bx + cx2) / 3, gy = (ay + by + cy2) / 3;
    var s = 0.52;
    ctx.beginPath();
    ctx.moveTo(gx + (ax - gx) * s, gy + (ay - gy) * s);
    ctx.lineTo(gx + (bx - gx) * s, gy + (by - gy) * s);
    ctx.lineTo(gx + (cx2 - gx) * s, gy + (cy2 - gy) * s);
    ctx.closePath();
    ctx.fillStyle = inner;
    ctx.fill();
  }

  // 眼睛：深色眼珠 + 高光
  function eyes(ctx, x, y, c) {
    ctx.beginPath();
    ctx.ellipse(x, y, 4.4, 5.2, 0, 0, TAU);
    ctx.fillStyle = c.eye;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x - 1.5, y - 1.8, 1.5, 0, TAU);
    ctx.fillStyle = 'rgba(255,255,255,.92)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 1.4, y + 1.6, 0.7, 0, TAU);
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    ctx.fill();
  }

  function drawAcc(ctx, acc, c, t) {
    if (!acc || acc === 'none') {
      for (var i = 0; i < 2; i++) {
        var a = t * 0.8 + i * Math.PI;
        spark(ctx, Math.cos(a) * 40, -34 + Math.sin(a) * 8, 2.4, c.accent);
      }
      return;
    }
    if (acc === 'star') {
      star(ctx, 26, -38, 5.5, c.accent);
      spark(ctx, -30, -30, 2.2, c.belly);
    } else if (acc === 'crown') {
      ctx.beginPath();
      ctx.moveTo(-14, -40); ctx.lineTo(-8, -50); ctx.lineTo(0, -42);
      ctx.lineTo(8, -50); ctx.lineTo(14, -40);
      ctx.closePath();
      ctx.fillStyle = c.accent;
      ctx.fill();
    } else if (acc === 'halo') {
      ctx.beginPath();
      ctx.ellipse(0, -44, 25, 6, 0, 0, TAU);
      ctx.strokeStyle = rgba(c.accent, 0.9);
      ctx.lineWidth = 2.4;
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(0, -44, 25, 6, 0, 0, TAU);
      ctx.strokeStyle = rgba(c.glow, 0.45);
      ctx.lineWidth = 5;
      ctx.stroke();
    } else if (acc === 'crystal') {
      ctx.beginPath();
      ctx.moveTo(0, -58); ctx.lineTo(7, -46); ctx.lineTo(0, -36); ctx.lineTo(-7, -46);
      ctx.closePath();
      ctx.fillStyle = rgba(c.accent, 0.9);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.7)';
      ctx.lineWidth = 1;
      ctx.stroke();
    } else if (acc === 'flower') {
      for (var k = 0; k < 5; k++) {
        var ang = k / 5 * TAU;
        ctx.beginPath();
        ctx.arc(28 + Math.cos(ang) * 5, -44 + Math.sin(ang) * 5, 3.2, 0, TAU);
        ctx.fillStyle = c.accent;
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(28, -44, 2.6, 0, TAU);
      ctx.fillStyle = '#fff6e3';
      ctx.fill();
    }
  }

  function star(ctx, x, y, r, color) {
    ctx.beginPath();
    for (var i = 0; i < 8; i++) {
      var a = i * Math.PI / 4;
      var rr = i % 2 ? r * 0.42 : r;
      if (i === 0) ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      else ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  function spark(ctx, x, y, r, color) {
    ctx.globalAlpha = 0.8;
    star(ctx, x, y, r, color);
    ctx.globalAlpha = 1;
  }

  /* ===================== 8. 皮肤收藏成就 / 挂载 ===================== */

  function attach() {
    if (!window.DD || !window.DD.state) return;
    var st = S();
    var base = { owned: {}, exps: [null, null, null], done: 0, skins: {}, pat: {} };
    st.pets = Object.assign(base, st.pets || {});
    st.pets.owned = Object.assign({}, st.pets.owned || {});
    st.pets.skins = Object.assign({}, st.pets.skins || {});
    st.pets.pat = Object.assign({}, st.pets.pat || {});
    if (!Array.isArray(st.pets.exps)) st.pets.exps = [null, null, null];
    while (st.pets.exps.length < SLOTS) st.pets.exps.push(null);

    // 旧存档里的舰队远征：换算成宠物探索次数
    if (st.fleet && st.fleet.done && !st.pets.migrated) {
      st.pets.done += st.fleet.done;
      st.pets.migrated = true;
    }

    // 第一只宠物永远陪着你
    var first = species()[0];
    if (first && !owned(first.id)) {
      st.pets.owned[first.id] = { lv: 1, aff: 0, skin: 0 };
    }

    refreshScene();
    render(true);
    setInterval(function () { render(); }, 500);
    setInterval(function () { statLine(); }, 1000);
  }

  function onWorldEnter() {
    var st = S();
    if (!st) return;
    var first = species()[0];
    if (first && !owned(first.id)) {
      st.pets.owned[first.id] = { lv: 1, aff: 0, skin: 0 };
      D().toast('🐾 新伙伴「' + first.name + '」跟着你落地了', 3000);
      speakLine(first, 'idle');
    } else if (first) {
      speakLine(first, 'idle');
    }
    refreshScene();
    render(true);
  }

  global.DDPets = {
    attach: attach,
    onWorldEnter: onWorldEnter,
    render: render,
    petPower: petPower,
    petMult: petMult,
    done: function () { return (S() && pets()) ? pets().done : 0; },
    scenePets: scenePets,
    previewPet: previewPet,
    speak: speak,
    ownedCount: function () {
      if (!S() || !S().pets) return 0;
      var n = 0;
      species().forEach(function (p) { if (owned(p.id)) n += 1; });
      return n;
    },
    drawCreature: drawCreature,
    DESTS: DESTS,
    PETS: PETS,
    SKINS: SKINS
  };
})(typeof window !== 'undefined' ? window : this);
