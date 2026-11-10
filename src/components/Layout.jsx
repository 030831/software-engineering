import { useState } from 'react'
import { Navigate, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { CalendarDays, LogOut, Plus, Settings, Users } from 'lucide-react'
import { useStore } from '../store/AppStore'
import { Avatar, Button, inputClass, Modal } from './ui'

export default function Layout() {
  const { me } = useStore()
  if (!me) return <Navigate to="/login" replace />

  // 왼쪽 사이드바(바탕색 위) + 오른쪽 본문. 위쪽 머리줄 없이 로고와 내 계정을 사이드바에 둔다 (Notion Calendar 식)
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="min-w-0 flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}

export function Logo({ size = 'md' }) {
  const big = size === 'lg'
  return (
    <span className="flex items-center gap-2">
      <span className={`flex items-center justify-center rounded-[10px] bg-brand font-black text-white shadow-[inset_0_-2px_0_rgb(0_0_0/0.15)] ${big ? 'size-9 text-base' : 'size-7 text-[13px]'}`}>
        작
      </span>
      <span className={`font-bold tracking-tight ${big ? 'text-2xl' : 'text-[16px]'}`}>
        작심<span className="text-brand">365</span>
      </span>
    </span>
  )
}

const navClass = ({ isActive }) =>
  `flex h-9 items-center gap-2.5 rounded-xl px-3 text-sm transition ${
    isActive ? 'bg-white font-semibold text-ink shadow-card' : 'text-stone-600 hover:bg-stone-900/5 hover:text-ink'
  }`

function Sidebar() {
  const { me, myTeams, logout } = useStore()
  const [teamModal, setTeamModal] = useState(false)
  const [menu, setMenu] = useState(false)
  const navigate = useNavigate()

  return (
    <aside className="flex w-60 shrink-0 flex-col px-3 pb-3 pt-5">
      <div className="mb-6 px-2">
        <Logo />
      </div>

      <nav className="flex flex-col gap-1">
        <NavLink to="/" end className={navClass}>
          <CalendarDays size={17} /> 내 달력
        </NavLink>
        <NavLink to={myTeams[0] ? `/teams/${myTeams[0].id}` : '/settings'} className={() => navClass({ isActive: false })}>
          <Users size={17} /> 팀
        </NavLink>
        <NavLink to="/settings" className={navClass}>
          <Settings size={17} /> 설정
        </NavLink>
      </nav>

      <div className="label mb-1.5 mt-7 flex items-center px-3">
        내 팀
        <button onClick={() => setTeamModal(true)} className="ml-auto rounded-md p-0.5 text-stone-400 hover:bg-stone-900/5 hover:text-ink" aria-label="팀 만들기 또는 참여">
          <Plus size={14} />
        </button>
      </div>
      <div className="flex flex-col gap-1">
        {myTeams.map((t) => (
          <NavLink key={t.id} to={`/teams/${t.id}`} className={navClass}>
            <span className="size-2.5 rounded-[4px]" style={{ background: t.color }} />
            {t.name}
          </NavLink>
        ))}
        {myTeams.length === 0 && <p className="px-3 text-xs text-stone-400">아직 팀이 없어요.</p>}
      </div>

      <div className="relative mt-auto">
        {menu && (
          <div className="absolute inset-x-0 bottom-12 z-40 rounded-2xl bg-white p-1 shadow-pop">
            <div className="px-3 py-2 text-xs text-stone-500">{me.email}</div>
            <button
              onClick={() => {
                logout()
                navigate('/login')
              }}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-stone-100"
            >
              <LogOut size={15} /> 로그아웃
            </button>
          </div>
        )}
        <button onClick={() => setMenu((v) => !v)} className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left hover:bg-stone-900/5">
          <Avatar profile={me} size="sm" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{me.name}</span>
            <span className="block truncate text-[11px] text-stone-400">{me.email}</span>
          </span>
        </button>
      </div>

      <TeamModal open={teamModal} onClose={() => setTeamModal(false)} />
    </aside>
  )
}

function TeamModal({ open, onClose }) {
  const { state, createTeam, joinTeam } = useStore()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')

  const close = () => {
    setName('')
    setCode('')
    setError('')
    onClose()
  }

  const onCreate = (e) => {
    e.preventDefault()
    if (!name.trim()) return setError('팀 이름을 입력하세요.')
    const id = createTeam(name.trim())
    close()
    navigate(`/teams/${id}`)
  }

  const onJoin = (e) => {
    e.preventDefault()
    const team = state.teams.find((t) => t.invite_code.toUpperCase() === code.trim().toUpperCase())
    if (!team) return setError('초대 코드를 찾을 수 없어요.')
    joinTeam(team.id)
    close()
    navigate(`/teams/${team.id}`)
  }

  return (
    <Modal open={open} onClose={close} title="팀 만들기 · 참여" width="max-w-sm">
      <div className="space-y-5 px-6 pb-6 pt-3">
        <form onSubmit={onCreate} className="space-y-2">
          <label className="label">새 팀 만들기</label>
          <div className="flex gap-2">
            <input value={name} onChange={(e) => (setName(e.target.value), setError(''))} placeholder="소공 6조" className={inputClass} />
            <Button variant="primary" className="h-10 shrink-0">
              만들기
            </Button>
          </div>
        </form>
        <form onSubmit={onJoin} className="space-y-2">
          <label className="label">초대 코드로 참여</label>
          <div className="flex gap-2">
            <input value={code} onChange={(e) => (setCode(e.target.value), setError(''))} placeholder="SWE6-2026" className={inputClass} />
            <Button className="h-10 shrink-0">참여</Button>
          </div>
        </form>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </Modal>
  )
}
