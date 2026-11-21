-- ============================================================
-- 点点星球 · 云端存档 + 排行榜 + 防作弊
-- 用法：Supabase 控制台 → 左侧 SQL Editor → New query → 整段粘贴 → Run
-- 只跑一次，重复跑也不会报错（都是 if not exists / or replace）
-- ============================================================

-- 1. 玩家表：分数只存在这里，前端没有写权限
create table if not exists public.players (
  id          text primary key,              -- 设备随机 ID
  name        text not null default '无名星际旅人',
  total       numeric not null default 0,    -- 累计星尘（排行榜依据）
  clicks      numeric not null default 0,
  imported    boolean not null default false,-- 首次上传带进来的旧进度
  unverified  boolean not null default false,-- 最近一次上传跳变过大，未验证
  flagged     int  not null default 0,       -- 被硬拒次数，到 3 就下榜
  last_reason text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 已经建过表的，补上新列（重复跑不报错）
alter table public.players add column if not exists imported   boolean not null default false;
alter table public.players add column if not exists unverified boolean not null default false;

create index if not exists players_total_idx on public.players (total desc);

-- 2. 打开行级权限，并且【不建任何 policy】
--    这样 anon key 碰不到表：既不能读，也不能写
alter table public.players enable row level security;

-- 3. 唯一的上传入口：服务器自己判断该不该收
create or replace function public.submit_progress(
  p_id text, p_name text, p_total numeric, p_clicks numeric
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_old     numeric;
  v_flag    int;
  v_allow   numeric;
  v_delta   numeric;
  v_name    text;
begin
  -- 基本格式检查
  if p_id is null or length(p_id) < 8 or length(p_id) > 64 then
    return jsonb_build_object('ok', false, 'reason', 'bad_id', 'severity', 'soft');
  end if;

  v_name  := left(coalesce(nullif(trim(p_name), ''), '无名星际旅人'), 16);
  p_total := greatest(coalesce(p_total, 0), 0);
  p_clicks:= greatest(coalesce(p_clicks, 0), 0);

  -- 硬天花板：超过就不收，绝不让本地把它覆盖进来
  select total, flagged into v_old, v_flag from players where id = p_id;

  if p_total > 1e15 then
    return jsonb_build_object('ok', false, 'reason', 'ceiling',
                              'severity', 'hard', 'total', coalesce(v_old, 0),
                              'flagged', coalesce(v_flag, 0));
  end if;

  if not found then
    -- 第一次来：旧进度一律收下，不再设首登上限。
    -- 你离线玩了多久、攒了多少，服务器没有资格判断。
    -- 代价是首登值无法验证，所以 >= 100 万的记为「离线导入」，排行榜上单独标示。
    insert into players (id, name, total, clicks, imported, unverified)
    values (p_id, v_name, p_total, p_clicks,
            p_total >= 1e6, p_total >= 1e6);
    return jsonb_build_object('ok', true, 'total', p_total, 'adopted', true,
                              'flagged', 0, 'imported', p_total >= 1e6,
                              'unverified', p_total >= 1e6);
  end if;

  -- 本地比服务器低：以服务器为准（换机 / 清缓存 / 被回滚过）
  if p_total <= v_old then
    update players set name = v_name where id = p_id;
    return jsonb_build_object('ok', true, 'total', v_old, 'adopted', false, 'flagged', v_flag);
  end if;

  -- 允许的正常跳变：一次最多涨 20 倍，或绝对量 1 万点以内（新手期倍数没意义）
  -- 为什么是 20 倍：换星球 ×4、转生 ×1.6^n、挂机收益、攒钱买倍数升级，
  -- 这些叠起来一次翻十几倍是正常玩法，按"每秒多少点"算会冤枉人。
  v_allow := greatest(v_old * 20, 1e4);
  v_delta := p_total - v_old;

  if v_delta > v_allow then
    -- 离谱到没边：拒收，本地会被回滚成服务器值
    if v_delta > v_allow * 100 then
      update players
         set flagged = flagged + 1, last_reason = 'jump', updated_at = now()
       where id = p_id;
      return jsonb_build_object('ok', false, 'reason', 'jump', 'severity', 'hard',
                                'total', v_old, 'flagged', v_flag + 1,
                                'unverified', true);
    end if;
    -- 跳得偏大：收下，只是标成未验证。不清分、不惩罚、不扣名次。
    update players
       set total = p_total, clicks = greatest(clicks, p_clicks), name = v_name,
           unverified = true, last_reason = 'jump', updated_at = now()
     where id = p_id;
    return jsonb_build_object('ok', true, 'total', p_total, 'adopted', true,
                              'flagged', v_flag, 'unverified', true);
  end if;

  -- 正常：收下，并把被拒次数往回减（老实玩了就既往不咎）
  update players
     set total = p_total, clicks = greatest(clicks, p_clicks), name = v_name,
         unverified = false, flagged = greatest(0, flagged - 1), last_reason = null,
         updated_at = now()
   where id = p_id;

  return jsonb_build_object('ok', true, 'total', p_total, 'adopted', true,
                            'flagged', v_flag, 'unverified', false);
end $$;

-- 4. 排行榜：可疑次数 >= 3 的自动掉榜
create or replace function public.leaderboard(p_limit int default 50)
returns table (pos int, id text, name text, total numeric, flagged int,
               imported boolean, unverified boolean)
language sql security definer set search_path = public as $$
  select (row_number() over (order by total desc, updated_at asc))::int as pos,
         id, name, total, flagged, imported, unverified
    from public.players
   where flagged < 3
   order by total desc, updated_at asc
   limit least(greatest(coalesce(p_limit, 50), 1), 100);
$$;

-- 5. 只把这两个函数的调用权交给前端，表本身依然碰不到
grant execute on function public.submit_progress(text, text, numeric, numeric) to anon, authenticated;
grant execute on function public.leaderboard(int) to anon, authenticated;

-- 完成。
