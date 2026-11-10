import { useEffect, useState } from 'react'
import { addDays, addMinutes, format, isSameDay, isToday, parseISO, startOfDay, startOfWeek } from 'date-fns'
import { ko } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Lock } from 'lucide-react'
import { useStore } from '../store/AppStore'
import { busyIntervalsFor, calendarEventsFor, eventsOnDay, shadeText } from '../lib/events'
import { DAY_END_MIN, DAY_START_MIN } from '../lib/recommend'
import { Avatar, Button } from './ui'

const hm = (s) => format(typeof s === 'string' ? parseISO(s) : s, 'HH:mm')
const timeLabel = (ev) => (ev.all_day ? '하루 종일' : `${hm(ev.start)}–${hm(ev.end)}`)

// 히트맵: 30분 한 칸, 한 칸 높이(px)
const SLOT_MIN = 30
const SLOT_PX = 14
const SLOTS = (DAY_END_MIN - DAY_START_MIN) / SLOT_MIN

// 팀 화면 아래의 주간 표.
// 위: 이 팀의 일정, 내 일정 (한 줄짜리로 시간 순서대로, 많으면 '+N개'로 접음)
// 아래: 팀원 가능 시간 히트맵. 바쁨 표시 대신 30분 칸마다 '몇 명이 되는지'를 색 진하기로 칠한다.
//   바쁨 일정은 안 보이지만 그 시간은 가능한 시간에서 빠진다. 마우스를 올리면 그 시간에 되는 사람만 보여준다.
// focusDate: 정하는 중인 일정의 날짜(그 주로 이동, focusTick이 바뀌면 같은 날짜라도 다시 이동), preview: 추가될 일정 { title, date, duration, start, end }
export default function MySchedule({ team, members, focusDate, focusTick, preview }) {
  const { state, me } = useStore()
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [hover, setHover] = useState(null)

  useEffect(() => {
    if (focusDate) setWeekStart(startOfWeek(parseISO(focusDate), { weekStartsOn: 1 }))
  }, [focusDate, focusTick])

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const mine = calendarEventsFor(state, me.id)
  const teamEvents = mine.filter((e) => e.kind === 'team' && e.team_id === team.id)
  const myEvents = mine.filter((e) => !(e.kind === 'team' && e.team_id === team.id))
  const clashes = (ev) => !ev.all_day && preview?.start && parseISO(ev.start) < preview.end && parseISO(ev.end) > preview.start
  // 표에 넣을 한 줄. 추가 예정과 겹치는 일정은 접혀도 보이게 한다
  const item = (ev, tone) => {
    const clash = clashes(ev)
    return { key: ev.id, order: ev.all_day ? '' : hm(ev.start), pinned: clash, node: <EventLine ev={ev} tone={tone} clash={clash} color={team.color} /> }
  }
  const isFocus = (d) => focusDate && isSameDay(d, parseISO(focusDate))

  return (
    <section className="card overflow-hidden">
      <div className="flex items-center gap-2 px-6 pb-3 pt-5">
        <h2 className="text-[15px] font-bold tracking-tight">주간 일정</h2>
        <div className="ml-auto flex items-center rounded-xl bg-white text-sm shadow-card">
          <Button variant="ghost" className="rounded-r-none px-2" onClick={() => setWeekStart((d) => addDays(d, -7))} aria-label="이전 주">
            <ChevronLeft size={16} />
          </Button>
          <span className="px-1 text-[13px] font-medium tabular-nums">
            {format(weekStart, 'M/d')} – {format(addDays(weekStart, 6), 'M/d')}
          </span>
          <Button variant="ghost" className="rounded-l-none px-2" onClick={() => setWeekStart((d) => addDays(d, 7))} aria-label="다음 주">
            <ChevronRight size={16} />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-[110px_repeat(7,minmax(0,1fr))] px-3 text-xs">
        <div />
        {days.map((d) => (
          <div key={d.toISOString()} className="px-1 pb-2">
            <div
              className={`flex items-baseline gap-1 rounded-lg px-2 py-1 ${isFocus(d) ? 'bg-brand-soft text-brand' : isToday(d) ? 'text-ink' : 'text-stone-400'}`}
            >
              <span className="text-[11px] font-medium">{format(d, 'EEE', { locale: ko })}</span>
              <span className={`text-sm font-bold tabular-nums ${isFocus(d) || isToday(d) ? '' : 'text-stone-500'}`}>{format(d, 'd')}</span>
            </div>
          </div>
        ))}

        <Row
          label={
            <span className="flex items-center gap-2 font-semibold" style={{ color: shadeText(team.color) }}>
              <span className="size-2.5 rounded-[4px]" style={{ background: team.color }} /> 팀 일정
            </span>
          }
        >
          {days.map((d) => (
            <Cell key={d.toISOString()} focus={isFocus(d)}>
              <EventStack
                items={[
                  ...eventsOnDay(teamEvents, d).map((ev) => item(ev, 'team')),
                  // 정하는 중인 일정은 시간 순서에 맞는 자리에 다른 모양으로 끼워 넣고, 접혀도 항상 보이게 한다
                  ...(preview?.start && isSameDay(preview.start, d) ? [{ key: 'preview', order: hm(preview.start), pinned: true, node: <Pending preview={preview} /> }] : []),
                ]}
              />
            </Cell>
          ))}
        </Row>

        <Row
          label={
            <span className="flex items-center gap-2">
              <Avatar profile={me} size="sm" /> 나
            </span>
          }
        >
          {days.map((d) => (
            <Cell key={d.toISOString()} focus={isFocus(d)}>
              <EventStack
                items={eventsOnDay(myEvents, d)
                  // 다른 팀의 하루 종일 일정은 기간 표시라 빼고, 내 하루 종일 일정은 보여준다 (추천에서도 그날 전체를 막는다)
                  .filter((ev) => !(ev.all_day && ev.kind === 'team'))
                  .map((ev) => item(ev, 'mine'))}
              />
            </Cell>
          ))}
        </Row>
      </div>

      <Heatmap members={members} me={me} state={state} days={days} preview={preview} isFocus={isFocus} hover={hover} setHover={setHover} />
    </section>
  )
}

