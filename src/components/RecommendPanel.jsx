import { useRef, useState } from 'react'
import { addDays, addMinutes, format, isSameDay, parseISO, startOfDay } from 'date-fns'
import { ko } from 'date-fns/locale'
import { CalendarCheck, Plus, Sparkles, X } from 'lucide-react'
import { useStore } from '../store/AppStore'
import { busyIntervalsFor } from '../lib/events'
import { bestStartInWindow, freeWindows, startCandidates } from '../lib/recommend'
import { Avatar, Button, inputClass } from './ui'
import MySchedule from './MySchedule'

const DURATIONS = [
  { value: 30, label: '30분' },
  { value: 60, label: '1시간' },
  { value: 90, label: '1시간 30분' },
  { value: 120, label: '2시간' },
]

const lengthLabel = (min) => {
  const h = Math.floor(min / 60)
  const m = min % 60
  return [h && `${h}시간`, m && `${m}분`].filter(Boolean).join(' ')
}
const dayLabel = (date) => format(parseISO(date), 'M/d (EEE)', { locale: ko })
const hm = (d) => format(d, 'HH:mm')
// 시작이 같은 구간이 여럿일 수 있어(예: 11:30–13:00 모두 / 11:30–18:00 일부) 끝과 인원까지 넣는다
const windowKey = (w) => `${w.start.toISOString()}-${w.end.toISOString()}-${w.available}`

