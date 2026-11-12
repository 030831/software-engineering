import { useEffect, useMemo, useRef, useState } from 'react'
import { startOfWeek, format, parseISO } from 'date-fns'
import { makeDemoData, PROFILES, TEAMS } from '../data/demo'
import { teamsOf, TEAM_COLORS } from '../lib/events'
import { DEFAULT_PREFS } from '../lib/recommend'
import { supabase } from '../lib/supabase'
import { StoreContext, useStore } from './context'
import { ServerStoreProvider } from './ServerStore'

export { useStore }

// 저장소 고르기: Supabase 키가 있으면 서버 저장소(ServerStore), 없으면 브라우저(localStorage) 데모 저장소.
// 두 저장소는 같은 모양의 값(state, me, myTeams, actions)을 넣으므로 화면 코드는 그대로 쓴다.
export function AppStoreProvider({ children }) {
  return supabase ? <ServerStoreProvider>{children}</ServerStoreProvider> : <DemoStoreProvider>{children}</DemoStoreProvider>
}

// 데모 저장소: 브라우저(localStorage)에만 저장한다.
const KEY = 'jaksim365-demo-v4'
// 데모 데이터를 새로 추가하면 올린다. 저장된 데이터는 지우지 않고 빠진 것만 채운다.
//   2: 정해야 할 일정 예시, 3: 시간이 정해진 팀 일정 예시(id가 'te'로 시작), 4: 선호 시간대, 5: 하루 종일 일정 예시, 6: 투표 예시, 8: 투표를 사람마다 원하는 시간 하나로
//   9: 비공개·바쁨 통합, 팀장, 정할 일정을 날짜 대신 주 단위로
const SEED = 9

function load() {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved) return withNewDemoData(JSON.parse(saved))
  } catch {
    // 저장소를 못 쓰는 환경이면 데모 데이터로 시작
  }
  return null
}

function withNewDemoData(saved) {
  const seed = saved.seed ?? 1
  if (seed >= SEED) return saved
  const demo = makeDemoData(new Date())
  const addMissing = (list, items) => {
    const have = new Set(list.map((x) => x.id))
    return [...list, ...items.filter((x) => !have.has(x.id))]
  }
  const next = { ...saved, seed: SEED }
  if (seed < 2) next.requests = addMissing(saved.requests ?? [], demo.requests)
  if (seed < 3) next.events = addMissing(saved.events, demo.events.filter((e) => e.id.startsWith('te')))
  if (seed < 4) {
    next.profiles = saved.profiles.map((p) => (p.prefs ? p : { ...p, prefs: PROFILES.find((d) => d.id === p.id)?.prefs ?? DEFAULT_PREFS }))
  }
  if (seed < 5) {
    next.events = addMissing(next.events, demo.events.filter((e) => e.id === 'ad1'))
    next.requests = addMissing(next.requests ?? [], demo.requests.filter((r) => r.id === 'r6'))
  }
  if (seed < 6) {
    const r1 = demo.requests.find((r) => r.id === 'r1')
    next.requests = next.requests.map((r) => (r.id === 'r1' && !r.votes ? { ...r, votes: r1.votes } : r))
  }
  if (seed < 8) {
    // 예전 '후보마다 투표' 형식을 '사람마다 원하는 시간 하나'로 바꾼다 (가장 높게 표시한 후보, 같으면 이른 시간)
    const toPerPerson = (r) => {
      const votes = {}
      const best = {}
      for (const c of [...r.candidates].sort((a, b) => a.start.localeCompare(b.start))) {
        for (const [uid, v] of Object.entries(r.votes?.[c.id] ?? {})) {
          if (v > 0 && v > (best[uid] ?? 0)) {
            best[uid] = v
            votes[uid] = { start: c.start, end: c.end }
          }
        }
      }
      const { candidates: _, ...rest } = r
      return { ...rest, votes }
    }
    next.requests = next.requests.map((r) => (r.candidates ? toPerPerson(r) : r))
  }
  if (seed < 9) {
    next.events = (next.events ?? saved.events).map((e) => (e.visibility === 'private' ? { ...e, visibility: 'busy' } : e))
    next.events = addMissing(next.events, demo.events.filter((e) => e.id === 'ad2'))
    next.teams = saved.teams.map((t) => (t.leader_id ? t : { ...t, leader_id: TEAMS.find((d) => d.id === t.id)?.leader_id ?? t.members[0] }))
    const toWeek = (date) => format(startOfWeek(parseISO(date), { weekStartsOn: 1 }), 'yyyy-MM-dd')
    next.requests = next.requests.map((r) => {
      if (r.week) return r
      const { date, ...rest } = r
      // 데모 '자료 조사 회의'는 차선책 예시가 되도록 새 데모와 같은 주로 옮긴다
      const demoWeek = r.id === 'r6' && demo.requests.find((d) => d.id === 'r6')?.week
      return { ...rest, week: demoWeek || toWeek(date) }
    })
  }
  return next
}

const newId = () => crypto.randomUUID()
const inviteCode = () => Math.random().toString(36).slice(2, 6).toUpperCase() + '-' + Math.floor(1000 + Math.random() * 9000)

