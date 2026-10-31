import { useState } from 'react'
import { Navigate, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { CalendarDays, LogOut, Plus, Settings, Users } from 'lucide-react'
import { useStore } from '../store/AppStore'
import { Avatar, Button, inputClass, Modal } from './ui'

export default function Layout() {
  const { me } = useStore()
  if (!me) return <Navigate to="/login" replace />

  return (
    <div className="flex h-screen flex-col">
      <Header />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className="min-w-0 flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function Header() {
  const { me, logout } = useStore()
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  return (
    <header className="flex h-14 shrink-0 items-center border-b border-stone-200 bg-white px-5">
      <span className="text-[17px] font-bold tracking-tight">작심365</span>
      <div className="relative ml-auto">
        <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-stone-100">
          <Avatar profile={me} size="sm" />
          <span className="text-sm">{me.name}</span>
        </button>
        {open && (
          <div className="absolute right-0 top-11 z-40 w-48 rounded-xl border border-stone-200 bg-white p-1 shadow-lg">
            <div className="px-3 py-2 text-xs text-stone-500">{me.email}</div>
            <button
              onClick={() => {
                logout()
                navigate('/login')
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-stone-100"
            >
              <LogOut size={15} /> 로그아웃
            </button>
          </div>
        )}
      </div>
    </header>
  )
}

const navClass = ({ isActive }) =>
  `flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${isActive ? 'bg-stone-100 font-semibold text-stone-900' : 'text-stone-600 hover:bg-stone-50'}`

function Sidebar() {
  const { myTeams } = useStore()
  const [teamModal, setTeamModal] = useState(false)

  return (
    <aside className="flex w-56 shrink-0 flex-col gap-0.5 border-r border-stone-200 bg-white p-3">
      <NavLink to="/" end className={navClass}>
        <CalendarDays size={17} /> 내 달력
      </NavLink>
      <NavLink to={myTeams[0] ? `/teams/${myTeams[0].id}` : '/settings'} className={() => navClass({ isActive: false })}>
        <Users size={17} /> 팀
      </NavLink>
      <NavLink to="/settings" className={navClass}>
        <Settings size={17} /> 설정
      </NavLink>

      <div className="mb-1 mt-5 flex items-center px-3 text-xs text-stone-400">
        내 팀
        <button onClick={() => setTeamModal(true)} className="ml-auto rounded p-0.5 hover:bg-stone-100" aria-label="팀 만들기 또는 참여">
          <Plus size={14} />
        </button>
      </div>
      {myTeams.map((t) => (
        <NavLink key={t.id} to={`/teams/${t.id}`} className={navClass}>
          <span className="size-2 rounded-full" style={{ background: t.color }} />
          {t.name}
        </NavLink>
      ))}
      {myTeams.length === 0 && <p className="px-3 text-xs text-stone-400">아직 팀이 없어요.</p>}

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
      <div className="space-y-5 p-5">
        <form onSubmit={onCreate} className="space-y-2">
          <label className="text-xs text-stone-500">새 팀 만들기</label>
          <div className="flex gap-2">
            <input value={name} onChange={(e) => (setName(e.target.value), setError(''))} placeholder="소공 6조" className={inputClass} />
            <Button variant="primary">만들기</Button>
          </div>
        </form>
        <form onSubmit={onJoin} className="space-y-2">
          <label className="text-xs text-stone-500">초대 코드로 참여</label>
          <div className="flex gap-2">
            <input value={code} onChange={(e) => (setCode(e.target.value), setError(''))} placeholder="SWE6-2026" className={inputClass} />
            <Button>참여</Button>
          </div>
        </form>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </Modal>
  )
}
