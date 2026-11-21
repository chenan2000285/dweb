// 点点星球 · 账号 + 云同步 + 排行榜 + 管理员后台（客户端）
// 原则：分数属于服务器，本地只是缓存；表对前端完全关闭，只能走接口函数。
(() => {
  'use strict';

  /* ========== 1. 后端地址（只有站长改这里，玩家看不到也改不了） ========== */
  const CFG = {
    // Supabase 项目地址，例如：https://abcdefgh.supabase.co
    url: 'https://bjeltfyiqwmnsbpdynmf.supabase.co',
    // Supabase 的 anon / publishable key（公开的，可以放在前端）
    key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqZWx0ZnlpcXdtbnNicGR5bm1mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTUyNDMyMTYsImV4cCI6MjExMDgxOTIxNn0.Jq_7aBcR-Zii6t3ve5JIXaLrQ3WzuZtMQe6HEm7wP5Y'
  };

  // 用户在页面上填过的地址和 key 存在本机，下次打开直接用
  try {
    const sUrl = localStorage.getItem('aiweb.clicker.url');
    const sKey = localStorage.getItem('aiweb.clicker.key');
    if (sUrl) CFG.url = sUrl;
    if (sKey) CFG.key = sKey;
  } catch (e) {}

  const K = {
    token: 'aiweb.clicker.token',
    name:  'aiweb.clicker.name'
  };

  const $ = (id) => document.getElementById(id);
  const ready = () => !!(CFG.url && CFG.key);

  function tok() {
    try { return localStorage.getItem(K.token) || ''; } catch (e) { return ''; }
  }
  function setTok(v) {
    try { v ? localStorage.setItem(K.token, v) : localStorage.removeItem(K.token); } catch (e) {}
  }
  function myName() {
    try { return localStorage.getItem(K.name) || ''; } catch (e) { return ''; }
  }
  function setName(v) {
    try { localStorage.setItem(K.name, v || ''); } catch (e) {}
  }

  const S = () => (window.DD ? window.DD.state : null);

  function fmt(n) {
    n = Number(n) || 0;
    if (window.DD && window.DD.fmt) {
      try { return window.DD.fmt(n); } catch (e) {}
    }
    if (n >= 1e12) return (n / 1e12).toFixed(2) + '万亿';
    if (n >= 1e8)  return (n / 1e8).toFixed(2) + '亿';
    if (n >= 1e4)  return (n / 1e4).toFixed(2) + '万';
    return Math.floor(n).toString();
  }

  function hdr() {
    return {
      'Content-Type': 'application/json',
      'apikey': CFG.key,
      'Authorization': 'Bearer ' + CFG.key
    };
  }

  // 调 Supabase 的 rpc 函数：POST /rest/v1/rpc/<函数名>，参数直接当 JSON body
  async function rpc(fn, body) {
    if (!ready()) return { ok: false, reason: 'nosetup' };
    let r;
    try {
      r = await fetch(CFG.url.replace(/\/+$/, '') + '/rest/v1/rpc/' + fn, {
        method: 'POST',
        headers: hdr(),
        body: JSON.stringify(body || {})
      });
    } catch (e) {
      return { ok: false, reason: '连不上服务器' };
    }
    let data = null;
    try { data = await r.json(); } catch (e) {}
    if (!r.ok) {
      // 函数内部报错时 Supabase 会回 { message, code }
      return { ok: false, reason: (data && (data.message || data.hint || data.details)) || ('HTTP ' + r.status) };
    }
    return data;
  }

  /* ========== 2. 界面骨架 ========== */
  let role = '';       // '' / 'user' / 'admin'
  let busy = false;
  let tickAt = 0;
  let lastPushed = -1;
  let holdUntil = 0;   // 被服务器判定跳变后，暂停自动同步到这时间

  function status(text, tone) {
    const el = $('lbStatus');
    if (!el) return;
    el.textContent = text;
    el.dataset.tone = tone || 'idle';
  }

  function toast(msg) {
    if (window.DD && window.DD.toast) { window.DD.toast(msg, 2600); return; }
    const t = $('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2600);
  }

  function showAuth() {
    $('authBox') && $('authBox').classList.remove('hidden');
    $('meBox')   && $('meBox').classList.add('hidden');
    $('adminBox')&& $('adminBox').classList.add('hidden');
    role = '';
  }

  function showMe(name) {
    $('authBox') && $('authBox').classList.add('hidden');
    $('meBox')   && $('meBox').classList.remove('hidden');
    const el = $('meName');
    if (el) el.textContent = name || myName() || '—';
    const out = $('auOut');
    if (out) out.classList.toggle('hidden', !tok());
  }

  function buildUI() {
    if (!$('lbList')) return;

    const doAuth = async (kind) => {
      const u = ($('auName') && $('auName').value || '').trim();
      const p = ($('auPass') && $('auPass').value || '');
      if (!u || !p) { status('账号和密码都要填', 'bad'); return; }
      status(kind === 'reg' ? '注册中…' : '登录中…', 'busy');
      try {
        const res = await rpc(kind === 'reg' ? 'api_register' : 'api_login', { p_user: u, p_pass: p });
        if (!res || !res.ok) { status((res && res.reason) || '失败', 'bad'); return; }
        setTok(res.token);
        setName(res.name);
        role = res.role || 'user';
        $('auPass').value = '';
        showMe(res.name);
        status('已登录 · ' + res.name, 'ok');
        toast(kind === 'reg' ? '☁️ 注册好了，进度会自动上传' : '☁️ 欢迎回来');
        if (role === 'admin') $('adminBox') && $('adminBox').classList.remove('hidden');
        applyServer(res);
        loadBoard();
        if (role === 'admin') loadAdmin();
      } catch (e) {
        status('连不上服务器，稍后再试', 'off');
      }
    };

    const loginBtn = $('auLogin');
    if (loginBtn) loginBtn.addEventListener('click', () => doAuth('login'));
    const regBtn = $('auReg');
    if (regBtn) regBtn.addEventListener('click', () => doAuth('reg'));
    const pass = $('auPass');
    if (pass) pass.addEventListener('keydown', (e) => { if (e.key === 'Enter') doAuth('login'); });

    const out = $('auOut');
    if (out) out.addEventListener('click', async () => {
      try { await rpc('api_logout', { p_token: tok() }); } catch (e) {}
      setTok('');
      setName('');
      showAuth();
      status('已退出', 'idle');
    });

    const syncBtn = $('lbSync');
    if (syncBtn) syncBtn.addEventListener('click', () => sync('manual'));

    const refresh = $('lbRefresh');
    if (refresh) refresh.addEventListener('click', () => loadBoard(true));

    const save = $('lbSave');
    if (save) save.addEventListener('click', () => {
      const u = (($('lbUrl') && $('lbUrl').value) || '').trim().replace(/\/+$/, '');
      const k = (($('lbKey') && $('lbKey').value) || '').trim();
      if (!/^https?:\/\/[^\s]+$/i.test(u)) {
        status('地址要以 https:// 开头，例如 https://abc.supabase.co', 'bad');
        return;
      }
      if (k.length < 40) {
        status('key 没粘全，要整段复制（很长一串）', 'bad');
        return;
      }
      CFG.url = u;
      CFG.key = k;
      try {
        localStorage.setItem('aiweb.clicker.url', u);
        localStorage.setItem('aiweb.clicker.key', k);
      } catch (e) {}
      if ($('lbSetup')) $('lbSetup').classList.add('hidden');
      status('已连接，注册或登录吧', 'ok');
      loadBoard();
      if (tok()) { showMe(); resume(); } else { showAuth(); }
    });

    if (!ready()) {
      if ($('lbSetup')) $('lbSetup').classList.remove('hidden');
      status('先把 Supabase 地址和 key 填上', 'off');
      return;
    }
    if ($('lbSetup')) {
      $('lbUrl') && ($('lbUrl').value = CFG.url);
      $('lbKey') && ($('lbKey').value = CFG.key);
    }
    if (tok()) {
      showMe();
      resume();
    } else {
      showAuth();
      status('没有账号就输入名字和密码点注册', 'idle');
    }
    loadBoard();
  }

  /* 回到页面：拿令牌换身份 */
  async function resume() {
    try {
      const me = await rpc('api_me', { p_token: tok() });
      if (!me || !me.ok) { setTok(''); showAuth(); status('登录已过期，请重新登录', 'off'); return; }
      setName(me.name);
      role = me.role || 'user';
      showMe(me.name);
      status('云端 ' + fmt(me.total), 'ok');
      if (role === 'admin') { $('adminBox') && $('adminBox').classList.remove('hidden'); loadAdmin(); }
      applyServer(me);
      sync('boot');
    } catch (e) { status('连不上服务器，稍后自动重试', 'off'); }
  }

  /* 服务器解锁了新星球：本地直接跳过去 */
  function applyServer(res) {
    const st = S();
    if (!st || !res) return;
    const p = Number(res.planets) || 1;
    if (p > 1 && (st.world || 0) < p - 1) {
      const before = st.world || 0;
      st.world = p - 1;
      if (window.DD) {
        try { window.DD.save(); window.DD.render(); } catch (e) {}
      }
      if ((st.world || 0) > before) toast('🪐 管理员给你解锁了第 ' + (st.world + 1) + ' 颗星球');
    }
  }

  /* ========== 3. 上传分数 ========== */
  async function sync(reason) {
    const st = S();
    if (!st) return;
    if (!ready()) { status('排行榜还没开通', 'off'); return; }
    if (!tok()) { status('登录后才会保存进度', 'idle'); return; }
    if (busy) return;
    if (reason !== 'manual' && Date.now() < holdUntil) return;

    const total = Math.floor(st.total || 0);
    busy = true;
    status('同步中…', 'busy');

    try {
      const res = await rpc('api_submit', {
        p_token: tok(),
        p_total: total,
        p_clicks: Math.floor(st.clicks || 0),
        p_planet: Math.floor((st.world || 0) + 1)
      });
      accept(res, total);
    } catch (e) {
      status('连不上服务器，稍后自动重试', 'off');
    } finally {
      busy = false;
    }
    if (reason === 'manual') loadBoard(true);
  }

  function accept(res, sentTotal) {
    const st = S();
    if (!res || typeof res.total === 'undefined') { status('服务器回包异常', 'bad'); return; }

    if (res.ok) {
      lastPushed = sentTotal;
      const sv = Number(res.total);
      if (sv > (st.total || 0) + 1) {
        st.total = sv;
        // 星尘是玩家自己的钱包，云端总分只往上对齐，绝不下砍
        if (window.DD) { try { window.DD.save(); window.DD.render(); } catch (e) {} }
        status('已恢复云端存档 · ' + fmt(sv), 'ok');
        toast('☁️ 已载入云端存档');
      } else if (res.unverified) {
        status('已同步 · 本次涨幅较大，后台会看到标记', 'warn');
      } else {
        status('已同步 · 云端 ' + fmt(sv), 'ok');
      }
      applyServer(res);
      return;
    }

    if (res.reason === 'need_login') { setTok(''); showAuth(); status('请先登录再上传', 'off'); return; }

    if (res.severity === 'hard') {
      // 只影响排行榜名次，绝不碰本地星尘和等级；暂停一会儿自动同步，别一直撞同一堵墙
      holdUntil = Date.now() + 15 * 60 * 1000;
      status('云端认为涨得太快，先搁置同步（星尘没动）', 'warn');
      toast('☁️ 云端觉得涨太快，稍后再同步，星尘不受影响');
    } else {
      status('上传被拒绝：' + (res.reason || '未知'), 'bad');
    }
  }

  /* ========== 4. 排行榜 ========== */
  let boardLoading = false;

  async function loadBoard(showTip) {
    const list = $('lbList');
    if (!list) return;
    if (!ready()) { renderBoard([], '排行榜还没开通'); return; }
    if (boardLoading) return;
    boardLoading = true;
    try {
      const rows = await rpc('api_board', { p_limit: 50 });
      renderBoard(Array.isArray(rows) ? rows : []);
    } catch (e) {
      renderBoard([], '排行榜加载失败，检查网络');
    } finally {
      boardLoading = false;
    }
  }

  function renderBoard(rows, emptyText) {
    const list = $('lbList');
    if (!list) return;
    list.innerHTML = '';

    if (!rows.length) {
      const p = document.createElement('p');
      p.className = 'panel-tip small';
      p.textContent = emptyText || '还没有人上榜，你上传一次就是第一名';
      list.appendChild(p);
      return;
    }

    const me = (myName() || '').toLowerCase();
    rows.forEach((r) => {
      const li = document.createElement('li');
      li.className = 'lb-row' + (String(r.name || '').toLowerCase() === me ? ' me' : '');

      const pos = document.createElement('span');
      pos.className = 'lb-pos';
      pos.textContent = (Number(r.pos) <= 3 ? ['🥇', '🥈', '🥉'][Number(r.pos) - 1] : '#' + r.pos);

      const nm = document.createElement('span');
      nm.className = 'lb-name';
      nm.textContent = r.name || '无名旅人';
      if (r.planets) {
        const pl = document.createElement('span');
        pl.className = 'lb-tag';
        pl.textContent = 'P' + r.planets;
        nm.appendChild(pl);
      }
      if (r.suspicious) {
        const tag = document.createElement('span');
        tag.className = 'lb-tag warn';
        tag.textContent = '待查';
        tag.title = '这个分数有过异常上传，站长还没判';
        nm.appendChild(tag);
      }

      const sc = document.createElement('span');
      sc.className = 'lb-score';
      sc.textContent = fmt(r.total);

      li.append(pos, nm, sc);
      list.appendChild(li);
    });
  }

  /* ========== 5. 管理员后台 ========== */
  async function loadAdmin() {
    const box = $('adminList');
    if (!box) return;
    box.innerHTML = '<p class="panel-tip small">读取中…</p>';
    try {
      const res = await rpc('api_admin_list', { p_token: tok() });
      if (!res || !res.ok) { box.innerHTML = ''; return; }
      renderAdmin(res.rows || []);
    } catch (e) {
      box.innerHTML = '<p class="panel-tip small">后台加载失败</p>';
    }
  }

  function renderAdmin(rows) {
    const box = $('adminList');
    if (!box) return;
    box.innerHTML = '';
    if (!rows.length) {
      box.innerHTML = '<p class="panel-tip small">还没有用户</p>';
      return;
    }

    rows.forEach((u) => {
      const row = document.createElement('div');
      row.className = 'admin-row' + (u.red ? ' red' : '');

      const head = document.createElement('div');
      head.className = 'admin-head';
      const nm = document.createElement('b');
      nm.textContent = u.name + (u.role === 'admin' ? '（管理员）' : '');
      const sum = document.createElement('span');
      sum.className = 'small';
      sum.textContent = fmt(u.total) + ' · P' + u.planets + ' · ' + u.age_hours + ' 小时';
      head.append(nm, sum);

      row.appendChild(head);

      if (u.why) {
        const why = document.createElement('div');
        why.className = 'admin-why';
        why.textContent = '⚠ ' + u.why;
        row.appendChild(why);
      }
      if (u.verdict === 'ok') {
        const v = document.createElement('div');
        v.className = 'admin-why ok';
        v.textContent = '✓ 已判为真玩家';
        row.appendChild(v);
      }
      if (u.verdict === 'cheat') {
        const v = document.createElement('div');
        v.className = 'admin-why';
        v.textContent = '✕ 已判假，不上榜';
        row.appendChild(v);
      }

      const acts = document.createElement('div');
      acts.className = 'admin-acts';

      const bGrant = document.createElement('button');
      bGrant.className = 'ghost tiny';
      bGrant.textContent = '+星尘';
      bGrant.addEventListener('click', async () => {
        const v = window.prompt('给「' + u.name + '」加多少星尘？（1 – 10000 亿）', '1000000');
        if (v === null) return;
        const n = Number(v.replace(/[,，\s]/g, ''));
        if (!isFinite(n) || n <= 0) { toast('数字不对'); return; }
        await adminCall('api_admin_grant', { p_name: u.name, p_amount: n }, '已加 ' + fmt(n));
      });

      const bUnlock = document.createElement('button');
      bUnlock.className = 'ghost tiny';
      bUnlock.textContent = '解锁星球';
      bUnlock.addEventListener('click', async () => {
        const v = window.prompt('给「' + u.name + '」解锁到第几颗星球？（1 – 6）', String(Math.min(6, (u.planets || 1) + 1)));
        if (v === null) return;
        const p = Math.floor(Number(v));
        if (!(p >= 1 && p <= 6)) { toast('只能是 1 到 6'); return; }
        await adminCall('api_admin_unlock', { p_name: u.name, p_planets: p }, '已解锁到第 ' + p + ' 颗');
      });

      const bOk = document.createElement('button');
      bOk.className = 'ghost tiny';
      bOk.textContent = '判真';
      bOk.addEventListener('click', () => adminCall('api_admin_judge', { p_name: u.name, p_verdict: 'ok' }, '已判为真'));

      const bBad = document.createElement('button');
      bBad.className = 'ghost tiny';
      bBad.textContent = '判假';
      bBad.addEventListener('click', () => adminCall('api_admin_judge', { p_name: u.name, p_verdict: 'cheat' }, '已判假，掉榜'));

      acts.append(bGrant, bUnlock, bOk, bBad);
      row.appendChild(acts);
      box.appendChild(row);
    });
  }

  async function adminCall(fn, body, okTip) {
    try {
      const res = await rpc(fn, Object.assign({ p_token: tok() }, body));
      if (!res || !res.ok) { toast((res && res.reason) || '操作失败'); return; }
      toast(okTip || '好了');
      loadAdmin();
      loadBoard();
    } catch (e) { toast('连不上服务器'); }
  }

  /* ========== 6. 自动上传 ========== */
  const AUTO_EVERY = 20000;

  function tick() {
    const st = S();
    if (!st || !ready() || !tok()) return;
    const now = Date.now();
    if (now < holdUntil) return;
    if (now - tickAt < AUTO_EVERY) return;
    tickAt = now;
    if (Math.floor(st.total || 0) === lastPushed) return;
    sync('auto');
  }

  function flush() {
    const st = S();
    if (!st || !ready() || !tok()) return;
    const total = Math.floor(st.total || 0);
    if (total === lastPushed) return;
    try {
      fetch(CFG.url.replace(/\/+$/, '') + '/rest/v1/rpc/api_submit', {
        method: 'POST',
        keepalive: true,
        headers: hdr(),
        body: JSON.stringify({
          p_token: tok(),
          p_total: total,
          p_clicks: Math.floor(st.clicks || 0),
          p_planet: Math.floor((st.world || 0) + 1)
        })
      });
      lastPushed = total;
    } catch (e) {}
  }

  /* ========== 7. 启动 ========== */
  function boot() {
    buildUI();

    document.querySelectorAll('.tab').forEach((t) => {
      if (t.dataset.tab === 'leader') {
        t.addEventListener('click', () => {
          loadBoard();
          if (role === 'admin') loadAdmin();
        });
      }
    });

    setInterval(tick, 4000);
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', flush);
    document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
    window.addEventListener('online', () => sync('online'));
  }

  window.Cloud = {
    sync: () => sync('manual'),
    board: () => loadBoard(true),
    admin: () => loadAdmin(),
    get ready() { return ready(); },
    get logged() { return !!tok(); }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
