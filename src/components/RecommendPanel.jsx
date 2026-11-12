import { useRef, useState } from 'react'
import { addDays, addMinutes, format, isSameDay, parseISO, startOfDay, startOfWeek } from 'date-fns'
import { ko } from 'date-fns/locale'
import { CalendarCheck, Plus, Sparkles } from 'lucide-react'
import { useStore } from '../store/AppStore'
import { busyIntervalsFor } from '../lib/events'
import { DAY_END_MIN, DAY_START_MIN, weekOptions } from '../lib/recommend'
import { Avatar, Button, inputClass } from './ui'
import MySchedule from './MySchedule'

const DURATIONS = [
  { value: 30, label: '30분' },
  { value: 60, label: '1시간' },
  { value: 90, label: '1시간 30분' },
  { value: 120, label: '2시간' },
]
// 처음엔 추천 순위 위쪽 몇 개만 보여준다
const TOP_N = 5

const lengthLabel = (min) => {
  const h = Math.floor(min / 60)
  const m = min % 60
  return [h && `${h}시간`, m && `${m}분`].filter(Boolean).join(' ')
}
const weekLabel = (week) => {
  const mon = parseISO(week)
  return `${format(mon, 'M/d')}–${format(addDays(mon, 6), 'M/d')} 주`
}
const dayLabel = (d) => format(d, 'M/d (EEE)', { locale: ko })
const hm = (d) => format(d, 'HH:mm')
const toLocal = (d) => format(d, "yyyy-MM-dd'T'HH:mm")
// 시작이 같은 구간이 여럿일 수 있어(예: 11:30–13:00 모두 / 11:30–18:00 일부) 끝과 인원까지 넣는다
const optionKey = (o) => `${o.start.toISOString()}-${o.end.toISOString()}-${o.available}`

// 추천 근거를 짧은 말로: 앞뒤 여유, 선호 시간대, 늦은 시간
function reasonsOf(best) {
  const list = []
  if (best.minGap === Infinity) list.push('앞뒤 일정 없음')
  else if (best.minGap >= 60) list.push('앞뒤 여유 1시간+')
  else if (best.minGap >= 30) list.push('앞뒤 여유 30분+')
  else list.push('앞뒤 일정과 가까움')
  if (best.P >= 0.75) list.push('선호 시간대')
  else if (best.P <= 0.25) list.push('비선호 시간대')
  if (best.L > 0) list.push('늦은 시간')
  return list
}

