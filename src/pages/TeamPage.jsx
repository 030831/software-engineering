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
    <div className="mx-auto max-w-5xl space-y-5 p-6">
      <div className="flex items-center gap-3">
        <span className="size-3 rounded-full" style={{ background: team.color }} />
        <h1 className="text-xl font-semibold">{team.name}</h1>
        <span className="text-sm text-stone-400">{members.length}명</span>
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

      <RecommendPanel key={team.id} team={team} members={members} />
    </div>
  )
}
