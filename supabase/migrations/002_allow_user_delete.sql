-- 계정(사용자)을 지울 수 있게 고친다.
-- 원래는 팀장(teams.leader_id)이나 정할 일정을 만든 사람(requests.created_by)의 계정을 지우면
-- 연결된 행 때문에 삭제가 막혔다.
--   - 팀장이 탈퇴하면 그 팀도 지운다 (팀원·일정·정할 일정·투표가 함께 지워진다)
--   - 정할 일정을 만든 사람이 탈퇴하면 일정은 남기고 만든 사람만 비운다
alter table public.teams drop constraint teams_leader_id_fkey;
alter table public.teams add constraint teams_leader_id_fkey
  foreign key (leader_id) references public.profiles (id) on delete cascade;

alter table public.requests alter column created_by drop not null;
alter table public.requests drop constraint requests_created_by_fkey;
alter table public.requests add constraint requests_created_by_fkey
  foreign key (created_by) references public.profiles (id) on delete set null;
