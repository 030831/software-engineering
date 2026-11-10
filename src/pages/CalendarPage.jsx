import { useState } from 'react'
import { addMonths, format } from 'date-fns'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { useStore } from '../store/AppStore'
import { calendarEventsFor } from '../lib/events'
import MonthGrid from '../components/MonthGrid'
import DayModal from '../components/DayModal'
import EventModal from '../components/EventModal'
import { Button } from '../components/ui'

export default function CalendarPage() {
  const { state, me } = useStore()
  const [month, setMonth] = useState(() => new Date())
  const [day, setDay] = useState(null)
  // editing: null | { event } | { date }
  const [editing, setEditing] = useState(null)

  const events = calendarEventsFor(state, me.id)

  return (
    <div className="flex h-full flex-col p-6 pl-2">
      <div className="mb-4 flex items-center gap-2 px-1">
        <h1 className="mr-3 text-[22px] font-bold tracking-tight tabular-nums">
          {format(month, 'yyyy년')} <span className="text-stone-400">{format(month, 'M월')}</span>
        </h1>
        <div className="flex items-center rounded-xl bg-white shadow-card">
          <Button variant="ghost" className="rounded-r-none px-2" onClick={() => setMonth((m) => addMonths(m, -1))} aria-label="이전 달">
            <ChevronLeft size={17} />
          </Button>
          <Button variant="ghost" className="rounded-none px-3 text-[13px]" onClick={() => setMonth(new Date())}>
            오늘
          </Button>
          <Button variant="ghost" className="rounded-l-none px-2" onClick={() => setMonth((m) => addMonths(m, 1))} aria-label="다음 달">
            <ChevronRight size={17} />
          </Button>
        </div>
        <Button variant="primary" className="ml-auto" onClick={() => setEditing({ date: new Date() })}>
          <Plus size={16} /> 일정
        </Button>
      </div>
      <div className="card min-h-0 flex-1 overflow-hidden">
        <MonthGrid month={month} events={events} teams={state.teams} onDayClick={setDay} onEventClick={(event) => setEditing({ event })} />
      </div>

      {day && (
        <DayModal
          day={day}
          onClose={() => setDay(null)}
          onAdd={() => setEditing({ date: day })}
          onEdit={(event) => setEditing({ event })}
        />
      )}
      {editing && <EventModal event={editing.event} defaultDate={editing.date} onClose={() => setEditing(null)} />}
    </div>
  )
}
