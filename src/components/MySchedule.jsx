import { useEffect, useState } from 'react'
import { addDays, format, isSameDay, isToday, parseISO, startOfWeek } from 'date-fns'
import { ko } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Lock } from 'lucide-react'
import { useStore } from '../store/AppStore'
import { calendarEventsFor, eventsOnDay } from '../lib/events'
import { viewOf } from '../lib/visibility'
import { Avatar, Button } from './ui'

const hm = (s) => format(typeof s === 'string' ? parseISO(s) : s, 'HH:mm')

// 팀 화면 아래의 주간 표. 이 팀의 일정, 내 일정, 그리고 팀원 일정을 공개 범위에 맞춰 보여준다.
// focusDate: 정하는 중인 일정의 날짜(그 주로 이동), preview: 추가될 일정 { title, date, duration, start?, end? }
export default function MySchedule({ team, members, focusDate, preview }) {
  const { state, me } = useStore()
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))

  useEffect(() => {
    if (focusDate) setWeekStart(startOfWeek(parseISO(focusDate), { weekStartsOn: 1 }))
  }, [focusDate])

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const mine = calendarEventsFor(state, me.id)
  const teamEvents = mine.filter((e) => e.kind === 'team' && e.team_id === team.id)
  const myEvents = mine.filter((e) => !(e.kind === 'team' && e.team_id === team.id))
  const others = members.filter((m) => m.id !== me.id)
  const clashes = (ev) => preview?.start && parseISO(ev.start) < preview.end && parseISO(ev.end) > preview.start

  return (
    <section className="rounded-2xl border border-stone-200 bg-white">
      <div className="flex items-center gap-2 border-b border-stone-200 px-5 py-3">
        <h2 className="font-semibold">주간 일정</h2>
        <span className="flex items-center gap-3 text-xs text-stone-500">
          <span className="flex items-center gap-1">
            <span className="size-2.5 rounded-sm bg-stone-200" /> 전체·팀 공개: 제목까지
          </span>
          <span className="flex items-center gap-1">
            <span className="busy-stripe size-2.5 rounded-sm border border-stone-300" /> 부분 공개: 바쁨만
          </span>
          <span>완전 비공개: 안 보임</span>
        </span>
        <div className="ml-auto flex items-center gap-1 text-sm">
          <Button variant="ghost" className="px-1.5" onClick={() => setWeekStart((d) => addDays(d, -7))} aria-label="이전 주">
            <ChevronLeft size={16} />
          </Button>
          {format(weekStart, 'M/d')} – {format(addDays(weekStart, 6), 'M/d')}
          <Button variant="ghost" className="px-1.5" onClick={() => setWeekStart((d) => addDays(d, 7))} aria-label="다음 주">
            <ChevronRight size={16} />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-[110px_repeat(7,minmax(0,1fr))] text-xs">
        <div />
        {days.map((d) => {
          const focus = focusDate && isSameDay(d, parseISO(focusDate))
          return (
            <div
              key={d.toISOString()}
              className={`border-l border-stone-100 px-2 py-2 ${focus ? 'bg-stone-100 font-semibold text-stone-900' : isToday(d) ? 'font-semibold text-stone-900' : 'text-stone-400'}`}
            >
              {format(d, 'd (EEE)', { locale: ko })}
            </div>
          )
        })}

        <Row label={<span className="font-medium" style={{ color: team.color }}>팀 일정</span>}>
          {days.map((d) => (
            <Cell key={d.toISOString()} focus={focusDate && isSameDay(d, parseISO(focusDate))}>
              {[
                ...eventsOnDay(teamEvents, d).map((ev) => ({
                  order: ev.all_day ? '' : hm(ev.start),
                  node: (
                    <div key={ev.id} className="truncate rounded px-1.5 py-1 text-white" style={{ background: team.color }}>
                      {ev.all_day ? ev.title : `${hm(ev.start)} ${ev.title}`}
                    </div>
                  ),
                })),
                // 정하는 중인 일정은 시간 순서에 맞는 자리에 다른 색으로 끼워 넣는다 (시간 미정이면 맨 아래)
                ...(preview && isSameDay(parseISO(preview.date), d) ? [{ order: preview.start ? hm(preview.start) : '~', node: <Pending key="preview" preview={preview} /> }] : []),
              ]
                .sort((a, b) => a.order.localeCompare(b.order))
                .map((item) => item.node)}
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
            <Cell key={d.toISOString()} focus={focusDate && isSameDay(d, parseISO(focusDate))}>
              {eventsOnDay(myEvents, d)
                .filter((ev) => !ev.all_day)
                .map((ev) => {
                  const clash = clashes(ev)
                  return (
                    <div key={ev.id} className={`rounded px-1.5 py-1 ${clash ? 'bg-red-50 text-red-900 ring-1 ring-red-300' : 'bg-emerald-50 text-emerald-900'}`}>
                      <div className="flex items-center gap-1">
                        <span className="truncate">{ev.title}</span>
                        {ev.visibility === 'private' && <Lock size={10} className="shrink-0 opacity-60" />}
                      </div>
                      <div className="text-[10px] opacity-70">
                        {hm(ev.start)}–{hm(ev.end)}
                      </div>
                    </div>
                  )
                })}
            </Cell>
          ))}
        </Row>

        {others.map((m) => {
          const events = state.events.filter((e) => e.kind === 'personal' && e.owner_id === m.id && !e.all_day && viewOf(e, team.id) !== 'hidden')
          return (
            <Row
              key={m.id}
              label={
                <span className="flex items-center gap-2 text-stone-600">
                  <Avatar profile={m} size="sm" /> {m.name}
                </span>
              }
            >
              {days.map((d) => (
                <Cell key={d.toISOString()} focus={focusDate && isSameDay(d, parseISO(focusDate))}>
                  {eventsOnDay(events, d).map((ev) => {
                    const ring = clashes(ev) ? 'ring-1 ring-red-300' : ''
                    return viewOf(ev, team.id) === 'full' ? (
                      <div key={ev.id} className={`rounded bg-stone-100 px-1.5 py-1 text-stone-800 ${ring}`}>
                        <div className="truncate">{ev.title}</div>
                        <div className="text-[10px] opacity-70">
                          {hm(ev.start)}–{hm(ev.end)}
                        </div>
                      </div>
                    ) : (
                      <div key={ev.id} className={`busy-stripe rounded border border-stone-200 px-1.5 py-1 text-stone-500 ${ring}`}>
                        <div>바쁨</div>
                        <div className="text-[10px] text-stone-400">
                          {hm(ev.start)}–{hm(ev.end)}
                        </div>
                      </div>
                    )
                  })}
                </Cell>
              ))}
            </Row>
          )
        })}
      </div>
    </section>
  )
}

function Pending({ preview }) {
  const h = Math.floor(preview.duration / 60)
  const m = preview.duration % 60
  const length = [h && `${h}시간`, m && `${m}분`].filter(Boolean).join(' ')
  return (
    <div className="rounded border-2 border-dashed border-amber-400 bg-amber-50 px-1.5 py-1 text-amber-900">
      <div className="text-[10px] font-semibold text-amber-700">추가 예정</div>
      <div className="truncate font-medium">{preview.title}</div>
      <div className="text-[10px] text-amber-800">{preview.start ? `${hm(preview.start)}–${hm(preview.end)}` : `시간 미정 · ${length}`}</div>
    </div>
  )
}

function Row({ label, children }) {
  return (
    <>
      <div className="flex items-start border-t border-stone-100 px-4 py-2 text-sm">{label}</div>
      {children}
    </>
  )
}

function Cell({ focus, children }) {
  return <div className={`min-h-16 space-y-1 border-l border-t border-stone-100 p-1 ${focus ? 'bg-stone-50' : ''}`}>{children}</div>
}
