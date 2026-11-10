import {
  addMinutes,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { Lock } from 'lucide-react'
import { eventColor, eventsOnDay, shadeText } from '../lib/events'

const DOW = ['일', '월', '화', '수', '목', '금', '토']
const MAX_CHIPS = 3

export default function MonthGrid({ month, events, teams, onDayClick, onEventClick }) {
  const days = eachDayOfInterval({ start: startOfWeek(startOfMonth(month)), end: endOfWeek(endOfMonth(month)) })

  return (
    <div className="flex h-full flex-col">
      <div className="grid grid-cols-7 border-b border-stone-100 text-[11px] font-semibold text-stone-400">
        {DOW.map((d, i) => (
          <div key={d} className={`px-3 py-2.5 ${i === 0 ? 'text-rose-400' : i === 6 ? 'text-sky-500' : ''}`}>
            {d}
          </div>
        ))}
      </div>
      <div className="grid flex-1 grid-cols-7" style={{ gridTemplateRows: `repeat(${days.length / 7}, minmax(96px, 1fr))` }}>
        {days.map((day) => {
          const list = eventsOnDay(events, day)
          const inMonth = isSameMonth(day, month)
          return (
            <div
              key={day.toISOString()}
              onClick={() => onDayClick(day)}
              className={`group cursor-pointer overflow-hidden border-b border-r border-stone-100 p-1.5 transition-colors hover:bg-stone-50/80 [&:nth-child(7n)]:border-r-0 ${inMonth ? 'bg-white' : 'bg-stone-50/50'}`}
            >
              <span
                className={`mb-1 inline-flex size-6 items-center justify-center rounded-full text-xs font-medium tabular-nums ${
                  isToday(day) ? 'bg-brand font-semibold text-white' : !inMonth ? 'text-stone-300' : day.getDay() === 0 ? 'text-rose-400' : 'text-stone-700'
                }`}
              >
                {format(day, 'd')}
              </span>
              <div className="space-y-0.5">
                {list.slice(0, MAX_CHIPS).map((ev) => (
                  <Chip key={ev.id} ev={ev} day={day} color={eventColor(ev, teams)} onClick={onEventClick} />
                ))}
                {list.length > MAX_CHIPS && <div className="px-1.5 text-[11px] text-stone-400">+{list.length - MAX_CHIPS}개</div>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Chip({ ev, day, color, onClick }) {
  const start = parseISO(ev.start)
  const lastDay = addMinutes(parseISO(ev.end), -1)
  const handle = (e) => {
    e.stopPropagation()
    onClick(ev)
  }

  // 여러 날에 걸친 일정은 이어지는 막대로 그린다
  if (ev.all_day || !isSameDay(start, lastDay)) {
    const first = isSameDay(start, day) || day.getDay() === 0
    const last = isSameDay(lastDay, day) || day.getDay() === 6
    return (
      <div
        onClick={handle}
        className={`h-5 truncate px-1.5 text-[11px] font-medium leading-5 ${first ? 'rounded-l-md' : '-ml-1.5'} ${last ? 'rounded-r-md' : '-mr-1.5'}`}
        style={{ background: `${color}2e`, color: shadeText(color) }}
      >
        {first ? ev.title : ' '}
      </div>
    )
  }

  return (
    <div
      onClick={handle}
      className={`flex h-5 items-center gap-1 rounded-md px-1.5 text-[11px] transition hover:brightness-95 ${ev.done ? 'text-stone-400 line-through' : 'text-stone-800'}`}
      style={{ background: `${color}17` }}
    >
      <span className="h-2.5 w-[3px] shrink-0 rounded-full" style={{ background: color }} />
      <span className="shrink-0 tabular-nums text-stone-400">{format(start, 'HH:mm')}</span>
      <span className="truncate">{ev.title}</span>
      {ev.visibility === 'busy' && <Lock size={10} className="shrink-0 text-stone-400" />}
    </div>
  )
}
