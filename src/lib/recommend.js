import { addDays, addMinutes, startOfDay } from 'date-fns'

// 최적 시간 추천 (F-003)
// Score(t) = 80·A(t) − 10·L(t) − 10·C(t) + 20·P(t)
//   A: 참석 가능 비율, L: 늦은 시간 정도, C: 앞뒤 일정 부담, P: 참석자들의 선호도

// 선호 시간대: 시간대마다 선호 1 / 보통 0.5 / 비선호 0
export const PERIODS = [
  { key: 'morning', label: '오전', range: '09–12시', start: 9 * 60, end: 12 * 60 },
  { key: 'afternoon', label: '오후', range: '12–18시', start: 12 * 60, end: 18 * 60 },
  { key: 'evening', label: '저녁', range: '18–22시', start: 18 * 60, end: 22 * 60 },
]
export const PREF_LEVELS = [
  { value: 1, label: '선호' },
  { value: 0.5, label: '보통' },
  { value: 0, label: '비선호' },
]
export const DEFAULT_PREFS = { morning: 0.5, afternoon: 0.5, evening: 0.5 }

// 한 사람의 선호도: 슬롯이 여러 시간대에 걸치면 겹치는 시간만큼 가중 평균
export function preferenceOf(prefs, startMinute, endMinute) {
  const p = { ...DEFAULT_PREFS, ...prefs }
  let sum = 0
  let len = 0
  for (const period of PERIODS) {
    const overlap = Math.min(endMinute, period.end) - Math.max(startMinute, period.start)
    if (overlap > 0) {
      sum += overlap * p[period.key]
      len += overlap
    }
  }
  return len ? sum / len : 0.5
}

// 18시부터 22시까지 0 → 1
export function latePenalty(startMinute) {
  return Math.min(1, Math.max(0, (startMinute - 18 * 60) / (4 * 60)))
}

// 가장 가까운 일정까지의 간격(분)에 따른 개인별 부담
export function crowdPenalty(gapMinutes) {
  if (gapMinutes >= 60) return 0
  if (gapMinutes >= 30) return 0.3
  if (gapMinutes >= 10) return 0.7
  return 1
}

// 같은 날 안에서 슬롯 앞뒤로 가장 가까운 일정까지의 간격(분). 없으면 Infinity
function nearestGap(intervals, slotStart, slotEnd, dayStart, dayEnd) {
  let gap = Infinity
  for (const iv of intervals) {
    if (iv.end <= dayStart || iv.start >= dayEnd) continue
    if (iv.end <= slotStart) gap = Math.min(gap, (slotStart - iv.end) / 60000)
    else if (iv.start >= slotEnd) gap = Math.min(gap, (iv.start - slotEnd) / 60000)
  }
  return gap
}

/**
 * 한 슬롯의 점수와 근거를 계산한다.
 * members: [{ id, prefs? }]
 * busy: { [memberId]: [{ start, end }] } (ms 단위)
 */
export function scoreSlot({ slotStart, slotEnd, members, busy }) {
  const dayStart = startOfDay(slotStart).getTime()
  const dayEnd = addDays(dayStart, 1).getTime()
  const s = slotStart.getTime()
  const e = slotEnd.getTime()
  const startMin = slotStart.getHours() * 60 + slotStart.getMinutes()

  const available = members.filter((m) => !(busy[m.id] ?? []).some((iv) => iv.start < e && iv.end > s))
  const A = members.length ? available.length / members.length : 0
  const L = latePenalty(startMin)

  const gaps = available.map((m) => nearestGap(busy[m.id] ?? [], s, e, dayStart, dayEnd))
  const C = gaps.length ? gaps.reduce((sum, g) => sum + crowdPenalty(g), 0) / gaps.length : 1
  const minGap = gaps.length ? Math.min(...gaps) : 0

  const endMin = startMin + (e - s) / 60000
  const P = available.length ? available.reduce((sum, m) => sum + preferenceOf(m.prefs, startMin, endMin), 0) / available.length : 0

  const score = 80 * A - 10 * L - 10 * C + 20 * P
  return { score, A, L, C, P, available: available.length, total: members.length, minGap }
}