// 흐름: 팀장이 '이 주에 해야 할 일'(주·길이)을 넣음 → 그 주의 빈 구간을 추천 순서대로 보여줌
// → 구간을 고르고, 그날 시간 막대(When2meet 식: 되는 시간 초록 / 안 되는 시간 빨강)에서 눌러 고르거나 끌어서 고름 → 확정(한 번만)
// 모두 되는 시간이 없으면 가장 많이 참석할 수 있는 차선책을 보여준다.
// 또는 고른 시간에 투표해 팀원들이 원하는 시간을 모으고, 그중 하나로 확정 (임시)
export default function RecommendPanel({ team, members, leader }) {
  const { state, me, addRequest, scheduleRequest, setVote, clearVote } = useStore()
  const isLeader = team.leader_id === me.id
  // 주가 다 지난 요청은 고를 시간이 없으니 목록에서 숨긴다
  const today = startOfDay(new Date())
  const openRequests = state.requests.filter((r) => r.team_id === team.id && r.status === 'open')
  const requests = openRequests.filter((r) => addDays(parseISO(r.week), 7) > today)
  const pastCount = openRequests.length - requests.length

  const [requestId, setRequestId] = useState(null)
  const [selectedKey, setSelectedKey] = useState(null)
  const [start, setStart] = useState(null)
  // 고른 시간의 길이(분). 기본은 정할 일정의 길이, 시간 막대에서 끌어 고르면 그 길이
  const [length, setLength] = useState(60)
  const [confirmed, setConfirmed] = useState(null)
  const [showAll, setShowAll] = useState(false)
  // 같은 일정을 다시 눌러도 아래 표가 그 주로 돌아가도록 누를 때마다 올린다
  const [focusTick, setFocusTick] = useState(0)

  const request = requests.find((r) => r.id === requestId) ?? null
  const busy = Object.fromEntries(members.map((m) => [m.id, busyIntervalsFor(state, m.id)]))
  const optionsFor = (r) => (r ? weekOptions({ members, busy, weekStart: parseISO(r.week), durationMin: r.duration }) : [])
  const options = optionsFor(request)
  const full = options.filter((o) => o.available === o.total)
  // 모두 되는 시간이 있으면 그것만, 없으면 차선책(일부만 참석)을 추천 순서대로
  const fallback = full.length === 0
  const list = fallback ? options : full
  const shown = showAll ? list : list.slice(0, TOP_N)
  const selected = options.find((o) => optionKey(o) === selectedKey) ?? null
  const myVote = request?.votes?.[me.id] ?? null
  const end = start && addMinutes(start, length)
  // 고른 시간이 이 후보 인원만큼 '처음부터 끝까지' 되는지. 안 되면(빨간 시간이 섞였거나 지난 시간) 확정을 막는다
  const freeFor = (s, e) => members.filter((m) => !(busy[m.id] ?? []).some((iv) => iv.start < e.getTime() && iv.end > s.getTime())).length
  const badPick = Boolean(selected && start && (start < new Date() || freeFor(start, end) < selected.available))
  const slotAt = (t, len) => ({ start: toLocal(t), end: toLocal(addMinutes(t, len)) })

  // 시간을 바꾸면, 이미 투표했다면 내 투표도 그 시간으로 옮긴다
  const moveTo = (t, len = request.duration) => {
    setStart(t)
    setLength(len)
    if (myVote) setVote(request.id, slotAt(t, len))
  }

  const pickOption = (o) => {
    setSelectedKey(optionKey(o))
    moveTo(o.best.start)
  }

  // 일정을 고르면 추천 1순위 구간과 그 안의 가장 좋은 시간을 바로 골라 두어,
  // 아래 표에 추가될 위치가 곧장 보이게 한다
  const pickRequest = (id) => {
    setRequestId(id)
    setFocusTick((n) => n + 1)
    setSelectedKey(null)
    setStart(null)
    setConfirmed(null)
    setShowAll(false)
    const r = requests.find((x) => x.id === id)
    setLength(r?.duration ?? 60)
    const os = optionsFor(r)
    // 이미 투표했으면 내가 투표한 시간을 골라 둔다
    const voted = r?.votes?.[me.id]
    // 내 투표를 품는 구간, 없으면(끌어서 길게 고른 경우) 같은 날 투표 시작 시간을 품는 구간
    const home =
      voted &&
      (os.find((o) => o.start <= parseISO(voted.start) && o.end >= parseISO(voted.end)) ??
        os.find((o) => o.start <= parseISO(voted.start) && o.end > parseISO(voted.start)))
    if (home) {
      setSelectedKey(optionKey(home))
      setStart(parseISO(voted.start))
      setLength((parseISO(voted.end) - parseISO(voted.start)) / 60000)
      // 고른 구간이 처음 보이는 목록 밖이면 펼쳐 둔다
      const homeList = os.some((o) => o.available === o.total) ? os.filter((o) => o.available === o.total) : os
      if (homeList.indexOf(home) >= TOP_N) setShowAll(true)
      return
    }
    if (os[0]) {
      setSelectedKey(optionKey(os[0]))
      setStart(os[0].best.start)
    }
  }

  const confirmAt = (start, len = length) => {
    const end = addMinutes(start, len)
    scheduleRequest(request.id, {
      title: request.title,
      start: toLocal(start),
      end: toLocal(end),
      all_day: false,
      visibility: 'team',
      team_id: team.id,
      kind: 'team',
    })
    setConfirmed({ title: request.title, label: `${dayLabel(start)} ${hm(start)}–${hm(end)}`, date: format(start, 'yyyy-MM-dd') })
    pickRequest(null)
  }
  const onConfirm = () => confirmAt(start)
  const onVote = () => (myVote ? clearVote(request.id) : setVote(request.id, slotAt(start, length)))

  return (
    <>
      <section className="card">
        <div className="flex items-center gap-3 px-6 pb-4 pt-5">
          <span className="flex size-8 items-center justify-center rounded-xl bg-brand-soft text-brand">
            <Sparkles size={16} />
          </span>
          <div>
            <h2 className="text-[15px] font-bold tracking-tight">약속 시간 정하기</h2>
            <p className="text-xs text-stone-400">팀원 일정에 맞춰 그 주에 좋은 시간을 순서대로 추천해요</p>
          </div>
        </div>

        <div className="grid grid-cols-[280px_minmax(0,1fr)] gap-6 px-6 pb-6">
          <div className="space-y-1.5 self-start rounded-2xl bg-canvas p-2 text-sm">
            <div className="label px-2 pb-1 pt-1.5">이번에 정해야 할 일정</div>
            {requests.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => pickRequest(r.id)}
                className={`w-full rounded-xl px-3 py-2.5 text-left transition ${
                  requestId === r.id ? 'bg-white shadow-card ring-[1.5px] ring-brand' : 'hover:bg-white/70'
                }`}
              >
                <div className={`font-semibold ${requestId === r.id ? 'text-brand' : ''}`}>{r.title}</div>
                <div className="mt-0.5 text-xs tabular-nums text-stone-500">
                  {weekLabel(r.week)} · {lengthLabel(r.duration)}
                </div>
              </button>
            ))}
            {requests.length === 0 && <p className="px-2 py-1 text-xs text-stone-400">정해야 할 일정이 없어요.</p>}
            {pastCount > 0 && <p className="px-2 text-[11px] text-stone-400">주가 지난 일정 {pastCount}개는 숨겼어요.</p>}
            {isLeader ? (
              <AddRequest onAdd={(req) => addRequest(team.id, req)} />
            ) : (
              <p className="px-2 pb-1 pt-1 text-[11px] text-stone-400">정해야 할 일정은 팀장{leader ? `(${leader.name})` : ''}이 추가해요.</p>
            )}
          </div>

          <div>
            {confirmed && !request && (
              <div className="flex items-center gap-3 rounded-2xl bg-emerald-50 p-5 ring-1 ring-emerald-100">
                <span className="flex size-10 items-center justify-center rounded-full bg-white text-emerald-600 shadow-card">
                  <CalendarCheck size={20} />
                </span>
                <div>
                  <div className="font-semibold text-emerald-900">{confirmed.title}</div>
                  <div className="text-sm text-emerald-800">{confirmed.label} · 팀 달력에 추가했어요</div>
                </div>
              </div>
            )}
            {!confirmed && !request && (
              <div className="flex h-full min-h-48 items-center justify-center rounded-2xl border-[1.5px] border-dashed border-stone-200 text-sm text-stone-400">
                왼쪽에서 정해야 할 일정을 고르세요.
              </div>
            )}
            {request && (
              <div className="space-y-4">
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-bold tracking-tight">{request.title}</span>
                  <span className="text-sm tabular-nums text-stone-400">
                    {weekLabel(request.week)} · {lengthLabel(request.duration)}
                  </span>
                </div>

                {fallback && options.length > 0 && (
                  <div className="rounded-xl bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900 ring-1 ring-amber-100">
                    이 주에는 모두 참석할 수 있는 시간이 없어요. 가장 많이 참석할 수 있는 <b>차선책</b>을 순서대로 보여드려요.
                  </div>
                )}
                {options.length === 0 && (
                  <div className="rounded-2xl bg-canvas px-3 py-8 text-center text-xs text-stone-500">
                    이 주에는 {lengthLabel(request.duration)} 동안 2명 이상 모일 수 있는 시간이 없어요.
                  </div>
                )}

                {list.length > 0 && (
                  <div>
                    <div className="mb-2 flex items-baseline gap-2">
                      <span className="label">{fallback ? '차선책' : '모두 참석 가능'}</span>
                      <span className="text-[11px] text-stone-400">참석 인원, 앞뒤 여유, 선호 시간대를 따져 좋은 순서대로</span>
                    </div>
                    <div className="space-y-2">
                      {shown.map((o, i) => {
                        const on = selectedKey === optionKey(o)
                        return (
                          <div
                            key={optionKey(o)}
                            className={`rounded-2xl transition ${on ? 'bg-white shadow-card ring-[1.5px] ring-brand' : 'bg-canvas/70 hover:bg-white hover:shadow-card'}`}
                          >
                            <OptionRow rank={i + 1} option={o} members={members} duration={request.duration} onClick={() => pickOption(o)} />
                            {on && start && (
                              <TimeStrip option={o} members={members} busy={busy} duration={request.duration} start={start} length={length} bad={badPick} onChange={moveTo} />
                            )}
                          </div>
                        )
                      })}
                    </div>
                    {list.length > TOP_N && (
                      <button type="button" onClick={() => setShowAll((v) => !v)} className="mt-2 rounded-lg px-2 py-1 text-xs font-medium text-stone-500 hover:bg-stone-900/5 hover:text-ink">
                        {showAll ? '접기' : `${list.length - TOP_N}개 더 보기`}
                      </button>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <Button
                    className={`ml-auto ${myVote ? 'text-emerald-700 shadow-[0_0_0_1.5px_var(--color-emerald-500)]' : ''}`}
                    disabled={!selected && !myVote}
                    onClick={onVote}
                  >
                    {myVote ? '투표 취소' : '투표'}
                  </Button>
                  <Button variant="primary" disabled={!selected || badPick} onClick={onConfirm} title={badPick ? '안 되는 시간이 들어 있어 확정할 수 없어요' : undefined}>
                    {!selected || !start ? '시간을 고르세요' : badPick ? '안 되는 시간이 있어 확정할 수 없어요' : `${dayLabel(start)} ${hm(start)}–${hm(end)}로 확정`}
                  </Button>
                </div>

                <VoteList
                  request={request}
                  members={members}
                  busy={busy}
                  me={me}
                  current={selected && start ? toLocal(start) : null}
                  onConfirm={(slot) => confirmAt(parseISO(slot.start), (parseISO(slot.end) - parseISO(slot.start)) / 60000)}
                />
              </div>
            )}
          </div>
        </div>
      </section>

      <MySchedule
        team={team}
        members={members}
        focusTick={focusTick}
        focusDate={selected && start ? format(start, 'yyyy-MM-dd') : (request?.week ?? confirmed?.date)}
        preview={
          request &&
          selected &&
          start && {
            title: request.title,
            date: format(start, 'yyyy-MM-dd'),
            duration: length,
            start,
            end,
          }
        }
      />
    </>
  )
}

// 추천 목록의 한 줄: 순위, 요일, 비어 있는 구간, 참석 인원(차선책이면 못 오는 사람), 추천 근거
function OptionRow({ rank, option: o, members, duration, onClick }) {
  // 차선책도 안 되는 사람은 표시하지 않고, 참석 인원(과 마우스를 올리면 참석하는 사람)만 보여준다
  const attendees = members.filter((m) => o.ids.includes(m.id))
  const best = o.best
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 rounded-2xl px-3.5 py-3 text-left">
      <span
        className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums ${
          rank === 1 ? 'bg-brand text-white shadow-[0_2px_6px_-1px_var(--color-brand)]' : 'bg-white text-stone-500 shadow-card'
        }`}
      >
        {rank}
      </span>
      <div className="w-44 shrink-0 whitespace-nowrap">
        <div className="text-sm font-bold tabular-nums">{dayLabel(o.start)}</div>
        <div className="text-[11px] tabular-nums text-stone-400">
          {hm(o.start)}–{hm(o.end)} · {lengthLabel((o.end - o.start) / 60000)} 비어 있음
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 text-[11px]">
        {o.available === o.total ? (
          <span className="rounded-full bg-emerald-100/80 px-2 py-0.5 font-semibold text-emerald-800">모두 참석</span>
        ) : (
          <span title={`참석: ${attendees.map((m) => m.name).join(', ')}`} className="rounded-full bg-amber-100/80 px-2 py-0.5 font-semibold text-amber-800">
            {o.available}/{o.total}명 참석
          </span>
        )}
        {reasonsOf(best).map((r) => (
          <span key={r} className="rounded-full bg-white px-2 py-0.5 text-stone-500 shadow-[0_0_0_1px_rgb(31_29_26/0.07)]">
            {r}
          </span>
        ))}
      </div>
      <div className="shrink-0 text-right text-[10px] font-semibold text-brand">
        추천
        <div className="text-sm font-bold tabular-nums text-ink">
          {hm(best.start)}–{hm(addMinutes(best.start, duration))}
        </div>
      </div>
    </button>
  )
}

// 그날 9–22시를 30분 칸으로 가로로 늘어놓은 시간 막대 (When2meet 식)
// - 초록: 이 후보만큼(전원 후보면 전원, 차선책이면 그 인원 이상) 되는 시간 / 빨강: 안 되는 시간 / 줄무늬: 지난 시간
// - 한 칸을 누르면 그 칸부터 정할 일정 길이만큼, 끌면 끈 만큼 고른다. 고른 시간은 노란 테두리
// - 마우스를 올리면 몇 명이 되는지만 보여준다 (안 되는 사람은 표시하지 않는다)
const CELL_MIN = 30
const CELLS = (DAY_END_MIN - DAY_START_MIN) / CELL_MIN

// bad: 고른 시간에 안 되는 시간이 섞였는지 (확정 버튼과 같은 기준으로 부모가 계산해 넘긴다). 끄는 중에는 칸 색으로 미리 판단한다
function TimeStrip({ option, members, busy, duration, start, length, bad, onChange }) {
  const trackRef = useRef(null)
  const [drag, setDrag] = useState(null) // { from, to } 칸 번호
  const [hover, setHover] = useState(null)
  const day = startOfDay(option.start)
  const now = new Date()
  const need = option.available

  const cells = Array.from({ length: CELLS }, (_, i) => {
    const s = addMinutes(day, DAY_START_MIN + i * CELL_MIN)
    const e = addMinutes(s, CELL_MIN)
    const count = members.filter((m) => !(busy[m.id] ?? []).some((iv) => iv.start < e.getTime() && iv.end > s.getTime())).length
    return { s, e, count, past: e <= now, ok: count >= need }
  })

  const cellAt = (clientX) => {
    const rect = trackRef.current.getBoundingClientRect()
    return Math.min(CELLS - 1, Math.max(0, Math.floor(((clientX - rect.left) / rect.width) * CELLS)))
  }
  const onDown = (e) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    const i = cellAt(e.clientX)
    setDrag({ from: i, to: i })
  }
  const onMove = (e) => {
    const i = cellAt(e.clientX)
    setHover(i)
    if (drag && drag.to !== i) setDrag({ ...drag, to: i })
  }
  const onUp = () => {
    if (!drag) return
    const lo = Math.min(drag.from, drag.to)
    const hi = Math.max(drag.from, drag.to)
    setDrag(null)
    if (lo === hi) {
      // 한 칸만 누르면 정할 일정 길이만큼 (22시를 넘지 않게 앞으로 당긴다)
      const latest = CELLS * CELL_MIN - duration
      const startMin = Math.max(0, Math.min(lo * CELL_MIN, latest))
      onChange(addMinutes(day, DAY_START_MIN + startMin), duration)
    } else {
      onChange(cells[lo].s, (hi - lo + 1) * CELL_MIN)
    }
  }

  // 지금 보여줄 선택 범위(분, 9시 기준): 끄는 중이면 끄는 범위, 아니면 고른 시간
  const sel = drag
    ? { from: Math.min(drag.from, drag.to) * CELL_MIN, to: (Math.max(drag.from, drag.to) + 1) * CELL_MIN }
    : { from: (start - day) / 60000 - DAY_START_MIN, to: (start - day) / 60000 - DAY_START_MIN + length }
  const pct = (min) => `${(min / (CELLS * CELL_MIN)) * 100}%`
  const selCells = cells.filter((c, i) => i * CELL_MIN < sel.to && (i + 1) * CELL_MIN > sel.from)
  const hasBad = drag ? selCells.some((c) => !c.ok || c.past) : bad
  const selStart = addMinutes(day, DAY_START_MIN + sel.from)
  const selEnd = addMinutes(day, DAY_START_MIN + sel.to)
  const info = hover !== null ? cells[hover] : null

  return (
    <div className="px-3.5 pb-3.5">
      <div className="mb-2 flex items-center gap-3 text-[11px] text-stone-500">
        <span className="flex items-center gap-1">
          <span className="size-2.5 rounded-sm bg-emerald-400" /> {need === members.length ? '모두 가능' : `${need}명 이상 가능`}
        </span>
        <span className="flex items-center gap-1">
          <span className="size-2.5 rounded-sm bg-rose-300" /> 안 됨
        </span>
        <span className="text-stone-400">눌러서 고르거나, 끌어서 원하는 만큼 골라요</span>
        <span className="ml-auto tabular-nums text-stone-500">
          {info ? `${hm(info.s)}–${hm(info.e)} · ${info.past ? '지난 시간' : `${info.count}/${members.length}명 가능`}` : ''}
        </span>
      </div>

      <div className="relative select-none">
        {/* 시간 눈금 */}
        <div className="relative mb-1 h-3.5">
          {Array.from({ length: CELLS / 2 + 1 }, (_, h) => (
            <span
              key={h}
              className={`absolute text-[10px] tabular-nums text-stone-400 ${h === 0 ? '' : h === CELLS / 2 ? '-translate-x-full' : '-translate-x-1/2'}`}
              style={{ left: pct(h * 60) }}
            >
              {DAY_START_MIN / 60 + h}
            </span>
          ))}
        </div>

        <div
          ref={trackRef}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={() => setDrag(null)}
          onPointerLeave={() => setHover(null)}
          className="relative flex h-10 cursor-pointer touch-none overflow-hidden rounded-lg"
        >
          {/* 칸 사이 흰 선: 30분은 가늘게, 정각은 굵게 (선택 테두리와 위치가 어긋나지 않게 칸 안쪽 테두리로 그린다) */}
          {cells.map((c, i) => (
            <div
              key={i}
              className={`h-full flex-1 border-white transition-colors ${i === 0 ? '' : i % 2 === 0 ? 'border-l-2' : 'border-l'} ${
                c.past ? 'busy-stripe' : c.ok ? 'bg-emerald-400 hover:bg-emerald-500' : 'bg-rose-300 hover:bg-rose-400'
              }`}
            />
          ))}
          <div
            className={`pointer-events-none absolute inset-y-0 rounded-md border-[2.5px] ${hasBad ? 'border-red-600 bg-red-600/10' : 'border-amber-400 bg-amber-200/30'} shadow-[0_0_0_2px_#fff]`}
            style={{ left: pct(sel.from), width: pct(sel.to - sel.from) }}
          />
        </div>
      </div>

      <div className="mt-2 flex items-center gap-2 text-xs">
        <span className="font-semibold tabular-nums">
          {hm(selStart)}–{hm(selEnd)}
        </span>
        <span className="text-stone-400">{lengthLabel((selEnd - selStart) / 60000)}</span>
        {(selEnd - selStart) / 60000 !== duration && <span className="text-stone-400">· 정한 길이({lengthLabel(duration)})와 달라요</span>}
        {hasBad && <span className="ml-auto font-medium text-red-600">안 되는 시간이 들어 있어 확정할 수 없어요</span>}
      </div>
    </div>
  )
}

// 사람마다 원하는 시간 하나에 투표한 결과를 시간별로 모아 보여준다. 선호 시간대 설정과는 따로 간다.
function VoteList({ request, members, busy, me, current, onConfirm }) {
  const slots = new Map()
  for (const m of members) {
    const v = request.votes?.[m.id]
    if (!v) continue
    if (!slots.has(v.start)) slots.set(v.start, { ...v, voters: [] })
    slots.get(v.start).voters.push(m)
  }
  const rows = [...slots.values()].sort((a, b) => a.start.localeCompare(b.start))
  const top = Math.max(0, ...rows.map((r) => r.voters.length))

  return (
    <div className="overflow-hidden rounded-2xl shadow-[0_0_0_1px_rgb(31_29_26/0.07)]">
      <div className="flex items-center gap-2 border-b border-stone-100 px-4 py-3">
        <span className="text-sm font-bold">원하는 시간 투표</span>
        <span className="text-xs text-stone-400">
          {rows.reduce((n, r) => n + r.voters.length, 0)}/{members.length}명 투표 · 시간을 바꾸면 내 투표도 따라 옮겨져요
        </span>
      </div>
      {rows.length === 0 && <p className="px-4 py-3 text-xs text-stone-400">원하는 시간을 고르고 '투표'를 누르세요.</p>}
      {rows.map((row) => {
        const s = parseISO(row.start).getTime()
        const e = parseISO(row.end).getTime()
        const available = members.filter((m) => !(busy[m.id] ?? []).some((iv) => iv.start < e && iv.end > s)).length
        const best = row.voters.length === top
        const mine = row.voters.some((m) => m.id === me.id)
        return (
          <div
            key={row.start}
            className={`flex items-center gap-3 border-t border-stone-100 px-4 py-2.5 first:border-t-0 ${best ? 'bg-emerald-50/50' : ''} ${
              row.start === current ? 'ring-1 ring-inset ring-amber-400' : ''
            }`}
          >
            <div className="w-32 shrink-0">
              <div className="text-[11px] text-stone-500">{dayLabel(parseISO(row.start))}</div>
              <div className="text-sm font-bold tabular-nums">
                {hm(parseISO(row.start))}–{hm(parseISO(row.end))}
              </div>
              <div className={`text-[11px] ${available === members.length ? 'text-stone-500' : 'text-amber-700'}`}>
                {available}/{members.length}명 가능
              </div>
            </div>
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-[11px] text-stone-500">
              {best && <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-800">가장 많이 원함</span>}
              {mine && <span className="rounded-full bg-brand-soft px-2 py-0.5 font-semibold text-brand">내 투표</span>}
              <span className="flex items-center gap-1.5">
                {row.voters.length}표
                <span className="flex -space-x-1">
                  {row.voters.map((m) => (
                    <Avatar key={m.id} profile={m} size="xs" ring />
                  ))}
                </span>
              </span>
            </div>
            <Button className="shrink-0" onClick={() => onConfirm(row)}>
              확정
            </Button>
          </div>
        )
      })}
    </div>
  )
}

// 팀장이 '이 주에 해야 할 일'을 추가: 이름만 입력하고, 주와 길이는 눌러서 고른다
function AddRequest({ onAdd }) {
  const thisWeek = startOfWeek(new Date(), { weekStartsOn: 1 })
  const weeks = Array.from({ length: 4 }, (_, i) => addDays(thisWeek, i * 7))
  const weekNames = ['이번 주', '다음 주', '2주 뒤', '3주 뒤']
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [week, setWeek] = useState(() => weeks[1])
  const [duration, setDuration] = useState(60)
  const [error, setError] = useState('')

  const submit = (e) => {
    e.preventDefault()
    if (!title.trim()) return setError('일정 이름을 입력하세요.')
    onAdd({ title: title.trim(), week: format(week, 'yyyy-MM-dd'), duration })
    setOpen(false)
    setTitle('')
    setError('')
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="flex w-full items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium text-stone-500 hover:bg-white/70 hover:text-ink">
        <Plus size={13} /> 정할 일정 추가
      </button>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl bg-white p-3 shadow-card">
      <input autoFocus value={title} onChange={(e) => (setTitle(e.target.value), setError(''))} placeholder="기말 발표 리허설" className={inputClass} />
      <div>
        <div className="label mb-1.5">어느 주에 할까요?</div>
        <div className="grid grid-cols-2 gap-1">
          {weeks.map((w, i) => {
            const on = isSameDay(w, week)
            return (
              <button
                type="button"
                key={w.toISOString()}
                onClick={() => setWeek(w)}
                className={`rounded-xl px-2.5 py-1.5 text-left transition ${on ? 'bg-ink text-white' : 'bg-canvas hover:bg-stone-100'}`}
              >
                <div className="text-xs font-semibold">{weekNames[i]}</div>
                <div className={`text-[10px] ${on ? 'text-stone-300' : 'text-stone-400'}`}>
                  {format(w, 'M/d')}–{format(addDays(w, 6), 'M/d')}
                </div>
              </button>
            )
          })}
        </div>
      </div>
      <div className="grid grid-cols-4 gap-1">
        {DURATIONS.map((d) => (
          <button
            type="button"
            key={d.value}
            onClick={() => setDuration(d.value)}
            className={`rounded-lg py-1.5 text-[11px] font-medium transition ${duration === d.value ? 'bg-ink text-white' : 'bg-canvas hover:bg-stone-100'}`}
          >
            {d.label}
          </button>
        ))}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex justify-end gap-1.5">
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          취소
        </Button>
        <Button variant="primary">추가</Button>
      </div>
    </form>
  )
}
