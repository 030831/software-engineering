import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { addDays, format } from 'date-fns'
import { supabase } from '../lib/supabase'
import { teamsOf, TEAM_COLORS } from '../lib/events'
import { StoreContext } from './context'

// Supabase 서버 저장소. 데모 저장소(AppStore)와 같은 모양의 값을 넣는다.
// - 로그인: Supabase Auth (이메일 + 비밀번호)
// - 데이터: 내가 볼 수 있는 행만 온다 (DB의 RLS가 공개 범위를 강제한다)
// - 팀원의 바쁨 일정은 제목 없이 시간만 teammate_busy()로 받아 state.busyRows에 둔다 → 가능한 시간·추천 계산에 쓴다
// - 실시간: 테이블이 바뀌면 다시 불러온다. 바쁨 일정은 RLS 때문에 변경 알림이 안 오므로 창에 돌아올 때와 1분마다도 불러온다

const EMPTY = { profiles: [], teams: [], events: [], requests: [], busyRows: [], currentUserId: null }

// DB는 'yyyy-MM-ddTHH:mm:ss'로 돌려준다 → 앱 형식 'yyyy-MM-ddTHH:mm'
const toLocal = (ts) => ts.slice(0, 16)

function toState(uid, { profiles, teams, members, events, requests, votes, busy }) {
  const membersOf = (teamId) => members.filter((m) => m.team_id === teamId).map((m) => m.user_id)
  const votesOf = (requestId) =>
    Object.fromEntries(votes.filter((v) => v.request_id === requestId).map((v) => [v.user_id, { start: toLocal(v.start_at), end: toLocal(v.end_at) }]))
  return {
    currentUserId: uid,
    profiles: profiles.map((p) => ({ id: p.id, name: p.name, email: p.email, color: p.color, prefs: p.prefs })),
    teams: teams.map((t) => ({ id: t.id, name: t.name, color: t.color, invite_code: t.invite_code, leader_id: t.leader_id, members: membersOf(t.id) })),
    events: events.map((e) => ({
      id: e.id,
      owner_id: e.owner_id,
      title: e.title,
      start: toLocal(e.start_at),
      end: toLocal(e.end_at),
      all_day: e.all_day,
      visibility: e.visibility,
      team_id: e.team_id,
      kind: e.kind,
      done: e.done,
    })),
    requests: requests.map((r) => ({
      id: r.id,
      team_id: r.team_id,
      title: r.title,
      week: r.week,
      duration: r.duration,
      created_by: r.created_by,
      status: r.status,
      votes: votesOf(r.id),
    })),
    busyRows: busy.map((b) => ({ user_id: b.user_id, start: new Date(b.start_at).getTime(), end: new Date(b.end_at).getTime() })),
  }
}

// Supabase 오류를 사람이 읽을 문구로
function messageOf(error) {
  const m = error?.message ?? ''
  if (/Invalid login credentials/i.test(m)) return '이메일 또는 비밀번호가 맞지 않아요.'
  if (/Email not confirmed/i.test(m)) return '이메일 인증을 아직 안 했어요. 메일함의 인증 링크를 눌러 주세요.'
  if (/already registered/i.test(m)) return '이미 가입된 이메일이에요. 로그인해 주세요.'
  if (/Password should be at least/i.test(m)) return '비밀번호는 6자 이상이어야 해요.'
  if (/row-level security/i.test(m)) return '권한이 없어요.'
  return m || '서버와 통신하지 못했어요.'
}

