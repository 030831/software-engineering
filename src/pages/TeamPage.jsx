import { useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { Check, Link2 } from 'lucide-react'
import { useStore } from '../store/AppStore'
import { Avatar, Button } from '../components/ui'
import RecommendPanel from '../components/RecommendPanel'

export default function TeamPage() {
  const { teamId } = useParams()
  const { state, me } = useStore()
  const [copied, setCopied] = useState(false)
  const team = state.teams.find((t) => t.id === teamId)

  if (!team || !team.members.includes(me.id)) return <Navigate to="/" replace />
  const members = team.members.map((id) => state.profiles.find((p) => p.id === id)).filter(Boolean)
  const leader = members.find((m) => m.id === team.leader_id)

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(team.invite_code)
    } catch {
      // 클립보드 권한이 없어도 코드는 버튼에 보인다
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-6 pl-2">
      <div className="flex items-center gap-3 px-1">
        <span className="size-3.5 rounded-[5px]" style={{ background: team.color }} />
        <h1 className="text-[22px] font-bold tracking-tight">{team.name}</h1>
        <span className="rounded-full bg-white px-2.5 py-0.5 text-xs text-stone-500 shadow-card">
          {members.length}명{leader && ` · 팀장 ${leader.name}`}
        </span>
        <div className="ml-auto flex -space-x-1.5">
          {members.map((m) => (
            <Avatar key={m.id} profile={m} size="sm" ring />
          ))}
        </div>
        <Button onClick={copyCode}>
          {copied ? <Check size={15} /> : <Link2 size={15} />}
          {copied ? '복사됨' : `초대 코드 ${team.invite_code}`}
        </Button>
      </div>

      <RecommendPanel key={team.id} team={team} members={members} leader={leader} />
    </div>
  )
}
