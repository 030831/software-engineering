import { Clock, Globe, Lock, Users } from 'lucide-react'

export const VISIBILITY = [
  { key: 'public', label: '전체 공개', desc: '모든 팀원이 제목까지 봐요', icon: Globe },
  { key: 'team', label: '팀 공개', desc: '선택한 팀만 제목을 봐요', icon: Users },
  { key: 'busy', label: '바쁨만 표시', desc: '시간만 바쁨으로 보여요', icon: Clock },
  { key: 'private', label: '완전 비공개', desc: '아무도 못 봐요. 추천엔 반영', icon: Lock },
]

// 팀원 화면에서 이 일정이 어떻게 보이는지: 'full'(제목·시간) / 'busy'(바쁨) / 'hidden'(안 보임)
export function viewOf(ev, teamId) {
  if (ev.visibility === 'public') return 'full'
  if (ev.visibility === 'team') return ev.team_id === teamId ? 'full' : 'busy'
  if (ev.visibility === 'busy') return 'busy'
  return 'hidden'
}