export function ServerStoreProvider({ children }) {
  const [session, setSession] = useState(undefined) // undefined: 확인 중
  const [data, setData] = useState(EMPTY)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')
  const uid = session?.user?.id ?? null
  const dataRef = useRef(data)
  dataRef.current = data

  useEffect(() => {
    supabase.auth.getSession().then(({ data: d }) => setSession(d.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  const refresh = useCallback(async () => {
    if (!uid) return
    // 가능한 시간 계산에 쓰는 바쁜 시간은 앞뒤로 넉넉히 (지난 8주 ~ 앞으로 16주)
    const from_ts = format(addDays(new Date(), -56), "yyyy-MM-dd'T'00:00")
    const to_ts = format(addDays(new Date(), 112), "yyyy-MM-dd'T'00:00")
    const results = await Promise.all([
      supabase.from('profiles').select('*'),
      supabase.from('teams').select('*').order('created_at'),
      supabase.from('team_members').select('team_id, user_id').order('joined_at'),
      supabase.from('events').select('*'),
      supabase.from('requests').select('*').order('created_at'),
      supabase.from('votes').select('*'),
      supabase.rpc('teammate_busy', { from_ts, to_ts }),
    ])
    const failed = results.find((r) => r.error)
    if (failed) {
      setError(messageOf(failed.error))
      return
    }
    const [profiles, teams, members, events, requests, votes, busy] = results.map((r) => r.data ?? [])
    setData(toState(uid, { profiles, teams, members, events, requests, votes, busy }))
    setLoaded(true)
  }, [uid])

  // 로그인 상태가 바뀌면 처음부터 다시 불러온다
  useEffect(() => {
    setData(EMPTY)
    setLoaded(false)
    if (uid) refresh()
  }, [uid, refresh])

  // 실시간 반영 + 창에 돌아올 때 + 1분마다
  useEffect(() => {
    if (!uid) return
    let timer = null
    const soon = () => {
      clearTimeout(timer)
      timer = setTimeout(refresh, 250)
    }
    const channel = supabase.channel('jaksim365-sync')
    for (const table of ['profiles', 'teams', 'team_members', 'events', 'requests', 'votes']) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, soon)
    }
    channel.subscribe()
    const onFocus = () => soon()
    window.addEventListener('focus', onFocus)
    const interval = setInterval(refresh, 60000)
    return () => {
      clearTimeout(timer)
      clearInterval(interval)
      window.removeEventListener('focus', onFocus)
      supabase.removeChannel(channel)
    }
  }, [uid, refresh])

  const actions = useMemo(() => {
    // 서버에 쓰고, 성공하면 다시 불러온다. 실패하면 화면 위에 오류를 보여주고 null을 돌려준다
    const run = async (request) => {
      const { data: result, error: err } = await request
      if (err) {
        setError(messageOf(err))
        return null
      }
      await refresh()
      return result ?? true
    }

    return {
      signIn: async (email, password) => {
        const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        return err ? messageOf(err) : null
      },
      // 가입: 이메일 인증을 켜 두었으면 needsConfirm으로 알려준다
      signUp: async (name, email, password) => {
        const { data: d, error: err } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { name } } })
        if (err) return { error: messageOf(err) }
        return { needsConfirm: !d.session }
      },
      logout: () => supabase.auth.signOut(),

      setPrefs: (prefs) => run(supabase.from('profiles').update({ prefs }).eq('id', dataRef.current.currentUserId)),

      saveEvent: (ev) => {
        const row = {
          title: ev.title,
          start_at: ev.start,
          end_at: ev.end,
          all_day: ev.all_day,
          visibility: ev.visibility,
          team_id: ev.team_id ?? null,
        }
        if (ev.id && dataRef.current.events.some((e) => e.id === ev.id)) return run(supabase.from('events').update(row).eq('id', ev.id))
        return run(supabase.from('events').insert({ ...row, kind: ev.kind ?? 'personal' }))
      },
      deleteEvent: (id) => run(supabase.from('events').delete().eq('id', id)),
      toggleDone: (id) => {
        const ev = dataRef.current.events.find((e) => e.id === id)
        return ev && run(supabase.from('events').update({ done: !ev.done }).eq('id', id))
      },

      createTeam: async (name) => {
        const color = TEAM_COLORS[dataRef.current.teams.length % TEAM_COLORS.length]
        const id = await run(supabase.rpc('create_team', { team_name: name, team_color: color }))
        return typeof id === 'string' ? id : null
      },
      joinTeamByCode: async (code) => {
        const { data: id, error: err } = await supabase.rpc('join_team', { code })
        if (err) {
          setError(messageOf(err))
          return null
        }
        if (id) await refresh()
        return id ?? null
      },

      addRequest: (teamId, request) =>
        run(supabase.from('requests').insert({ team_id: teamId, title: request.title, week: request.week, duration: request.duration })),
      setVote: (requestId, slot) =>
        run(
          supabase
            .from('votes')
            .upsert({ request_id: requestId, user_id: dataRef.current.currentUserId, start_at: slot.start, end_at: slot.end }, { onConflict: 'request_id,user_id' }),
        ),
      clearVote: (requestId) => run(supabase.from('votes').delete().eq('request_id', requestId).eq('user_id', dataRef.current.currentUserId)),

      // 시간을 확정하면 팀 일정을 만들고, 정할 일정을 확정 상태로 바꾼다
      scheduleRequest: async (requestId, ev) => {
        const ok = await run(
          supabase.from('events').insert({
            title: ev.title,
            start_at: ev.start,
            end_at: ev.end,
            all_day: false,
            visibility: 'team',
            team_id: ev.team_id,
            kind: 'team',
          }),
        )
        if (ok) await run(supabase.from('requests').update({ status: 'scheduled' }).eq('id', requestId))
      },
    }
  }, [refresh])

  const value = useMemo(() => {
    const me = data.profiles.find((p) => p.id === uid) ?? null
    return {
      mode: 'server',
      // 로그인 확인 중이거나, 로그인했는데 아직 데이터를 못 받았으면 준비 중
      ready: session !== undefined && (!uid || loaded),
      error,
      clearError: () => setError(''),
      state: data,
      me,
      myTeams: me ? teamsOf(data.teams, me.id) : [],
      ...actions,
    }
  }, [data, uid, session, loaded, error, actions])

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}
