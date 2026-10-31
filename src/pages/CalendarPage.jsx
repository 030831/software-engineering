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
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-stone-200 bg-white px-5 py-3">
        <h1 className="mr-2 text-lg font-semibold">{format(month, 'yyyy년 M월')}</h1>
        <Button variant="ghost" className="px-1.5" onClick={() => setMonth((m) => addMonths(m, -1))} aria-label="이전 달">
          <ChevronLeft size={18} />
        </Button>
        <Button variant="ghost" className="px-1.5" onClick={() => setMonth((m) => addMonths(m, 1))} aria-label="다음 달">
          <ChevronRight size={18} />
        </Button>
        <Button onClick={() => setMonth(new Date())}>오늘</Button>
        <Button variant="primary" className="ml-auto" onClick={() => setEditing({ date: new Date() })}>
          <Plus size={16} /> 일정
        </Button>
      </div>
      <div className="min-h-0 flex-1">
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
