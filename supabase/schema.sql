-- 작심365 Supabase 스키마
-- Supabase 대시보드 → SQL Editor → New query 에 이 파일 전체를 붙여 넣고 Run.
-- 처음 한 번만 실행한다. (다시 실행하려면 맨 아래 '초기화' 부분을 먼저 실행)
--
-- 시간은 모두 한국 시간 기준 '벽시계 시간'(timestamp without time zone, 'yyyy-MM-ddTHH:mm')으로 저장한다.
-- 앱이 쓰는 문자열 형식과 같아서 변환 없이 주고받을 수 있다.
--
-- 공개 범위 규칙 (논의사항):
--   public : 같은 팀 사람 모두 제목까지 본다
--   team   : 고른 팀 사람만 제목까지 본다
--   busy   : 아무도 일정(제목)을 못 본다. 시간만 teammate_busy() 함수로 '가능한 시간 계산'에 쓰인다
-- 이 규칙은 브라우저가 아니라 DB의 RLS(행 단위 보안)로 강제한다. 화면에서만 숨기면 API로 다 읽을 수 있기 때문.

-- ─────────────────────────────────────────────
-- 테이블
-- ─────────────────────────────────────────────

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  name text not null,
  email text not null,
  color text not null default 'teal',
  prefs jsonb not null default '{"morning": 0.5, "afternoon": 0.5, "evening": 0.5}',
  created_at timestamptz not null default now()
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  color text not null,
  invite_code text not null unique,
  leader_id uuid not null references public.profiles (id) on delete cascade, -- 팀장이 탈퇴하면 팀도 지운다
  created_at timestamptz not null default now()
);

create table public.team_members (
  team_id uuid not null references public.teams on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (team_id, user_id)
);
create index team_members_user_idx on public.team_members (user_id);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles on delete cascade,
  title text not null,
  start_at timestamp not null,
  end_at timestamp not null,
  all_day boolean not null default false,
  visibility text not null default 'busy' check (visibility in ('public', 'team', 'busy')),
  team_id uuid references public.teams on delete cascade,
  kind text not null default 'personal' check (kind in ('personal', 'team')),
  done boolean not null default false,
  created_at timestamptz not null default now(),
  check (end_at > start_at),
  check (kind = 'personal' or team_id is not null),
  check (visibility <> 'team' or team_id is not null)
);
create index events_owner_idx on public.events (owner_id);
create index events_team_idx on public.events (team_id);
create index events_time_idx on public.events (start_at, end_at);

-- 팀장이 넣는 '이 주에 해야 할 일'. week: 그 주 월요일
create table public.requests (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams on delete cascade,
  title text not null,
  week date not null,
  duration int not null check (duration between 10 and 600),
  created_by uuid default auth.uid() references public.profiles on delete set null,
  status text not null default 'open' check (status in ('open', 'scheduled')),
  created_at timestamptz not null default now()
);
create index requests_team_idx on public.requests (team_id);

-- 원하는 시간 투표: 사람마다 한 표
create table public.votes (
  request_id uuid not null references public.requests on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles on delete cascade,
  start_at timestamp not null,
  end_at timestamp not null,
  primary key (request_id, user_id),
  check (end_at > start_at)
);

-- ─────────────────────────────────────────────
-- 도우미 함수 (RLS 안에서 쓰면 서로를 다시 검사하며 무한히 도는 문제가 있어 security definer로 만든다)
-- ─────────────────────────────────────────────

create or replace function public.is_team_member(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from team_members where team_id = t and user_id = auth.uid())
$$;

create or replace function public.is_team_leader(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from teams where id = t and leader_id = auth.uid())
$$;

-- 나와 같은 팀에 속한 사람인지
create or replace function public.shares_team(other uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from team_members a join team_members b on a.team_id = b.team_id
    where a.user_id = auth.uid() and b.user_id = other
  )
$$;