// 흐름: 정할 일정(날짜·길이 정해짐) 고르기 → 그날 빈 구간 고르기 → 막대에서 시작 시간 정하기 → 확정(한 번만)
// 또는 고른 시간을 후보로 올려 팀원들이 원하는 시간을 투표하고, 후보 중 하나로 확정 (임시)
export default function RecommendPanel({ team, members }) {
  const { state, me, addRequest, scheduleRequest, addCandidate, removeCandidate, vote } = useStore()
  // 날짜가 지난 요청은 고를 시간이 없으니 목록에서 숨긴다
  const today = format(new Date(), 'yyyy-MM-dd')
  const openRequests = state.requests.filter((r) => r.team_id === team.id && r.status === 'open')
  const requests = openRequests.filter((r) => r.date >= today)
  const pastCount = openRequests.length - requests.length

  const [requestId, setRequestId] = useState(null)
  const [selectedKey, setSelectedKey] = useState(null)
  const [start, setStart] = useState(null)
  const [confirmed, setConfirmed] = useState(null)
  // 같은 일정을 다시 눌러도 아래 표가 그 주로 돌아가도록 누를 때마다 올린다
  const [focusTick, setFocusTick] = useState(0)

  const request = requests.find((r) => r.id === requestId) ?? null
  const busy = Object.fromEntries(members.map((m) => [m.id, busyIntervalsFor(state, m.id)]))
  const windowsFor = (r) => (r ? freeWindows({ members, busy, day: parseISO(r.date), durationMin: r.duration }) : [])
  const windows = windowsFor(request)
  const full = windows.filter((w) => w.available === w.total)
  const partial = windows.filter((w) => w.available < w.total)
  const selected = windows.find((w) => windowKey(w) === selectedKey) ?? null

  const pickWindow = (w, r = request) => {
    setSelectedKey(windowKey(w))
    setStart(bestStartInWindow({ window: w, durationMin: r.duration, members, busy }).start)
  }

  // 일정을 고르면 가장 많이 참석할 수 있는 구간 중 점수가 제일 높은 시간을 바로 골라 두어,
  // 아래 표에 추가될 위치가 곧장 보이게 한다
  const pickRequest = (id) => {
    setRequestId(id)
    setFocusTick((n) => n + 1)
    setSelectedKey(null)
    setStart(null)
    setConfirmed(null)
    const r = requests.find((x) => x.id === id)
    const ws = windowsFor(r)
    const topTier = ws.filter((w) => w.available === ws[0]?.available)
    let best = null
    for (const w of topTier) {
      const b = bestStartInWindow({ window: w, durationMin: r.duration, members, busy })
      if (!best || b.score > best.score) best = { ...b, w }
    }
    if (best) {
      setSelectedKey(windowKey(best.w))
      setStart(best.start)
    }
  }

  const confirmAt = (start) => {
    const end = addMinutes(start, request.duration)
    scheduleRequest(request.id, {
      title: request.title,
      start: format(start, "yyyy-MM-dd'T'HH:mm"),
      end: format(end, "yyyy-MM-dd'T'HH:mm"),
      all_day: false,
      visibility: 'team',
      team_id: team.id,
      kind: 'team',
    })
    setConfirmed({ title: request.title, label: `${dayLabel(request.date)} ${hm(start)}–${hm(end)}`, date: request.date })
    pickRequest(null)
  }
  const onConfirm = () => confirmAt(start)
  const onAddCandidate = () =>
    addCandidate(request.id, { start: format(start, "yyyy-MM-dd'T'HH:mm"), end: format(addMinutes(start, request.duration), "yyyy-MM-dd'T'HH:mm") })

  return (
    <>
      <section className="rounded-2xl border border-stone-200 bg-white">
        <div className="flex items-center gap-2 border-b border-stone-200 px-5 py-3">
          <Sparkles size={16} />
          <h2 className="font-semibold">약속 시간 정하기</h2>
          <span className="text-xs text-stone-400">팀원 일정에 맞춰 그날 비어 있는 시간을 보여줘요</span>
        </div>

        <div className="grid grid-cols-[300px_minmax(0,1fr)] gap-6 p-5">
          <div className="space-y-1.5 text-sm">
            <div className="mb-1 text-xs text-stone-500">정해야 할 일정</div>
            {requests.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => pickRequest(r.id)}
                className={`w-full rounded-xl border px-3 py-2.5 text-left transition ${
                  requestId === r.id ? 'border-stone-900 ring-1 ring-stone-900' : 'border-stone-200 hover:bg-stone-50'
                }`}
              >
                <div className="font-semibold">{r.title}</div>
                <div className="mt-0.5 text-xs text-stone-500">
                  {dayLabel(r.date)} · {lengthLabel(r.duration)}
                </div>
              </button>
            ))}
            {requests.length === 0 && <p className="text-xs text-stone-400">정해야 할 일정이 없어요.</p>}
            {pastCount > 0 && <p className="px-1 text-[11px] text-stone-400">날짜가 지난 일정 {pastCount}개는 숨겼어요.</p>}
            <AddRequest onAdd={(req) => addRequest(team.id, req)} />
          </div>

          <div>
            {confirmed && !request && (
              <div className="flex items-center gap-3 rounded-xl bg-emerald-50 p-4">
                <CalendarCheck size={20} className="text-emerald-700" />
                <div>
                  <div className="font-semibold text-emerald-900">{confirmed.title}</div>
                  <div className="text-sm text-emerald-800">{confirmed.label} · 팀 달력에 추가했어요</div>
                </div>
              </div>
            )}
            {!confirmed && !request && (
              <div className="flex h-full min-h-40 items-center justify-center rounded-xl border border-dashed border-stone-200 text-sm text-stone-400">
                왼쪽에서 정해야 할 일정을 고르세요.
              </div>
            )}
            {request && (
              <div className="space-y-4">
                <div className="text-sm">
                  <span className="font-semibold">{request.title}</span>
                  <span className="text-stone-500">
                    {' '}
                    · {dayLabel(request.date)} · {lengthLabel(request.duration)}
                  </span>
                </div>

                <WindowGroup title="모두 참석 가능">
                  {full.map((w) => (
                    <WindowBox key={windowKey(w)} win={w} on={selectedKey === windowKey(w)} onClick={() => pickWindow(w)}>
                      모두 참석 · {lengthLabel((w.end - w.start) / 60000)} 비어 있음
                    </WindowBox>
                  ))}
                  {full.length === 0 && <p className="col-span-3 text-xs text-stone-400">이날은 모두가 되는 시간이 없어요.</p>}
                </WindowGroup>

                {partial.length > 0 && (
                  <WindowGroup title="일부만 참석 가능">
                    {partial.map((w) => (
                      <WindowBox key={windowKey(w)} win={w} on={selectedKey === windowKey(w)} onClick={() => pickWindow(w)}>
                        <span className="text-amber-700">
                          {w.available}/{w.total}명 참석
                        </span>{' '}
                        · {lengthLabel((w.end - w.start) / 60000)}
                      </WindowBox>
                    ))}
                  </WindowGroup>
                )}

                {selected && start && (
                  <TimelinePicker win={selected} duration={request.duration} start={start} onChange={setStart} title={request.title} />
                )}

                <div className="flex items-center gap-2 border-t border-stone-100 pt-3">
                  <Button className="ml-auto" disabled={!selected} onClick={onAddCandidate}>
                    <Plus size={15} /> 투표 후보에 추가
                  </Button>
                  <Button variant="primary" disabled={!selected} onClick={onConfirm}>
                    {selected && start ? `${hm(start)}–${hm(addMinutes(start, request.duration))}로 확정` : '빈 시간을 고르세요'}
                  </Button>
                </div>

                <CandidateVote
                  request={request}
                  members={members}
                  busy={busy}
                  me={me}
                  onVote={(candidateId, value) => vote(request.id, candidateId, value)}
                  onRemove={(candidateId) => removeCandidate(request.id, candidateId)}
                  onConfirm={(c) => confirmAt(parseISO(c.start))}
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
        focusDate={request?.date ?? confirmed?.date}
        preview={
          request && {
            title: request.title,
            date: request.date,
            duration: request.duration,
            start: selected && start,
            end: selected && start && addMinutes(start, request.duration),
          }
        }
      />
    </>
  )
}

