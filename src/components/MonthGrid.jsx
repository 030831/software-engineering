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
import { eventColor, eventsOnDay } from '../lib/events'

const DOW = ['일', '월', '화', '수', '목', '금', '토']
const MAX_CHIPS = 3

export default function MonthGrid({ month, events, teams, onDayClick, onEventClick }) {
  const days = eachDayOfInterval({ start: startOfWeek(startOfMonth(month)), end: endOfWeek(endOfMonth(month)) })

  return (
    <div className="flex h-full flex-col">
      <div className="grid grid-cols-7 border-b border-stone-200 text-xs text-stone-400">
        {DOW.map((d, i) => (
          <div key={d} className={`px-2 py-2 ${i === 0 ? 'text-red-500' : ''}`}>
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
              className={`cursor-pointer overflow-hidden border-b border-r border-stone-200 p-1.5 hover:bg-stone-50 ${inMonth ? 'bg-white' : 'bg-stone-50/60'}`}
            >
              <span
                className={`mb-0.5 inline-flex size-6 items-center justify-center rounded-full text-xs ${
                  isToday(day) ? 'bg-stone-900 font-semibold text-white' : !inMonth ? 'text-stone-300' : day.getDay() === 0 ? 'text-red-500' : ''
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
        className={`h-5 truncate px-1.5 text-[11px] leading-5 text-white ${first ? 'rounded-l' : '-ml-1.5'} ${last ? 'rounded-r' : '-mr-1.5'}`}
        style={{ background: color }}
      >
        {first ? ev.title : ' '}
      </div>
    )
  }

  return (
    <div
      onClick={handle}
      className={`flex h-5 items-center gap-1 rounded px-1.5 text-[11px] ${ev.done ? 'text-stone-400 line-through' : ''}`}
      style={{ background: `${color}1f` }}
    >
      <span className="size-1.5 shrink-0 rounded-full" style={{ background: color }} />
      <span className="shrink-0 text-stone-500">{format(start, 'HH:mm')}</span>
      <span className="truncate">{ev.title}</span>
      {ev.visibility === 'private' && <Lock size={10} className="shrink-0 text-stone-400" />}
    </div>
  )
}