-- 가입하면 프로필을 만든다 (이름은 가입할 때 넘긴 name, 없으면 이메일 앞부분)
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, name, email, color)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''), split_part(new.email, '@', 1)),
    new.email,
    (array['blue', 'green', 'amber', 'rose', 'violet', 'teal'])[1 + floor(random() * 6)::int]
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 팀 만들기: 팀 + 초대 코드 + 만든 사람을 팀장·팀원으로
create or replace function public.create_team(team_name text, team_color text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  new_id uuid;
  code text;
begin
  if auth.uid() is null then raise exception '로그인이 필요해요'; end if;
  loop
    code := upper(substr(md5(random()::text), 1, 4)) || '-' || (1000 + floor(random() * 9000))::int;
    exit when not exists (select 1 from teams where invite_code = code);
  end loop;
  insert into teams (name, color, invite_code, leader_id)
  values (trim(team_name), team_color, code, auth.uid())
  returning id into new_id;
  insert into team_members (team_id, user_id) values (new_id, auth.uid());
  return new_id;
end $$;

-- 초대 코드로 참여: 팀 id를 돌려준다. 코드가 없으면 null
create or replace function public.join_team(code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  t uuid;
begin
  if auth.uid() is null then raise exception '로그인이 필요해요'; end if;
  select id into t from teams where upper(invite_code) = upper(trim(code));
  if t is null then return null; end if;
  insert into team_members (team_id, user_id) values (t, auth.uid()) on conflict do nothing;
  return t;
end $$;

-- 나와 같은 팀 사람들(나 포함)의 '막히는 시간'만 돌려준다. 제목·공개 범위는 돌려주지 않는다.
-- 앱의 규칙과 같다: 개인 일정은 공개 범위와 관계없이 모두(하루 종일 포함), 팀 일정은 그 팀 팀원 모두를 막되
-- 팀의 하루 종일 일정('스프린트 2' 같은 기간 표시)은 막지 않는다.
create or replace function public.teammate_busy(from_ts timestamp, to_ts timestamp)
returns table (user_id uuid, start_at timestamp, end_at timestamp)
language sql stable security definer set search_path = public as $$
  with mates as (
    select distinct b.user_id
    from team_members a join team_members b on a.team_id = b.team_id
    where a.user_id = auth.uid()
  )
  select e.owner_id, e.start_at, e.end_at
  from events e join mates m on m.user_id = e.owner_id
  where e.kind = 'personal' and e.end_at > from_ts and e.start_at < to_ts
  union all
  select tm.user_id, e.start_at, e.end_at
  from events e
  join team_members tm on tm.team_id = e.team_id
  join mates m on m.user_id = tm.user_id
  where e.kind = 'team' and not e.all_day and e.end_at > from_ts and e.start_at < to_ts
$$;

-- 로그인한 사람만 함수를 부를 수 있게
revoke execute on function public.create_team(text, text), public.join_team(text), public.teammate_busy(timestamp, timestamp) from public, anon;
grant execute on function public.create_team(text, text), public.join_team(text), public.teammate_busy(timestamp, timestamp) to authenticated;

-- ─────────────────────────────────────────────
-- RLS (행 단위 보안)
-- ─────────────────────────────────────────────

alter table public.profiles enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.events enable row level security;
alter table public.requests enable row level security;
alter table public.votes enable row level security;

-- 프로필: 나와 같은 팀 사람만 보이고, 내 것만 고친다
create policy "profiles_select" on public.profiles for select to authenticated
  using (id = auth.uid() or public.shares_team(id));
create policy "profiles_update" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- 팀: 내가 속한 팀만 보이고, 팀장만 고친다. 만들기·참여는 create_team / join_team 함수로만
create policy "teams_select" on public.teams for select to authenticated
  using (public.is_team_member(id));
create policy "teams_update" on public.teams for update to authenticated
  using (leader_id = auth.uid()) with check (leader_id = auth.uid());

-- 팀원: 내가 속한 팀의 팀원 목록만, 스스로 나가기만
create policy "team_members_select" on public.team_members for select to authenticated
  using (public.is_team_member(team_id));
create policy "team_members_delete_self" on public.team_members for delete to authenticated
  using (user_id = auth.uid());

-- 일정
-- 1) 내 일정은 모두 (팀 공개·팀 일정은 내가 속한 팀으로만)
create policy "events_own" on public.events for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid() and (team_id is null or public.is_team_member(team_id)));
-- 2) 내 팀의 팀 일정은 팀원 모두가 본다
create policy "events_team_select" on public.events for select to authenticated
  using (kind = 'team' and public.is_team_member(team_id));
-- 3) 팀원의 개인 일정은 전체 공개, 또는 내가 속한 팀에 공개한 것만. 바쁨(busy)은 절대 안 보인다
create policy "events_shared_select" on public.events for select to authenticated
  using (
    kind = 'personal' and (
      (visibility = 'public' and public.shares_team(owner_id))
      or (visibility = 'team' and public.is_team_member(team_id))
    )
  );

-- 정할 일정: 팀원은 보고, 팀장만 추가, 팀원이 확정 표시
create policy "requests_select" on public.requests for select to authenticated
  using (public.is_team_member(team_id));
create policy "requests_insert_leader" on public.requests for insert to authenticated
  with check (public.is_team_leader(team_id) and created_by = auth.uid());
create policy "requests_update_member" on public.requests for update to authenticated
  using (public.is_team_member(team_id)) with check (public.is_team_member(team_id));

-- 투표: 팀원은 보고, 내 표만 쓰고 지운다
create policy "votes_select" on public.votes for select to authenticated
  using (exists (select 1 from requests r where r.id = request_id and public.is_team_member(r.team_id)));
create policy "votes_insert_own" on public.votes for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from requests r where r.id = request_id and public.is_team_member(r.team_id)));
create policy "votes_update_own" on public.votes for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "votes_delete_own" on public.votes for delete to authenticated
  using (user_id = auth.uid());

-- ─────────────────────────────────────────────
-- 실시간: 이 테이블들이 바뀌면 열려 있는 화면에 알린다 (받는 쪽도 RLS를 따른다)
-- ─────────────────────────────────────────────
alter publication supabase_realtime add table public.profiles, public.teams, public.team_members, public.events, public.requests, public.votes;

-- ─────────────────────────────────────────────
-- 초기화 (처음부터 다시 만들 때만, 위 내용을 실행하기 전에 따로 실행)
-- ─────────────────────────────────────────────
-- drop trigger if exists on_auth_user_created on auth.users;
-- drop table if exists public.votes, public.requests, public.events, public.team_members, public.teams, public.profiles cascade;
-- drop function if exists public.is_team_member, public.is_team_leader, public.shares_team, public.handle_new_user, public.create_team, public.join_team, public.teammate_busy;