// 색: 아무도 안 되면 회색, 일부면 인원이 많을수록 진한 초록(또렷한 단계), 전원이면 가장 진한 초록
const PARTIAL_SHADES = ['var(--color-avail-1)', 'var(--color-avail-1)', 'var(--color-avail-2)', 'var(--color-avail-3)']
function shade(count, total) {
  if (count === 0) return { bg: 'var(--color-avail-0)', fg: '#a8a29e' }
  if (count === total) return { bg: 'var(--color-avail-full)', fg: '#ffffff' }
  // 1명은 둘째 단계부터 (첫 단계는 회색과 구분이 잘 안 돼서 2명 이상 팀에서만 섞어 쓴다)
  const k = total > 2 ? 1 + Math.round(((count - 1) / (total - 2)) * (PARTIAL_SHADES.length - 2)) : 2
  return { bg: PARTIAL_SHADES[k], fg: '#065f46' }
}

// 팀원 가능 시간 (Crab Fit · LettuceMeet · When2meet 방식 참고)
// - 요일마다 열을 나누고, 30분 칸 중 '가능 인원'이 같은 칸이 이어지면 둥근 블록 하나로 합쳐 그린다
// - 블록 색 진하기 = 가능 인원, 블록이 충분히 크면 안에 인원 수를 적는다
// - 마우스를 올린 30분 칸은 테두리로 표시하고, 오른쪽 패널에 되는 사람만 보여준다
//   (논의사항: 바쁨 표시 대신 가능한 시간대만 보여준다 → 안 되는 사람을 콕 집어 표시하지 않는다)
function Heatmap({ members, me, state, days, preview, isFocus, hover, setHover }) {
  const now = new Date()
  // 추천 계산과 같은 규칙으로 막히는 구간 (바쁨 일정 포함, 팀의 하루 종일 일정은 제외)
  const blocks = Object.fromEntries(members.map((m) => [m.id, busyIntervalsFor(state, m.id)]))
  const total = members.length

  // 한 칸의 정보: 되는 사람
  const slotInfo = (day, i) => {
    const s = addMinutes(startOfDay(day), DAY_START_MIN + i * SLOT_MIN)
    const e = addMinutes(s, SLOT_MIN)
    const free = members.filter((m) => !blocks[m.id].some((b) => b.start < e.getTime() && b.end > s.getTime()))
    return { s, e, free, past: s < now }
  }
  const grid = days.map((d) => Array.from({ length: SLOTS }, (_, i) => slotInfo(d, i)))

  // 같은 인원(또는 지난 시간)이 이어지는 칸을 한 블록으로
  const runsOf = (infos) => {
    const runs = []
    infos.forEach((info, i) => {
      const key = info.past ? 'past' : info.free.length
      const last = runs.at(-1)
      if (last && last.key === key) last.len++
      else runs.push({ key, from: i, len: 1, count: info.free.length, past: info.past })
    })
    return runs
  }

  const yOf = (date) => ((date.getHours() * 60 + date.getMinutes() - DAY_START_MIN) / SLOT_MIN) * SLOT_PX
  const hourLabels = []
  for (let m = DAY_START_MIN; m <= DAY_END_MIN; m += 60) hourLabels.push(m)
  const current = hover ? grid[hover.d][hover.i] : null

  const onMove = (d) => (e) => {
    const i = Math.floor((e.clientY - e.currentTarget.getBoundingClientRect().top) / SLOT_PX)
    if (i >= 0 && i < SLOTS && (hover?.d !== d || hover?.i !== i)) setHover({ d, i })
  }

  return (
    <div className="mx-3 mb-3 rounded-[20px] bg-canvas p-5">
      <div className="mb-4 flex items-center gap-3">
        <h3 className="text-sm font-bold tracking-tight">팀원 가능 시간</h3>
        <span className="text-xs text-stone-400">진할수록 많이 돼요 · 바쁨 일정은 안 보이고, 그 시간은 가능한 시간에서 빠져요</span>
      </div>

      <div className="flex gap-5">
        {/* 시간표 */}
        <div className="min-w-0 flex-1">
          <div className="grid grid-cols-[36px_repeat(7,minmax(0,1fr))] gap-x-1.5">
            <div />
            {days.map((d) => (
              <div key={d.toISOString()} className={`pb-2 text-center text-[11px] ${isFocus(d) ? 'font-bold text-brand' : isToday(d) ? 'font-semibold text-ink' : 'text-stone-400'}`}>
                {format(d, 'EEE', { locale: ko })} <span className="tabular-nums">{format(d, 'd')}</span>
              </div>
            ))}

            <div className="relative" style={{ height: SLOTS * SLOT_PX }}>
              {hourLabels.map((m) => (
                <span key={m} className="absolute right-1.5 -translate-y-1/2 text-[10px] tabular-nums text-stone-400" style={{ top: ((m - DAY_START_MIN) / SLOT_MIN) * SLOT_PX }}>
                  {m / 60}
                </span>
              ))}
            </div>

            {days.map((d, di) => (
              <div
                key={d.toISOString()}
                className="relative cursor-crosshair"
                style={{ height: SLOTS * SLOT_PX }}
                onMouseMove={onMove(di)}
                onMouseLeave={() => setHover(null)}
              >
                {/* 정각 눈금 (블록 사이 틈으로 보인다) */}
                {hourLabels.slice(1, -1).map((m) => (
                  <div key={m} className="absolute inset-x-0 h-px bg-stone-100" style={{ top: ((m - DAY_START_MIN) / SLOT_MIN) * SLOT_PX }} />
                ))}
                {runsOf(grid[di]).map((r) => {
                  const c = shade(r.count, total)
                  const h = r.len * SLOT_PX - 2
                  return (
                    <div
                      key={r.from}
                      className={`absolute inset-x-0 flex items-start justify-end overflow-hidden rounded-lg px-1.5 pt-1 text-[10px] font-semibold tabular-nums ${r.past ? 'busy-stripe' : ''} ${r.count === total && !r.past ? 'shadow-[inset_0_1px_0_rgb(255_255_255/0.25)]' : ''}`}
                      style={{ top: r.from * SLOT_PX + 1, height: h, background: r.past ? undefined : c.bg, color: c.fg }}
                    >
                      {!r.past && r.count > 0 && h >= 22 && `${r.count}명`}
                    </div>
                  )
                })}
                {preview?.start && isSameDay(preview.start, d) && (
                  <div
                    className="pointer-events-none absolute -inset-x-1 rounded-lg border-2 border-amber-500 shadow-[0_0_0_2px_#fff]"
                    style={{ top: yOf(preview.start) - 1, height: Math.max(SLOT_PX, yOf(preview.end) - yOf(preview.start)) + 2 }}
                  >
                    <span className="absolute -top-2 left-1 rounded bg-amber-500 px-1 text-[9px] font-semibold leading-4 text-white">추가 예정</span>
                  </div>
                )}
                {hover?.d === di && (
                  <div className="pointer-events-none absolute -inset-x-0.5 rounded-md ring-2 ring-ink/80" style={{ top: hover.i * SLOT_PX, height: SLOT_PX }} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 오른쪽 패널: 마우스를 올린 칸에 누가 되는지 */}
        <aside className="w-56 shrink-0 self-start rounded-2xl bg-white p-4 text-xs shadow-card">
          {current ? (
            <>
              <div className="text-stone-500">{format(current.s, 'M월 d일 (EEE)', { locale: ko })}</div>
              <div className="text-base font-bold tabular-nums tracking-tight">
                {hm(current.s)}–{hm(current.e)}
              </div>
              {current.past ? (
                <div className="mt-3 text-stone-400">지난 시간이에요</div>
              ) : (
                <>
                  <div className={`mt-2 inline-block rounded-full px-2.5 py-0.5 font-semibold ${current.free.length === total ? 'bg-avail-full text-white' : 'bg-stone-100 text-stone-700'}`}>
                    {current.free.length === total ? '모두 가능' : `${current.free.length}/${total}명 가능`}
                  </div>
                  <ul className="mt-3 space-y-2">
                    {current.free.map((m) => (
                      <li key={m.id} className="flex items-center gap-2">
                        <Avatar profile={m} size="xs" />
                        <span className="font-medium">{m.id === me.id ? `${m.name} (나)` : m.name}</span>
                        <span className="ml-auto text-emerald-600">가능</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </>
          ) : (
            <>
              <div className="text-sm font-bold">팀원 {total}명</div>
              <ul className="mt-3 space-y-2">
                {members.map((m) => (
                  <li key={m.id} className="flex items-center gap-2">
                    <Avatar profile={m} size="xs" />
                    {m.id === me.id ? `${m.name} (나)` : m.name}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-stone-400">시간표에 마우스를 올리면 그 시간에 누가 되는지 보여요.</p>
            </>
          )}
          <div className="mt-4 border-t border-stone-100 pt-3">
            <div className="label mb-1.5">가능 인원</div>
            <div className="flex gap-0.5">
              {Array.from({ length: total + 1 }, (_, k) => (
                <div key={k} className="flex-1">
                  <div className="h-2.5 rounded-sm" style={{ background: shade(k, total).bg }} />
                  <div className="mt-0.5 text-center text-[10px] tabular-nums text-stone-400">{k}</div>
                </div>
              ))}
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-[10px] text-stone-500">
              <span className="h-2.5 w-4 rounded-sm border-2 border-amber-500" /> 추가 예정 (고른 시간)
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

const MAX_VISIBLE = 3

// 한 칸의 목록. 시간 순서로 쌓고, 많으면 MAX_VISIBLE개만 보여준 뒤 '+N개'로 펼친다.
// pinned(추가 예정, 겹치는 일정)는 접혀 있어도 항상 보인다.
function EventStack({ items }) {
  const [open, setOpen] = useState(false)
  const sorted = [...items].sort((a, b) => a.order.localeCompare(b.order))
  // 하나만 숨기려고 접지는 않는다: MAX_VISIBLE + 1개까지는 모두 보여준다
  const foldable = sorted.length > MAX_VISIBLE + 1
  let room = MAX_VISIBLE - sorted.filter((it) => it.pinned).length
  const visible = open || !foldable ? sorted : sorted.filter((it) => it.pinned || room-- > 0)
  const hidden = sorted.length - visible.length
  return (
    <>
      {visible.map((it) => (
        <div key={it.key}>{it.node}</div>
      ))}
      {foldable && (hidden > 0 || open) && (
        <button type="button" onClick={() => setOpen((v) => !v)} className="w-full rounded-lg px-2 py-0.5 text-left text-[11px] font-medium text-stone-500 hover:bg-stone-900/5 hover:text-ink">
          {open ? '접기' : `+${hidden}개 더`}
        </button>
      )}
    </>
  )
}

// 한 줄짜리 일정: '09:00 제목'. 끝나는 시간은 마우스를 올리면 보인다.
// tone: team(팀 색) / mine(내 일정)
// 파스텔 바탕 + 왼쪽 색 막대 (Amie 식)
function EventLine({ ev, tone, clash, color }) {
  const base = tone === 'team' ? color : '#1d9e75'
  return (
    <div
      title={`${ev.title} · ${timeLabel(ev)}`}
      className={`flex h-[26px] items-center gap-1.5 rounded-lg pl-1 pr-1.5 ${clash ? 'ring-[1.5px] ring-red-400' : ''}`}
      style={{ background: `${base}1a`, color: shadeText(base) }}
    >
      <span className="h-3.5 w-[3px] shrink-0 rounded-full" style={{ background: base }} />
      <span className="shrink-0 text-[10px] tabular-nums opacity-70">{ev.all_day ? '종일' : hm(ev.start)}</span>
      <span className="truncate font-medium">{ev.title}</span>
      {tone === 'mine' && ev.visibility === 'busy' && <Lock size={10} className="shrink-0 opacity-60" />}
    </div>
  )
}

function Pending({ preview }) {
  return (
    <div className="rounded-lg border-[1.5px] border-dashed border-amber-400 bg-amber-50 px-2 py-1 text-amber-900">
      <div className="text-[10px] font-semibold text-amber-700">추가 예정</div>
      <div className="truncate font-medium">{preview.title}</div>
      <div className="text-[10px] text-amber-800">
        {hm(preview.start)}–{hm(preview.end)}
      </div>
    </div>
  )
}

function Row({ label, children }) {
  return (
    <>
      <div className="flex items-start border-t border-stone-100 px-3 py-2.5 text-sm">{label}</div>
      {children}
    </>
  )
}

function Cell({ focus, children }) {
  return <div className={`min-h-14 space-y-1 border-t border-stone-100 px-1 py-1.5 ${focus ? 'bg-brand-soft/40' : ''}`}>{children}</div>
}