const VOTES = [
  { value: 2, label: '좋음', on: 'border-emerald-600 bg-emerald-600 text-white' },
  { value: 1, label: '괜찮음', on: 'border-amber-500 bg-amber-500 text-white' },
  { value: 0, label: '싫음', on: 'border-stone-500 bg-stone-500 text-white' },
]

// 후보 시간마다 팀원이 원하는 정도를 표시한다. 점수 = 좋음 2 + 괜찮음 1 (싫음 0). 선호 시간대 설정과는 따로 간다.
function CandidateVote({ request, members, busy, me, onVote, onRemove, onConfirm }) {
  const candidates = [...(request.candidates ?? [])].sort((a, b) => a.start.localeCompare(b.start))
  const votesOf = (c) => request.votes?.[c.id] ?? {}
  const total = (c) => Object.values(votesOf(c)).reduce((sum, v) => sum + v, 0)
  const top = Math.max(0, ...candidates.map(total))

  return (
    <div className="rounded-xl border border-stone-200">
      <div className="flex items-center gap-2 border-b border-stone-100 px-4 py-2.5">
        <span className="text-sm font-semibold">원하는 시간 투표</span>
        <span className="text-xs text-stone-400">가능한 시간 중에서 언제가 좋은지 골라요</span>
      </div>
      {candidates.length === 0 && (
        <p className="px-4 py-3 text-xs text-stone-400">위에서 시간을 고르고 '투표 후보에 추가'를 누르면 팀원들이 원하는 시간을 고를 수 있어요.</p>
      )}
      {candidates.map((c) => {
        const s = parseISO(c.start).getTime()
        const e = parseISO(c.end).getTime()
        const available = members.filter((m) => !(busy[m.id] ?? []).some((iv) => iv.start < e && iv.end > s)).length
        const votes = votesOf(c)
        const best = top > 0 && total(c) === top
        return (
          <div key={c.id} className={`flex items-center gap-3 border-t border-stone-100 px-4 py-2.5 first:border-t-0 ${best ? 'bg-emerald-50/60' : ''}`}>
            <div className="w-28 shrink-0">
              <div className="text-sm font-semibold">
                {hm(parseISO(c.start))}–{hm(parseISO(c.end))}
              </div>
              <div className={`text-[11px] ${available === members.length ? 'text-stone-500' : 'text-amber-700'}`}>
                {available}/{members.length}명 가능
              </div>
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              {best && <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-800">가장 많이 원함</span>}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-stone-500">
                {VOTES.map((v) => {
                  const who = members.filter((m) => votes[m.id] === v.value)
                  return (
                    <span key={v.value} className="flex items-center gap-1">
                      {v.label} {who.length}
                      <span className="flex -space-x-1">
                        {who.map((m) => (
                          <Avatar key={m.id} profile={m} size="xs" ring />
                        ))}
                      </span>
                    </span>
                  )
                })}
              </div>
            </div>
            <div className="flex shrink-0 gap-1">
              {VOTES.map((v) => (
                <button
                  key={v.value}
                  type="button"
                  onClick={() => onVote(c.id, v.value)}
                  className={`rounded-md border px-2 py-1 text-xs transition ${votes[me.id] === v.value ? v.on : 'border-stone-200 text-stone-600 hover:bg-stone-50'}`}
                >
                  {v.label}
                </button>
              ))}
            </div>
            <Button className="shrink-0" onClick={() => onConfirm(c)}>
              확정
            </Button>
            {c.created_by === me.id ? (
              <button type="button" onClick={() => onRemove(c.id)} className="shrink-0 rounded p-1 text-stone-400 hover:bg-stone-100" aria-label="후보 삭제">
                <X size={14} />
              </button>
            ) : (
              <span className="w-[22px] shrink-0" />
            )}
          </div>
        )
      })}
    </div>
  )
}

function WindowGroup({ title, children }) {
  return (
    <div>
      <div className="mb-1.5 text-xs text-stone-500">{title}</div>
      <div className="grid grid-cols-3 gap-1.5">{children}</div>
    </div>
  )
}

function WindowBox({ win, on, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-3 py-2 text-left transition ${on ? 'border-stone-900 ring-1 ring-stone-900' : 'border-stone-200 hover:bg-stone-50'}`}
    >
      <div className="text-sm font-semibold">
        {hm(win.start)}–{hm(win.end)}
      </div>
      <div className="mt-0.5 text-[11px] text-stone-500">{children}</div>
    </button>
  )
}

// 고른 빈 구간만큼의 트랙 위에 회의 길이만큼의 박스 하나를 두고, 끌어서(또는 트랙을 눌러서) 구간 안에서만 옮긴다.
function TimelinePicker({ win, duration, start, onChange, title }) {
  const trackRef = useRef(null)
  const dragRef = useRef(null)
  const toMin = (d) => d.getHours() * 60 + d.getMinutes()
  const winStart = toMin(win.start)
  const length = (win.end - win.start) / 60000
  const maxOffset = length - duration
  const offset = (start - win.start) / 60000
  const end = addMinutes(start, duration)
  const pct = (min) => (min / length) * 100

  // 박스 왼쪽 끝이 놓일 x 좌표 → 가장 가까운 시작 후보 (추천과 같은 후보라 구간 밖으로 못 나간다)
  const candidates = startCandidates(win, duration)
  const startAt = (leftPx) => {
    const rect = trackRef.current.getBoundingClientRect()
    const raw = addMinutes(win.start, (leftPx / rect.width) * length)
    return candidates.reduce((best, c) => (Math.abs(c - raw) < Math.abs(best - raw) ? c : best))
  }

  const onBoxDown = (e) => {
    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = e.clientX - e.currentTarget.getBoundingClientRect().left
  }
  const onBoxMove = (e) => {
    if (dragRef.current === null) return
    onChange(startAt(e.clientX - trackRef.current.getBoundingClientRect().left - dragRef.current))
  }
  const onBoxUp = () => {
    dragRef.current = null
  }
  // 트랙의 빈 곳을 누르면 그 지점이 회의 가운데가 되게 옮긴다
  const onTrackDown = (e) => {
    const rect = trackRef.current.getBoundingClientRect()
    onChange(startAt(e.clientX - rect.left - (duration / length) * rect.width / 2))
  }

  const winEnd = winStart + length
  const hourTicks = []
  for (let m = Math.ceil(winStart / 30) * 30; m <= winEnd; m += 30) hourTicks.push(m)
  // 아래 라벨: 구간 양 끝은 항상, 정각은 양 끝과 겹치지 않을 때만
  const labels = [winStart, ...hourTicks.filter((m) => m % 60 === 0 && m - winStart >= 20 && winEnd - m >= 20), winEnd]

  return (
    <div className="rounded-xl bg-stone-50 p-4">
      <div className="mb-2 flex items-center text-xs text-stone-500">
        {maxOffset > 0
          ? `${hm(win.start)}–${hm(win.end)} 안에서 박스를 끌어 시간을 정하세요`
          : `${hm(win.start)}–${hm(win.end)}에 딱 맞는 길이예요`}
        <span className="ml-auto text-sm font-semibold text-stone-900">
          {hm(start)}–{hm(end)} <span className="font-normal text-stone-500">{title}</span>
        </span>
      </div>
      <div ref={trackRef} onPointerDown={onTrackDown} className="relative h-11 cursor-pointer rounded-md border border-stone-200 bg-white">
        {hourTicks.map((m) => (
          <div key={m} className={`absolute inset-y-0 w-px ${m % 60 ? 'bg-stone-100' : 'bg-stone-200'}`} style={{ left: `${pct(m - winStart)}%` }} />
        ))}
        <div
          onPointerDown={onBoxDown}
          onPointerMove={onBoxMove}
          onPointerUp={onBoxUp}
          onPointerCancel={onBoxUp}
          className={`absolute inset-y-1 flex touch-none items-center justify-center overflow-hidden rounded border-2 border-amber-400 bg-amber-100 text-[11px] font-semibold whitespace-nowrap text-amber-900 select-none ${maxOffset > 0 ? 'cursor-grab active:cursor-grabbing' : ''}`}
          style={{ left: `${pct(offset)}%`, width: `${pct(duration)}%` }}
        >
          {hm(start)}–{hm(end)}
        </div>
      </div>
      <div className="relative mt-1 h-4">
        {labels.map((m) => (
          <span key={m} className="absolute -translate-x-1/2 text-[10px] text-stone-400" style={{ left: `${pct(m - winStart)}%` }}>
            {String(Math.floor(m / 60)).padStart(2, '0')}:{String(m % 60).padStart(2, '0')}
          </span>
        ))}
      </div>
    </div>
  )
}

// 새로 정할 일정 추가: 이름만 입력하고, 날짜와 길이는 눌러서 고른다
function AddRequest({ onAdd }) {
  const today = startOfDay(new Date())
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(() => addDays(today, 1))
  const [duration, setDuration] = useState(60)
  const [error, setError] = useState('')

  const submit = (e) => {
    e.preventDefault()
    if (!title.trim()) return setError('일정 이름을 입력하세요.')
    onAdd({ title: title.trim(), date: format(date, 'yyyy-MM-dd'), duration })
    setOpen(false)
    setTitle('')
    setError('')
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-1 px-1 pt-1 text-xs text-stone-500 hover:text-stone-900">
        <Plus size={13} /> 정할 일정 추가
      </button>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-2.5 rounded-xl border border-stone-200 p-3">
      <input autoFocus value={title} onChange={(e) => (setTitle(e.target.value), setError(''))} placeholder="기말 발표 리허설" className={inputClass} />
      <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
        {Array.from({ length: 21 }, (_, i) => addDays(today, i)).map((d) => {
          const on = isSameDay(d, date)
          return (
            <button
              type="button"
              key={d.toISOString()}
              onClick={() => setDate(d)}
              className={`flex w-10 shrink-0 flex-col items-center rounded-lg border py-1 ${on ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-200 hover:bg-stone-50'}`}
            >
              <span className={`text-[10px] ${on ? 'text-stone-300' : 'text-stone-400'}`}>{isSameDay(d, today) ? '오늘' : format(d, 'EEE', { locale: ko })}</span>
              <span className="text-sm font-semibold">{format(d, 'd')}</span>
            </button>
          )
        })}
      </div>
      <div className="grid grid-cols-4 gap-1">
        {DURATIONS.map((d) => (
          <button
            type="button"
            key={d.value}
            onClick={() => setDuration(d.value)}
            className={`rounded-md border py-1.5 text-[11px] ${duration === d.value ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-200 hover:bg-stone-50'}`}
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
