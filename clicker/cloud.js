// 点点星球 · 云同步 + 排行榜 + 防作弊（客户端）
// 原则：分数属于服务器，本地只是一个缓存。
// 本地改的分数，下一次上传会被服务器拒收并被真值覆盖。
(() => {
  'use strict';

  /* ========== 1. 先填这两个值（Supabase 控制台 → Project Settings → API） ========== */
  const CFG = {
    url: '',   // 例如 https://abcdefgh.supabase.co
    key: ''    // anon public 那一串
  };

  /* ========== 2. 基础设施 ========== */
  const K = {
    cfg:  'aiweb.clicker.cloud',
    pid:  'aiweb.clicker.pid',
    name: 'aiweb.clicker.name'
  };

  function cfg() {
    const c = Object.assign({}, CFG);
    try {
      const saved = JSON.parse(localStorage.getItem(K.cfg) || '{}');
      if (saved.url) c.url = saved.url;
      if (saved.key) c.key = saved.key;
    } catch (e) {}
    return c;
  }
  const ready = () => {
    const c = cfg();
    return !!(c.url && c.key);
  };

  function pid() {
    let v = '';
    try { v = localStorage.getItem(K.pid) || ''; } catch (e) {}
    if (v) return v;
    v = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
    try { localStorage.setItem(K.pid, v); } catch (e) {}
    return v;
  }

  function myName() {
    try { return localStorage.getItem(K.name) || ''; } catch (e) { return ''; }
  }
  function setName(v) {
    try { localStorage.setItem(K.name, v); } catch (e) {}
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

  async function rpc(fn, body) {
    const c = cfg();
    if (!c.url || !c.key) throw new Error('nosetup');
    const r = await fetch(c.url.replace(/\/+$/, '') + '/rest/v1/rpc/' + fn, {
      method: 'POST',
      headers: {
        'apikey': c.key,
        'Authorization': 'Bearer ' + c.key,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body || {})
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }

  /* ========== 3. 界面 ========== */
  const $ = (id) => document.getElementById(id);
  let ui = null;

  function buildUI() {
    const list = $('lbList');
    if (!list) return;

    const nameInput = $('lbName');
    if (nameInput) {
      nameInput.value = myName();
      nameInput.addEventListener('change', () => {
        setName(nameInput.value.trim().slice(0, 16));
        sync('name');
      });
      nameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { nameInput.blur(); sync('name'); }
      });
    }

    const syncBtn = $('lbSync');
    if (syncBtn) syncBtn.addEventListener('click', () => sync('manual'));

    const refresh = $('lbRefresh');
    if (refresh) refresh.addEventListener('click', () => loadBoard(true));

    ui = { list, status: $('lbStatus'), nameInput };

    const saveBtn = $('lbSave');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        const u = ($('lbUrl') && $('lbUrl').value || '').trim().replace(/\/+$/, '');
        const k = ($('lbKey') && $('lbKey').value || '').trim();
        if (!/^https?:\/\//.test(u) || k.length < 20) {
          status('地址或 key 看起来不对', 'bad');
          return;
        }
        try { localStorage.setItem(K.cfg, JSON.stringify({ url: u, key: k })); } catch (e) {}
        refreshSetup();
        status('已连接，正在上传…', 'busy');
        sync('manual');
      });
    }
    refreshSetup();

    status(ready() ? '等待同步' : '未配置云端', ready() ? 'idle' : 'off');
  }

  function refreshSetup() {
    const box = $('lbSetup');
    if (box) box.classList.toggle('hidden', ready());
  }

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

  /* ========== 4. 核心：把分数交给服务器，然后听它的 ========== */
  let busy = false;
  let tickAt = 0;
  let lastPushed = -1;

  async function sync(reason) {
    const st = S();
    if (!st) return;
    if (!ready()) { status('未配置云端', 'off'); return; }
    if (busy) return;

    const total = Math.floor(st.total || 0);
    busy = true;
    status('同步中…', 'busy');

    try {
      const res = await rpc('submit_progress', {
        p_id: pid(),
        p_name: myName() || '无名星际旅人',
        p_total: total,
        p_clicks: Math.floor(st.clicks || 0)
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
    const sv = Number(res && res.total);
    if (!isFinite(sv)) { status('服务器回包异常', 'bad'); return; }

    // 收下了
    if (res.ok) {
      lastPushed = sentTotal;
      if (sv > st.total + 1) {
        // 服务器比本地多：换手机、清了缓存、或者刚才被回滚过 → 以服务器为准
        adopt(sv);
        status('已恢复云端存档 · ' + fmt(sv), 'ok');
        toast('☁️ 已载入云端存档');
      } else {
        status('已同步 · 云端 ' + fmt(sv), 'ok');
      }
      return;
    }

    // 被拒了
    if (res.severity === 'hard') {
      // 服务器直接替换本地：这就是"你本地改了，服务器不认"
      adopt(sv);
      status('分数异常，已回滚到云端 ' + fmt(sv), 'bad');
      toast('⚠️ 检测到异常分数，已回滚到云端记录');
    } else if (res.reason === 'fast') {
      // 轻微超速：这次不记分，本地保留，下一次老实上传就能收
      status('本次上传过快，未记入排行', 'warn');
    } else {
      status('上传被拒绝：' + (res.reason || '未知'), 'bad');
    }
  }

  // 以服务器的值为准，覆盖本地
  function adopt(v) {
    const st = S();
    if (!st) return;
    if (st.total > v) {
      st.total = v;
      if (st.dust > v) st.dust = v;
    } else {
      st.total = v;
    }
    if (window.DD) {
      try { window.DD.save(); window.DD.render(); } catch (e) {}
    }
  }

  /* ========== 5. 排行榜 ========== */
  let boardLoading = false;

  async function loadBoard(showTip) {
    if (!ready()) {
      renderBoard([], '还没接上服务器，先去 supabase.sql 那一步建好后端');
      return;
    }
    if (boardLoading) return;
    boardLoading = true;
    try {
      const rows = await rpc('leaderboard', { p_limit: 50 });
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

    const me = pid();
    rows.forEach((r) => {
      const li = document.createElement('li');
      li.className = 'lb-row' + (r.id === me ? ' me' : '') + (Number(r.flagged) > 0 ? ' suspect' : '');

      const pos = document.createElement('span');
      pos.className = 'lb-pos';
      pos.textContent = (Number(r.pos) <= 3 ? ['🥇', '🥈', '🥉'][Number(r.pos) - 1] : '#' + r.pos);

      const nm = document.createElement('span');
      nm.className = 'lb-name';
      nm.textContent = r.name || '无名星际旅人';

      const sc = document.createElement('span');
      sc.className = 'lb-score';
      sc.textContent = fmt(r.total);

      li.append(pos, nm, sc);
      list.appendChild(li);
    });
  }

  /* ========== 6. 什么时候上传：你说什么时候就什么时候 ========== */
  const AUTO_EVERY = 20000;   // 有变化就 20 秒补一次
  const IDLE_LIMIT = 0.5;     // 分数没动就不传

  function tick() {
    const st = S();
    if (!st || !ready()) return;
    const now = Date.now();
    if (now - tickAt < AUTO_EVERY) return;
    tickAt = now;

    const total = Math.floor(st.total || 0);
    if (total === lastPushed) return;
    sync('auto');
  }

  function flush() {
    const st = S();
    if (!st || !ready()) return;
    const total = Math.floor(st.total || 0);
    if (total === lastPushed) return;
    // 关页面/切后台也要发出去，keepalive 保证请求不被中断
    const c = cfg();
    try {
      fetch(c.url.replace(/\/+$/, '') + '/rest/v1/rpc/submit_progress', {
        method: 'POST',
        keepalive: true,
        headers: {
          'apikey': c.key,
          'Authorization': 'Bearer ' + c.key,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          p_id: pid(),
          p_name: myName() || '无名星际旅人',
          p_total: total,
          p_clicks: Math.floor(st.clicks || 0)
        })
      });
      lastPushed = total;
    } catch (e) {}
  }

  /* ========== 7. 启动 ========== */
  function boot() {
    buildUI();

    // 排行的 tab 是懒加载的：点开才去拉
    document.querySelectorAll('.tab').forEach((t) => {
      if (t.dataset.tab === 'leader') {
        t.addEventListener('click', () => loadBoard());
      }
    });

    setInterval(tick, 4000);
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', flush);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) flush();
    });
    window.addEventListener('online', () => sync('online'));

    // 开局先对一次账：服务器领先就把本地拉回去
    if (ready()) setTimeout(() => sync('boot'), 2500);
  }

  // 给控制台/调试用
  window.Cloud = {
    sync: () => sync('manual'),
    board: () => loadBoard(true),
    setConfig: (url, key) => {
      try { localStorage.setItem(K.cfg, JSON.stringify({ url, key })); } catch (e) {}
      status('已保存配置', 'ok');
    },
    get ready() { return ready(); },
    get pid() { return pid(); }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
