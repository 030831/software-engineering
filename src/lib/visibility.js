import { Globe, Lock, Users } from 'lucide-react'

// 예전의 '바쁨만 표시'와 '완전 비공개'는 '바쁨' 하나로 합쳤다.
export const VISIBILITY = [
  { key: 'public', label: '전체 공개', desc: '모든 팀원이 제목까지 봐요', icon: Globe },
  { key: 'team', label: '팀 공개', desc: '선택한 팀만 제목을 봐요', icon: Users },
  { key: 'busy', label: '바쁨', desc: '일정은 안 보이고, 시간만 반영돼요', icon: Lock },
]

// 팀원 화면에서 이 일정이 어떻게 보이는지: 'full'(제목·시간) / 'hidden'(안 보임)
// 안 보이는 일정도 그 시간은 팀원의 '가능한 시간'에서 빠지고, 추천 계산에도 반영된다.
export function viewOf(ev, teamId) {
  if (ev.visibility === 'public') return 'full'
  if (ev.visibility === 'team' && ev.team_id === teamId) return 'full'
  return 'hidden'
}