export const DAY_START_MIN = 9 * 60
export const DAY_END_MIN = 22 * 60

// 일부만 참석하는 구간은 팀이 이 인원 이상일 때만 보여준다.
// 2명 팀에서 '1/2명' 구간을 보여주면 상대의 (완전 비공개일 수도 있는) 일정 시간이 그대로 드러나기 때문.
export const MIN_TEAM_FOR_PARTIAL = 3

/**
 * 정해진 날(day)의 빈 구간을 계산한다.
 * 10분 단위로 참석 가능한 사람을 구한 뒤, 그날 나타난 인원 조합마다 '그 사람들이 모두 되는' 시간을
 * 끊김 없이 묶는다. durationMin보다 짧은 구간, 그리고 인원도 같거나 적으면서 다른 구간 안에 들어가는 구간은 뺀다.
 * 전원 참석 가능한 구간이 먼저, 같은 인원이면 이른 시간 순.
 */
export function freeWindows({ members, busy, day, durationMin, now = new Date(), unitMin = 10 }) {
  const units = []
  for (let m = DAY_START_MIN; m < DAY_END_MIN; m += unitMin) {
    const s = addMinutes(startOfDay(day), m)
    const e = addMinutes(s, unitMin)
    const free = new Set(
      s < now ? [] : members.filter((mm) => !(busy[mm.id] ?? []).some((iv) => iv.start < e.getTime() && iv.end > s.getTime())).map((mm) => mm.id),
    )
    units.push({ s, e, free })
  }

  const keyOf = (ids) => [...ids].sort().join(',')
  const groups = new Map([[keyOf(members.map((m) => m.id)), members.map((m) => m.id)]])
  if (members.length >= MIN_TEAM_FOR_PARTIAL) {
    for (const u of units) if (u.free.size > 0) groups.set(keyOf(u.free), [...u.free])
  }

  const windows = []
  for (const ids of groups.values()) {
    let current = null
    for (const u of units) {
      if (ids.every((id) => u.free.has(id))) {
        if (current) current.end = u.e
        else windows.push((current = { start: u.s, end: u.e, available: ids.length, total: members.length }))
      } else {
        current = null
      }
    }
  }

  const lengthOf = (w) => w.end - w.start
  const long = windows.filter((w) => lengthOf(w) / 60000 >= durationMin)
  const seen = new Set()
  return long
    .filter(
      (w) =>
        !long.some(
          (o) =>
            o !== w &&
            o.available >= w.available &&
            o.start <= w.start &&
            o.end >= w.end &&
            (o.available > w.available || lengthOf(o) > lengthOf(w)),
        ),
    )
    .filter((w) => {
      const key = `${w.start.getTime()}-${w.end.getTime()}-${w.available}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .sort((a, b) => b.available - a.available || a.start - b.start)
}

/**
 * 구간 안에서 고를 수 있는 시작 시간: 구간 시작, 그 사이의 정각·30분, 가장 늦은 시작.
 * 추천과 끌기가 같은 후보를 쓰도록 한 곳에서 만든다.
 */
export function startCandidates(window, durationMin) {
  const latest = addMinutes(window.end, -durationMin)
  const list = [window.start]
  const startMin = window.start.getHours() * 60 + window.start.getMinutes()
  for (let t = addMinutes(window.start, Math.ceil(startMin / 30) * 30 - startMin); t < latest; t = addMinutes(t, 30)) {
    if (t > window.start) list.push(t)
  }
  if (latest > window.start) list.push(latest)
  return list
}

// 구간 안에서 점수가 가장 높은 시작 시간 → { start, score }
export function bestStartInWindow({ window, durationMin, members, busy }) {
  let best = null
  for (const s of startCandidates(window, durationMin)) {
    const r = scoreSlot({ slotStart: s, slotEnd: addMinutes(s, durationMin), members, busy })
    if (!best || r.score > best.score) best = { start: s, score: r.score }
  }
  return best ?? { start: window.start, score: -Infinity }
}
