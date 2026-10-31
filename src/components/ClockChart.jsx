import { isSameDay } from 'date-fns'
import { minutesInDay } from '../lib/events'

const C = 120
const R = 92
const W = 26

const angle = (minute) => (minute / 1440) * 2 * Math.PI
const point = (r, a) => [C + r * Math.sin(a), C - r * Math.cos(a)]

function arcPath(fromMin, toMin) {
  const a0 = angle(fromMin) + 0.008
  const a1 = angle(toMin) - 0.008
  const [x0, y0] = point(R, a0)
  const [x1, y1] = point(R, a1)
  return `M${x0} ${y0} A${R} ${R} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1} ${y1}`
}

// 24시간 원형 시간표. 맨 위가 0시, 시계 방향으로 흐른다.
export default function ClockChart({ day, events, colorOf, onSelect }) {
  const now = new Date()
  const showHand = isSameDay(day, now)
  const nowAngle = angle(now.getHours() * 60 + now.getMinutes())
  const timed = events.filter((e) => !e.all_day)

  return (
    <svg viewBox="0 0 240 240" className="w-full max-w-[280px]" role="img" aria-label="24시간 시계형 시간표">
      <circle cx={C} cy={C} r={R} fill="none" stroke="#efede8" strokeWidth={W} />
      {Array.from({ length: 24 }, (_, h) => {
        const a = angle(h * 60)
        const [x0, y0] = point(h % 6 ? 108 : 105, a)
        const [x1, y1] = point(112, a)
        return <line key={h} x1={x0} y1={y0} x2={x1} y2={y1} stroke="#a8a29e" strokeWidth={h % 6 ? 0.6 : 1.4} />
      })}
      {timed.map((ev) => {
        const { from, to } = minutesInDay(ev, day)
        if (to - from <= 0) return null
        const d = to - from >= 1440 ? null : arcPath(from, to)
        return d ? (
          <path
            key={ev.id}
            d={d}
            fill="none"
            stroke={colorOf(ev)}
            strokeWidth={W}
            opacity={ev.done ? 0.4 : 1}
            className="cursor-pointer transition-opacity hover:opacity-80"
            onClick={() => onSelect?.(ev)}
          >
            <title>{ev.title}</title>
          </path>
        ) : (
          <circle key={ev.id} cx={C} cy={C} r={R} fill="none" stroke={colorOf(ev)} strokeWidth={W} />
        )
      })}
      {[
        ['0', C, 56],
        ['6', 188, C + 4],
        ['12', C, 192],
        ['18', 52, C + 4],
      ].map(([t, x, y]) => (
        <text key={t} x={x} y={y} textAnchor="middle" fontSize="11" fill="#a8a29e">
          {t}
        </text>
      ))}
      {showHand && (
        <>
          <line x1={C} y1={C} x2={point(56, nowAngle)[0]} y2={point(56, nowAngle)[1]} stroke="#1c1917" strokeWidth="2" strokeLinecap="round" />
          <circle cx={C} cy={C} r="4" fill="#1c1917" />
        </>
      )}
      <text x={C} y={showHand ? C + 30 : C + 4} textAnchor="middle" fontSize="12" fill="#78716c">
        {timed.length ? `${timed.length}개 일정` : '일정 없음'}
      </text>
    </svg>
  )
}
