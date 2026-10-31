import { useState } from 'react'
import { addDays, format, isValid, parseISO } from 'date-fns'
import { Eye, Lock, Trash2 } from 'lucide-react'
import { useStore } from '../store/AppStore'
import { VISIBILITY } from '../lib/visibility'
import { Button, inputClass, Modal } from './ui'

function toForm(ev, defaultDate, myTeams) {
  if (!ev) {
    const date = format(defaultDate ?? new Date(), 'yyyy-MM-dd')
    return {
      title: '',
      date,
      endDate: date,
      startTime: '14:00',
      endTime: '15:00',
      allDay: false,
      visibility: myTeams.length ? 'team' : 'busy',
      team_id: myTeams[0]?.id ?? null,
    }
  }
  const s = parseISO(ev.start)
  const e = parseISO(ev.end)
  return {
    title: ev.title,
    date: format(s, 'yyyy-MM-dd'),
    endDate: format(ev.all_day ? addDays(e, -1) : e, 'yyyy-MM-dd'),
    startTime: format(s, 'HH:mm'),
    endTime: format(e, 'HH:mm'),
    allDay: ev.all_day,
    visibility: ev.visibility,
    team_id: ev.team_id,
  }
}

export default function EventModal({ event, defaultDate, onClose }) {
  const { me, myTeams, saveEvent, deleteEvent } = useStore()
  const [form, setForm] = useState(() => toForm(event, defaultDate, myTeams))
  const [error, setError] = useState('')
  const readOnly = event && event.owner_id !== me.id
  // 끝 시간이 시작보다 이르면 다음 날 끝나는 일정으로 본다 (예: 23:00–01:00)
  const overnight = !form.allDay && form.startTime && form.endTime && form.endTime < form.startTime
  const nextDay = (date) => format(addDays(parseISO(date), 1), 'yyyy-MM-dd')
  const isTeamEvent = event?.kind === 'team'

  const set = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }))
    setError('')
  }

  const onSave = (e) => {
    e.preventDefault()
    if (!form.title.trim()) return setError('제목을 입력하세요.')
    if (!form.date || (form.allDay ? !form.endDate : !form.startTime || !form.endTime)) return setError('날짜와 시간을 모두 정하세요.')
    const start = form.allDay ? `${form.date}T00:00` : `${form.date}T${form.startTime}`
    let end
    if (form.allDay) {
      end = `${format(addDays(parseISO(form.endDate), 1), 'yyyy-MM-dd')}T00:00`
    } else {
      if (form.endTime === form.startTime) return setError('시작과 끝 시간이 같아요.')
      end = `${overnight ? nextDay(form.date) : form.date}T${form.endTime}`
    }
    if (!isValid(parseISO(start)) || !isValid(parseISO(end))) return setError('날짜 형식이 올바르지 않아요.')
    if (end <= start) return setError('끝나는 날이 시작하는 날보다 늦어야 해요.')
    if (form.visibility === 'team' && !form.team_id) return setError('공개할 팀을 고르세요.')

    saveEvent({
      ...(event ?? {}),
      title: form.title.trim(),
      start,
      end,
      all_day: form.allDay,
      visibility: form.visibility,
      team_id: form.visibility === 'team' || isTeamEvent ? form.team_id : null,
    })
    onClose()
  }

  const title = readOnly ? '일정 보기' : event ? '일정 수정' : '새 일정'
  const teamName = myTeams.find((t) => t.id === form.team_id)?.name

  return (
    <Modal open onClose={onClose} title={title} width="max-w-xl">
      <form onSubmit={onSave} className="space-y-4 p-5">
        <input
          autoFocus={!readOnly}
          disabled={readOnly}
          value={form.title}
          onChange={(e) => set('title', e.target.value)}
          placeholder="병원 진료"
          className={`${inputClass} h-10 text-base`}
        />

        <div className="flex items-center gap-2">
          <input type="date" disabled={readOnly} value={form.date} onChange={(e) => set('date', e.target.value)} className={inputClass} />
          {form.allDay ? (
            <>
              <span className="text-stone-400">–</span>
              <input type="date" disabled={readOnly} value={form.endDate} onChange={(e) => set('endDate', e.target.value)} className={inputClass} />
            </>
          ) : (
            <>
              <input type="time" disabled={readOnly} value={form.startTime} onChange={(e) => set('startTime', e.target.value)} className={inputClass} />
              <span className="text-stone-400">–</span>
              <input type="time" disabled={readOnly} value={form.endTime} onChange={(e) => set('endTime', e.target.value)} className={inputClass} />
            </>
          )}
        </div>
        <label className="flex items-center gap-2 text-sm text-stone-600">
          <input type="checkbox" disabled={readOnly} checked={form.allDay} onChange={(e) => set('allDay', e.target.checked)} className="accent-stone-900" />
          하루 종일 / 여러 날
          {overnight && <span className="ml-auto text-xs text-amber-700">다음 날 {form.endTime}에 끝나요</span>}
        </label>

        {!isTeamEvent && (
          <div>
            <div className="mb-2 text-xs text-stone-500">공개 범위</div>
            <div className="grid grid-cols-2 gap-2">
              {VISIBILITY.map(({ key, label, desc, icon: Icon }) => {
                const on = form.visibility === key
                return (
                  <button
                    type="button"
                    key={key}
                    disabled={readOnly}
                    onClick={() => set('visibility', key)}
                    className={`flex items-start gap-2.5 rounded-xl border p-3 text-left transition ${
                      on ? 'border-stone-900 bg-stone-50 ring-1 ring-stone-900' : 'border-stone-200 hover:bg-stone-50'
                    }`}
                  >
                    <Icon size={18} className={on ? 'text-stone-900' : 'text-stone-400'} />
                    <span>
                      <span className="block text-sm font-semibold">{label}</span>
                      <span className="block text-xs text-stone-500">{desc}</span>
                    </span>
                  </button>
                )
              })}
            </div>
            {form.visibility === 'team' && (
              <select
                disabled={readOnly}
                value={form.team_id ?? ''}
                onChange={(e) => set('team_id', e.target.value)}
                className={`${inputClass} mt-2`}
              >
                <option value="" disabled>
                  공개할 팀 선택
                </option>
                {myTeams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {!isTeamEvent && <Preview form={form} owner={me.name} teamName={teamName} />}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex items-center gap-2 pt-1">
          {event && !readOnly && (
            <Button
              type="button"
              variant="danger"
              onClick={() => {
                deleteEvent(event.id)
                onClose()
              }}
            >
              <Trash2 size={15} /> 삭제
            </Button>
          )}
          <Button type="button" className="ml-auto" onClick={onClose}>
            {readOnly ? '닫기' : '취소'}
          </Button>
          {!readOnly && <Button variant="primary">저장</Button>}
        </div>
      </form>
    </Modal>
  )
}

// 공개 범위에 따라 팀원 화면에서 어떻게 보이는지 미리 보여준다
function Preview({ form, owner, teamName }) {
  const time = form.allDay ? '하루 종일' : `${form.startTime}–${form.endTime}`
  const title = form.title.trim() || '제목 없음'
  const views = {
    public: { block: 'full', note: '모든 팀이 제목과 시간을 그대로 봐요.' },
    team: { block: 'full', note: `${teamName ?? '선택한 팀'}에게만 이렇게 보이고, 다른 팀에는 바쁨으로 보여요.` },
    busy: { block: 'busy', note: '무슨 일정인지는 숨기고 시간만 막아 둬요.' },
    private: { block: 'hidden', note: '팀원에겐 빈 시간처럼 보이지만, 추천 시간을 계산할 땐 이 시간을 피해요.' },
  }
  const v = views[form.visibility]

  return (
    <div className="rounded-xl bg-stone-50 p-3">
      <div className="mb-2 flex items-center gap-1.5 text-xs text-stone-500">
        <Eye size={13} /> 팀원 화면에서는 이렇게 보여요
      </div>
      <div className="flex h-9 items-center rounded-lg border border-dashed border-stone-300 bg-white px-1">
        {v.block === 'full' && (
          <div className="w-full truncate rounded-md bg-emerald-50 px-2.5 py-1.5 text-xs text-emerald-900">
            {owner} · {title} <span className="text-emerald-700/70">{time}</span>
          </div>
        )}
        {v.block === 'busy' && (
          <div className="busy-stripe w-full rounded-md border border-stone-200 px-2.5 py-1.5 text-xs text-stone-500">
            {owner} · 바쁨 <span className="text-stone-400">{time}</span>
          </div>
        )}
        {v.block === 'hidden' && <div className="px-2 text-xs text-stone-400">(비어 있는 것처럼 보여요)</div>}
      </div>
      <p className="mt-2 flex items-start gap-1 text-xs text-stone-500">
        {form.visibility === 'private' && <Lock size={12} className="mt-0.5 shrink-0" />}
        {v.note}
      </p>
    </div>
  )
}
