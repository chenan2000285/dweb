-- ============================================================
-- 点点星球 · 账号 + 排行榜 + 管理员后台 + 防作弊
-- 用法：Supabase 控制台 → SQL Editor → New query → 整段粘贴 → Run
-- 可以重复跑（都是 if not exists / or replace）
-- ============================================================

create extension if not exists pgcrypto;

-- 1. 用户表：密码只存加密结果，前端永远读不到表
create table if not exists public.users (
  id           uuid primary key default gen_random_uuid(),
  username     text unique not null,           -- 登录名，也是榜上显示的名字
  pw           text not null,                  -- crypt(pass, gen_salt('bf'))
  role         text not null default 'user',   -- user / admin
  total        numeric not null default 0,
  clicks       numeric not null default 0,
  planets      int  not null default 1,        -- 已解锁到第几颗星球（1-6）
  unverified   boolean not null default false, -- 最近一次上传有跳变
  hard_rejects int  not null default 0,        -- 被硬拒次数（越大越可疑）
  verdict      text,                           -- 管理员判定：null 未判 / 'ok' 真 / 'cheat' 假
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  last_seen    timestamptz
);

-- 补列（老表重复跑不报错）
alter table public.users add column if not exists planets      int  not null default 1;
alter table public.users add column if not exists unverified   boolean not null default false;
alter table public.users add column if not exists hard_rejects int  not null default 0;
alter table public.users add column if not exists verdict      text;

create index if not exists users_total_idx on public.users (total desc);

