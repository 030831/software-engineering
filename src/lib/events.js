import { addDays, parseISO, startOfDay } from 'date-fns'

export const PERSONAL_COLOR = '#1D9E75'
export const TEAM_COLORS = ['#7F77DD', '#D4537E', '#378ADD', '#BA7517', '#0F6E56']

export const AVATAR_CLASS = {
  blue: 'bg-blue-100 text-blue-800',
  green: 'bg-emerald-100 text-emerald-800',
  amber: 'bg-amber-100 text-amber-800',
  rose: 'bg-rose-100 text-rose-800',
  violet: 'bg-violet-100 text-violet-800',
  teal: 'bg-teal-100 text-teal-800',
}

export function eventColor(ev, teams) {
  if (ev.kind === 'team') return teams.find((t) => t.id === ev.team_id)?.color ?? TEAM_COLORS[0]
  return PERSONAL_COLOR
}

export function overlapsDay(ev, day) {
  const ds = startOfDay(day)
  const de = addDays(ds, 1)
  return parseISO(ev.start) < de && parseISO(ev.end) > ds
}

export function eventsOnDay(events, day) {
  return events
    .filter((e) => overlapsDay(e, day))
    .sort((a, b) => Number(b.all_day) - Number(a.all_day) || a.start.localeCompare(b.start))
}

// 하루 안으로 잘라낸 [시작분, 끝분] (0 ~ 1440)
export function minutesInDay(ev, day) {
  const ds = startOfDay(day).getTime()
  const from = Math.max(0, (parseISO(ev.start).getTime() - ds) / 60000)
  const to = Math.min(1440, (parseISO(ev.end).getTime() - ds) / 60000)
  return { from, to }
}

export function teamsOf(teams, userId) {
  return teams.filter((t) => t.members.includes(userId))
}

// 내 달력에 보이는 일정: 내 개인 일정 + 내가 속한 팀의 팀 일정
export function calendarEventsFor(state, userId) {
  const teamIds = new Set(teamsOf(state.teams, userId).map((t) => t.id))
  return state.events.filter((e) => (e.kind === 'team' ? teamIds.has(e.team_id) : e.owner_id === userId))
}

// 추천 계산용 바쁜 구간. 공개 범위와 관계없이(완전 비공개 포함) 모두 반영한다.
// 개인의 하루 종일 일정은 그날 전체를 막는다. 팀의 하루 종일 일정('스프린트 2' 같은 기간 표시)은 막지 않는다.
export function busyIntervalsFor(state, userId) {
  return calendarEventsFor(state, userId)
    .filter((e) => !(e.all_day && e.kind === 'team'))
    .map((e) => ({ start: parseISO(e.start).getTime(), end: parseISO(e.end).getTime() }))
}