function DemoStoreProvider({ children }) {
  const [state, setState] = useState(() => load() ?? { ...makeDemoData(new Date()), seed: SEED, currentUserId: null })

  // 바로 결과를 돌려줘야 하는 동작(로그인, 초대 코드)은 최신 state를 여기서 읽는다
  const stateRef = useRef(state)
  stateRef.current = state

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state))
    } catch {
      // 저장 실패는 무시 (새로고침하면 초기화될 뿐)
    }
  }, [state])

  const actions = useMemo(
    () => ({
      // 데모 계정 버튼: 비밀번호 없이 바로 로그인
      login: (userId) => setState((s) => ({ ...s, currentUserId: userId })),
      // 이메일 로그인 (데모라 비밀번호는 검사하지 않는다). 실패하면 오류 문구를 돌려준다
      signIn: async (email) => {
        const user = stateRef.current.profiles.find((p) => p.email === email.trim())
        if (!user) return '가입된 이메일이 아니에요. 아래 데모 계정을 써 보세요.'
        setState((s) => ({ ...s, currentUserId: user.id }))
        return null
      },
      logout: () => setState((s) => ({ ...s, currentUserId: null })),
      signUp: async (name, email) => {
        const id = newId()
        setState((s) => ({
          ...s,
          currentUserId: id,
          profiles: [...s.profiles, { id, name, email, color: 'teal', prefs: DEFAULT_PREFS }],
        }))
        return {}
      },

      // 내 선호 시간대 저장: { morning, afternoon, evening }
      setPrefs: (prefs) =>
        setState((s) => ({ ...s, profiles: s.profiles.map((p) => (p.id === s.currentUserId ? { ...p, prefs } : p)) })),

      saveEvent: (ev) =>
        setState((s) => {
          if (ev.id && s.events.some((e) => e.id === ev.id)) {
            return { ...s, events: s.events.map((e) => (e.id === ev.id ? { ...e, ...ev } : e)) }
          }
          return { ...s, events: [...s.events, { done: false, kind: 'personal', ...ev, id: newId(), owner_id: s.currentUserId }] }
        }),
      deleteEvent: (id) => setState((s) => ({ ...s, events: s.events.filter((e) => e.id !== id) })),
      toggleDone: (id) =>
        setState((s) => ({ ...s, events: s.events.map((e) => (e.id === id ? { ...e, done: !e.done } : e)) })),

      createTeam: (name) => {
        const id = newId()
        setState((s) => ({
          ...s,
          teams: [
            ...s.teams,
            {
              id,
              name,
              color: TEAM_COLORS[s.teams.length % TEAM_COLORS.length],
              invite_code: inviteCode(),
              leader_id: s.currentUserId,
              members: [s.currentUserId],
            },
          ],
        }))
        return id
      },
      // 초대 코드로 참여: 팀 id를 돌려준다. 코드가 없으면 null
      joinTeamByCode: async (code) => {
        const team = stateRef.current.teams.find((t) => t.invite_code.toUpperCase() === code.trim().toUpperCase())
        if (!team) return null
        setState((s) => ({
          ...s,
          teams: s.teams.map((t) => (t.id === team.id && !t.members.includes(s.currentUserId) ? { ...t, members: [...t.members, s.currentUserId] } : t)),
        }))
        return team.id
      },

      // 팀장이 넣는 '이 주 안에 해야 할 일': { title, week: 그 주 월요일 'yyyy-MM-dd', duration: 분 }
      addRequest: (teamId, request) =>
        setState((s) => ({
          ...s,
          requests: [...s.requests, { id: newId(), team_id: teamId, ...request, created_by: s.currentUserId, status: 'open' }],
        })),
      // 원하는 시간 투표 (임시). 사람마다 원하는 시간 하나: votes: { [사람 id]: { start, end } }
      setVote: (requestId, slot) =>
        setState((s) => ({
          ...s,
          requests: s.requests.map((r) => (r.id === requestId ? { ...r, votes: { ...(r.votes ?? {}), [s.currentUserId]: slot } } : r)),
        })),
      clearVote: (requestId) =>
        setState((s) => ({
          ...s,
          requests: s.requests.map((r) => {
            if (r.id !== requestId) return r
            const { [s.currentUserId]: _, ...rest } = r.votes ?? {}
            return { ...r, votes: rest }
          }),
        })),

      // 시간을 확정하면 팀 일정을 만들고, 정해야 할 일정 목록에서 뺀다
      scheduleRequest: (requestId, ev) =>
        setState((s) => ({
          ...s,
          events: [...s.events, { done: false, ...ev, id: newId(), owner_id: s.currentUserId }],
          requests: s.requests.map((r) => (r.id === requestId ? { ...r, status: 'scheduled' } : r)),
        })),

      resetDemo: () => setState((s) => ({ ...makeDemoData(new Date()), seed: SEED, currentUserId: s.currentUserId })),
    }),
    [],
  )

  const value = useMemo(() => {
    const me = state.profiles.find((p) => p.id === state.currentUserId) ?? null
    return { mode: 'demo', ready: true, error: '', clearError: () => {}, state, me, myTeams: me ? teamsOf(state.teams, me.id) : [], ...actions }
  }, [state, actions])

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}
