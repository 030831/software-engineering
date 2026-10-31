import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { makeDemoData, PROFILES } from '../data/demo'
import { teamsOf, TEAM_COLORS } from '../lib/events'
import { DEFAULT_PREFS } from '../lib/recommend'

// 지금은 브라우저(localStorage)에 저장하는 데모 저장소.
// Supabase를 붙일 때 아래 actions 안쪽만 API 호출로 바꾸면 화면 코드는 그대로 쓸 수 있다.
const KEY = 'jaksim365-demo-v4'
// 데모 데이터를 새로 추가하면 올린다. 저장된 데이터는 지우지 않고 빠진 것만 채운다.
//   2: 정해야 할 일정 예시, 3: 시간이 정해진 팀 일정 예시(id가 'te'로 시작), 4: 선호 시간대
const SEED = 4

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
  return next
}

const newId = () => crypto.randomUUID()
const inviteCode = () => Math.random().toString(36).slice(2, 6).toUpperCase() + '-' + Math.floor(1000 + Math.random() * 9000)

const StoreContext = createContext(null)

export function AppStoreProvider({ children }) {
  const [state, setState] = useState(() => load() ?? { ...makeDemoData(new Date()), seed: SEED, currentUserId: null })

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state))
    } catch {
      // 저장 실패는 무시 (새로고침하면 초기화될 뿐)
    }
  }, [state])

  const actions = useMemo(
    () => ({
      login: (userId) => setState((s) => ({ ...s, currentUserId: userId })),
      logout: () => setState((s) => ({ ...s, currentUserId: null })),
      signup: (name, email) => {
        const id = newId()
        setState((s) => ({
          ...s,
          currentUserId: id,
          profiles: [...s.profiles, { id, name, email, color: 'teal', prefs: DEFAULT_PREFS }],
        }))
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
            { id, name, color: TEAM_COLORS[s.teams.length % TEAM_COLORS.length], invite_code: inviteCode(), members: [s.currentUserId] },
          ],
        }))
        return id
      },
      joinTeam: (teamId) =>
        setState((s) => ({
          ...s,
          teams: s.teams.map((t) =>
            t.id === teamId && !t.members.includes(s.currentUserId) ? { ...t, members: [...t.members, s.currentUserId] } : t,
          ),
        })),

      // { title, date: 'yyyy-MM-dd', duration: 분 }
      addRequest: (teamId, request) =>
        setState((s) => ({
          ...s,
          requests: [...s.requests, { id: newId(), team_id: teamId, ...request, created_by: s.currentUserId, status: 'open' }],
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
    return { state, me, myTeams: me ? teamsOf(state.teams, me.id) : [], ...actions }
  }, [state, actions])

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  return useContext(StoreContext)
}
