import { format, parseISO } from 'date-fns'
import { ko } from 'date-fns/locale'
import { Lock, Plus } from 'lucide-react'
import { useStore } from '../store/AppStore'
import { calendarEventsFor, eventColor, eventsOnDay, PERSONAL_COLOR } from '../lib/events'
import ClockChart from './ClockChart'
import { Button, Modal } from './ui'

export default function DayModal({ day, onClose, onAdd, onEdit }) {
  const { state, me, toggleDone } = useStore()
  const events = eventsOnDay(calendarEventsFor(state, me.id), day)
  const allDay = events.filter((e) => e.all_day)
  const timed = events.filter((e) => !e.all_day)
  const mine = timed.filter((e) => e.kind === 'personal' && e.owner_id === me.id)
  const doneCount = mine.filter((e) => e.done).length
  const colorOf = (ev) => eventColor(ev, state.teams)
  const teamOf = (ev) => (ev.kind === 'team' ? state.teams.find((t) => t.id === ev.team_id) : null)
  // 색 설명: 개인 일정 + 이날 일정이 있는 팀
  const legend = [
    { key: 'personal', label: '개인 일정', color: PERSONAL_COLOR },
    ...[...new Set(events.map((e) => teamOf(e)).filter(Boolean))].map((t) => ({ key: t.id, label: `팀 일정 · ${t.name}`, color: t.color })),
  ]

  return (
    <Modal open onClose={onClose} title={format(day, 'M월 d일 (EEE)', { locale: ko })} width="max-w-3xl">
      <div className="grid grid-cols-[280px_minmax(0,1fr)] items-center gap-6 p-6">
        <div>
          <ClockChart day={day} events={timed} colorOf={colorOf} onSelect={onEdit} />
          <div className="mt-3 flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs text-stone-600">
            {legend.map((l) => (
              <span key={l.key} className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm" style={{ background: l.color }} />
                {l.label}
              </span>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-3 flex items-center gap-2">
            <span className="text-sm font-semibold">오늘 할 일</span>
            {mine.length > 0 && (
              <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-xs text-emerald-700">
                달성 {doneCount}/{mine.length}
              </span>
            )}
          </div>

          {allDay.map((ev) => (
            <div key={ev.id} className="mb-1.5 truncate rounded px-2 py-1 text-xs text-white" style={{ background: colorOf(ev) }}>
              {ev.title}
              {teamOf(ev) && <span className="opacity-80"> · {teamOf(ev).name}</span>}
            </div>
          ))}

          <div className="flex max-h-72 flex-col gap-1.5 overflow-auto">
            {timed.map((ev) => {
              const checkable = ev.kind === 'personal' && ev.owner_id === me.id
              return (
                <div key={ev.id} className="flex items-center gap-2 rounded-lg border border-stone-200 px-2.5 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={ev.done}
                    disabled={!checkable}
                    onChange={() => toggleDone(ev.id)}
                    className="size-4 accent-stone-900 disabled:invisible"
                    aria-label={`${ev.title} 완료`}
                  />
                  <span className="h-5 w-1 rounded" style={{ background: colorOf(ev) }} />
                  <button onClick={() => onEdit(ev)} className={`truncate text-left hover:underline ${ev.done ? 'text-stone-400 line-through' : ''}`}>
                    {ev.title}
                  </button>
                  {ev.visibility === 'private' && <Lock size={12} className="shrink-0 text-stone-400" />}
                  {teamOf(ev) && (
                    <span className="shrink-0 rounded px-1.5 py-0.5 text-[11px]" style={{ background: `${colorOf(ev)}1f`, color: colorOf(ev) }}>
                      {teamOf(ev).name}
                    </span>
                  )}
                  <span className="ml-auto shrink-0 text-xs text-stone-400">
                    {format(parseISO(ev.start), 'HH:mm')}–{format(parseISO(ev.end), 'HH:mm')}
                  </span>
                </div>
              )
            })}
            {events.length === 0 && <p className="text-sm text-stone-400">이 날은 비어 있어요.</p>}
          </div>

          <Button className="mt-3" onClick={onAdd}>
            <Plus size={15} /> 이 날 일정 추가
          </Button>
        </div>
      </div>
    </Modal>
  )
}