-- 2. 会话表：登录后发一个随机令牌，客户端存在 localStorage
create table if not exists public.sessions (
  token      text primary key,
  uid        uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists sessions_uid_idx on public.sessions (uid);

-- 3. 关死直连：开 RLS 且不建任何 policy
alter table public.users    enable row level security;
alter table public.sessions enable row level security;

-- ============================================================
-- 内部小工具
-- ============================================================
create or replace function public._uid(p_token text) returns uuid
language sql security definer set search_path = public, extensions as $$
  select uid from public.sessions where token = p_token and expires_at > now();
$$;

create or replace function public._admin(p_token text) returns uuid
language sql security definer set search_path = public, extensions as $$
  select s.uid from public.sessions s
    join public.users u on u.id = s.uid
   where s.token = p_token and s.expires_at > now() and u.role = 'admin';
$$;

-- ============================================================
-- 4. 注册 / 登录 / 我是谁 / 退出
-- ============================================================
create or replace function public.api_register(p_user text, p_pass text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare v_uid uuid; v_tok text; v_name text;
begin
  v_name := btrim(coalesce(p_user, ''));
  if length(v_name) < 2 or length(v_name) > 16 then
    return jsonb_build_object('ok', false, 'reason', '账号要 2 到 16 个字');
  end if;
  if p_pass is null or length(p_pass) < 4 then
    return jsonb_build_object('ok', false, 'reason', '密码至少 4 位');
  end if;
  if exists (select 1 from public.users where lower(username) = lower(v_name)) then
    return jsonb_build_object('ok', false, 'reason', '这个名字已经有人用了');
  end if;

  insert into public.users (username, pw) values (v_name, crypt(p_pass, gen_salt('bf')))
    returning id into v_uid;

  v_tok := encode(gen_random_bytes(24), 'hex');
  insert into public.sessions (token, uid, expires_at)
    values (v_tok, v_uid, now() + interval '90 days');

  return jsonb_build_object('ok', true, 'token', v_tok, 'name', v_name, 'role', 'user');
end $$;

create or replace function public.api_login(p_user text, p_pass text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare r record; v_tok text;
begin
  select * into r from public.users where lower(username) = lower(btrim(coalesce(p_user, '')));
  -- 账号不存在和密码错误给同一句话，不告诉对方名字是否存在
  if not found or r.pw <> crypt(coalesce(p_pass, ''), r.pw) then
    return jsonb_build_object('ok', false, 'reason', '账号或密码不对');
  end if;

  update public.users set last_seen = now() where id = r.id;

  v_tok := encode(gen_random_bytes(24), 'hex');
  insert into public.sessions (token, uid, expires_at)
    values (v_tok, r.id, now() + interval '90 days');

  return jsonb_build_object('ok', true, 'token', v_tok, 'name', r.username,
                            'role', r.role, 'total', r.total, 'planets', r.planets);
end $$;

create or replace function public.api_me(p_token text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare r record; v_uid uuid;
begin
  v_uid := public._uid(p_token);
  if v_uid is null then return jsonb_build_object('ok', false, 'reason', '请先登录'); end if;

  select * into r from public.users where id = v_uid;
  if not found then return jsonb_build_object('ok', false, 'reason', '请先登录'); end if;

  return jsonb_build_object('ok', true, 'name', r.username, 'role', r.role,
                            'total', r.total, 'planets', r.planets,
                            'unverified', r.unverified, 'verdict', r.verdict,
                            'created_at', r.created_at);
end $$;

create or replace function public.api_logout(p_token text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
begin
  delete from public.sessions where token = p_token;
  return jsonb_build_object('ok', true);
end $$;

-- ============================================================
-- 5. 上传分数（唯一写入口）
-- ============================================================
create or replace function public.api_submit(
  p_token text, p_total numeric, p_clicks numeric, p_planet int default 1
) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_uid uuid;
  r record;
  v_allow numeric;
  v_delta numeric;
  v_planet int;
begin
  v_uid := public._uid(p_token);
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'need_login', 'severity', 'hard');
  end if;

  select * into r from public.users where id = v_uid;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'need_login', 'severity', 'hard');
  end if;

  p_total  := greatest(coalesce(p_total, 0), 0);
  p_clicks := greatest(coalesce(p_clicks, 0), 0);
  v_planet := least(greatest(coalesce(p_planet, 1), 1), 6);

  -- 天花板：没人能到 1000 万亿，到了就不是玩出来的
  if p_total > 1e15 then
    update public.users set hard_rejects = hard_rejects + 1, updated_at = now() where id = v_uid;
    return jsonb_build_object('ok', false, 'reason', 'ceiling', 'severity', 'hard',
                              'total', r.total, 'hard_rejects', r.hard_rejects + 1);
  end if;

  -- 本地比服务器低：以服务器为准
  if p_total <= r.total then
    update public.users set last_seen = now(), planets = greatest(planets, v_planet) where id = v_uid;
    return jsonb_build_object('ok', true, 'total', r.total, 'adopted', false,
                              'planets', greatest(r.planets, v_planet),
                              'hard_rejects', r.hard_rejects);
  end if;

  -- 一次最多涨 20 倍，或绝对量 1 万以内（新手期倍数没意义）
  v_allow := greatest(r.total * 20, 1e4);
  v_delta := p_total - r.total;

  if v_delta > v_allow then
    -- 离谱：拒收，本地回滚成服务器值
    if v_delta > v_allow * 100 then
      update public.users
         set hard_rejects = hard_rejects + 1, updated_at = now(), last_seen = now()
       where id = v_uid;
      return jsonb_build_object('ok', false, 'reason', 'jump', 'severity', 'hard',
                                'total', r.total, 'hard_rejects', r.hard_rejects + 1);
    end if;
    -- 偏大：收下但标未验证，不扣分不删号
    update public.users
       set total = p_total, clicks = greatest(clicks, p_clicks),
           planets = greatest(planets, v_planet), unverified = true,
           updated_at = now(), last_seen = now()
     where id = v_uid;
    return jsonb_build_object('ok', true, 'total', p_total, 'adopted', true,
                              'planets', greatest(r.planets, v_planet),
                              'unverified', true, 'hard_rejects', r.hard_rejects);
  end if;

  -- 正常
  update public.users
     set total = p_total, clicks = greatest(clicks, p_clicks),
         planets = greatest(planets, v_planet), unverified = false,
         updated_at = now(), last_seen = now()
   where id = v_uid;

  return jsonb_build_object('ok', true, 'total', p_total, 'adopted', true,
                            'planets', greatest(r.planets, v_planet),
                            'unverified', false, 'hard_rejects', r.hard_rejects);
end $$;

-- ============================================================
-- 6. 排行榜：判为假的（verdict='cheat'）不上榜
-- ============================================================
create or replace function public.api_board(p_limit int default 50) returns table (
  pos int, name text, total numeric, planets int, suspicious boolean, created_at timestamptz
) language sql security definer set search_path = public, extensions as $$
  select (row_number() over (order by total desc, updated_at asc))::int,
         username, total, planets,
         (unverified or hard_rejects >= 1),
         created_at
    from public.users
   where coalesce(verdict, '') <> 'cheat'
   order by total desc, updated_at asc
   limit least(greatest(coalesce(p_limit, 50), 1), 100);
$$;

-- ============================================================
-- 7. 管理员后台（只有 role='admin' 的令牌能用）
--    注意：故意【没有】删除用户的函数 —— 谁都删不了号
-- ============================================================
create or replace function public.api_admin_list(p_token text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare v_uid uuid; v_out jsonb;
begin
  v_uid := public._admin(p_token);
  if v_uid is null then return jsonb_build_object('ok', false, 'reason', '不是管理员'); end if;

  select coalesce(jsonb_agg(row_to_json(t) order by t.red desc, t.total desc), '[]'::jsonb)
    into v_out
    from (
      select u.username as name,
             u.total,
             u.clicks,
             u.planets,
             u.role,
             u.verdict,
             u.unverified,
             u.hard_rejects,
             round(extract(epoch from (now() - u.created_at)) / 3600.0, 1) as age_hours,
             coalesce(u.last_seen, u.created_at) as last_seen,
             -- ===== 自动标红规则（只提示，不处罚，由你人工判定） =====
             (
               (extract(epoch from (now() - u.created_at)) < 86400 and u.total >= 1e9)
               or (extract(epoch from (now() - u.created_at)) < 86400 and u.planets >= 6)
               or u.total >= 1e12
               or (u.total >= 1e9 and u.clicks < 500)
               or u.hard_rejects >= 3
               or u.unverified
             ) as red,
             case
               when extract(epoch from (now() - u.created_at)) < 86400 and u.planets >= 6
                    then '一天内通关'
               when extract(epoch from (now() - u.created_at)) < 86400 and u.total >= 1e9
                    then '一天内过 10 亿'
               when u.total >= 1e12 then '分数过万亿'
               when u.total >= 1e9 and u.clicks < 500 then '点击数对不上'
               when u.hard_rejects >= 3 then '被拒 3 次以上'
               when u.unverified then '上传有跳变'
               else ''
             end as why
        from public.users u
    ) t;

  return jsonb_build_object('ok', true, 'rows', v_out);
end $$;

-- 手动加星尘：只加不减，最多一次 1 万亿
create or replace function public.api_admin_grant(p_token text, p_name text, p_amount numeric)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_uid uuid; v_new numeric;
begin
  v_uid := public._admin(p_token);
  if v_uid is null then return jsonb_build_object('ok', false, 'reason', '不是管理员'); end if;
  if p_amount is null or p_amount <= 0 or p_amount > 1e12 then
    return jsonb_build_object('ok', false, 'reason', '一次只能加 0 到 1 万亿');
  end if;

  update public.users
     set total = total + p_amount, updated_at = now()
   where lower(username) = lower(btrim(p_name))
   returning total into v_new;
  if v_new is null then return jsonb_build_object('ok', false, 'reason', '找不到这个用户'); end if;

  return jsonb_build_object('ok', true, 'total', v_new);
end $$;

-- 解锁星球：只能往前解锁，1-6
create or replace function public.api_admin_unlock(p_token text, p_name text, p_planets int)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_uid uuid; v_new int;
begin
  v_uid := public._admin(p_token);
  if v_uid is null then return jsonb_build_object('ok', false, 'reason', '不是管理员'); end if;
  if p_planets is null or p_planets < 1 or p_planets > 6 then
    return jsonb_build_object('ok', false, 'reason', '星球只有 1 到 6');
  end if;

  update public.users
     set planets = greatest(planets, p_planets), updated_at = now()
   where lower(username) = lower(btrim(p_name))
   returning planets into v_new;
  if v_new is null then return jsonb_build_object('ok', false, 'reason', '找不到这个用户'); end if;

  return jsonb_build_object('ok', true, 'planets', v_new);
end $$;

-- 人工判定：'ok' = 真玩家（不再标红），'cheat' = 假的（掉榜），null = 撤销判定
create or replace function public.api_admin_judge(p_token text, p_name text, p_verdict text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_uid uuid; v_name text;
begin
  v_uid := public._admin(p_token);
  if v_uid is null then return jsonb_build_object('ok', false, 'reason', '不是管理员'); end if;
  if p_verdict is not null and p_verdict not in ('ok', 'cheat') then
    return jsonb_build_object('ok', false, 'reason', '判定只有 ok / cheat');
  end if;

  update public.users set verdict = p_verdict, updated_at = now()
   where lower(username) = lower(btrim(p_name))
   returning username into v_name;
  if v_name is null then return jsonb_build_object('ok', false, 'reason', '找不到这个用户'); end if;

  return jsonb_build_object('ok', true, 'name', v_name, 'verdict', p_verdict);
end $$;

-- ============================================================
-- 8. 只把接口函数交给前端，表本身依然碰不到
-- ============================================================
grant execute on function public.api_register(text, text) to anon, authenticated;
grant execute on function public.api_login(text, text)    to anon, authenticated;
grant execute on function public.api_me(text)             to anon, authenticated;
grant execute on function public.api_logout(text)         to anon, authenticated;
grant execute on function public.api_submit(text, numeric, numeric, int) to anon, authenticated;
grant execute on function public.api_board(int)           to anon, authenticated;
grant execute on function public.api_admin_list(text)     to anon, authenticated;
grant execute on function public.api_admin_grant(text, text, numeric) to anon, authenticated;
grant execute on function public.api_admin_unlock(text, text, int)    to anon, authenticated;
grant execute on function public.api_admin_judge(text, text, text)    to anon, authenticated;

-- ============================================================
-- 9. 建管理员：先正常注册一个账号（比如你自己），然后把名字填进去跑这一句
-- ============================================================
-- update public.users set role = 'admin' where username = '你的账号名';

-- 完成。
