import { addDays, format, parseISO, startOfWeek } from 'date-fns'

// Supabase 연결 전까지 쓰는 데모 데이터. 테이블 구조(profiles / teams / events)를 그대로 따른다.
// prefs: 선호 시간대 (1 선호 / 0.5 보통 / 0 비선호)
export const PROFILES = [
  { id: 'u1', name: '김현준', email: 'hyunjun@demo.dev', color: 'blue', prefs: { morning: 0.5, afternoon: 1, evening: 0.5 } },
  { id: 'u2', name: '양정훈', email: 'jeonghoon@demo.dev', color: 'green', prefs: { morning: 0, afternoon: 1, evening: 0.5 } },
  { id: 'u3', name: '성영준', email: 'youngjun@demo.dev', color: 'amber', prefs: { morning: 0, afternoon: 0.5, evening: 1 } },
  { id: 'u4', name: '김명진', email: 'myeongjin@demo.dev', color: 'rose', prefs: { morning: 1, afternoon: 0.5, evening: 0 } },
]

const TEAMS = [
  { id: 't1', name: '소공 6조', color: '#7F77DD', invite_code: 'SWE6-2026', members: ['u1', 'u2', 'u3', 'u4'] },
  { id: 't2', name: '밴드 동아리', color: '#D4537E', invite_code: 'BAND-0777', members: ['u1', 'u3'] },
]

export function makeDemoData(today = new Date()) {
  const mon = startOfWeek(today, { weekStartsOn: 1 })
  const at = (offset, hm) => `${format(addDays(mon, offset), 'yyyy-MM-dd')}T${hm}`
  let n = 0
  const ev = (owner_id, offset, start, end, title, visibility = 'public', extra = {}) => ({
    id: `e${++n}`,
    owner_id,
    title,
    start: at(offset, start),
    end: at(offset, end),
    visibility,
    team_id: null,
    kind: 'personal',
    all_day: false,
    done: false,
    ...extra,
  })

  const events = []
  // 이번 주와 다음 주에 반복되는 수업·알바
  for (const w of [0, 7]) {
    events.push(
      ev('u1', w + 0, '09:00', '12:00', '전공 수업'),
      ev('u1', w + 2, '09:00', '12:00', '전공 수업'),
      ev('u1', w + 1, '10:00', '11:30', '자료구조'),
      ev('u1', w + 3, '16:00', '20:00', '알바', 'busy'),
      ev('u1', w + 4, '19:00', '20:30', '헬스', 'team', { team_id: 't2' }),
      ev('u2', w + 0, '13:00', '15:00', 'UI 디자인 수업'),
      ev('u2', w + 1, '13:00', '16:00', '스튜디오 실습'),
      ev('u2', w + 3, '10:00', '12:00', '영어 회화', 'busy'),
      ev('u2', w + 2, '18:30', '21:00', '상담', 'private'),
      ev('u3', w + 0, '09:00', '11:00', '운영체제'),
      ev('u3', w + 1, '18:00', '22:00', '알바', 'busy'),
      ev('u3', w + 2, '14:00', '16:00', '네트워크'),
      ev('u3', w + 3, '18:00', '22:00', '알바', 'busy'),
      ev('u4', w + 0, '15:00', '18:00', '과외', 'private'),
      ev('u4', w + 2, '10:00', '12:00', '알고리즘'),
      ev('u4', w + 4, '13:00', '15:00', '캡스톤 회의', 'team', { team_id: 't1' }),
    )
  }
  events.push(
    ev('u1', 2, '14:00', '15:00', '병원 진료', 'private'),
    ev('u1', 4, '22:00', '23:00', '과제 마감'),
    ev('u1', 5, '15:00', '17:00', '동아리 합주', 'team', { team_id: 't2' }),
    ev('u1', 1, '13:00', '14:00', '소공 6조 회의', 'team', { team_id: 't1', kind: 'team' }),
    { ...ev('u1', 7, '00:00', '00:00', '스프린트 2', 'team', { team_id: 't1', kind: 'team', all_day: true }), end: at(12, '00:00') },
  )

  // 이미 시간이 정해진 팀 일정. id를 고정해 두어 저장된 데이터에도 나중에 채워 넣을 수 있다.
  const teamEv = (id, team_id, offset, start, end, title) => ({ ...ev('u1', offset, start, end, title, 'team', { team_id, kind: 'team' }), id })
  events.push(
    teamEv('te1', 't1', 0, '21:00', '21:30', '데일리 스크럼'),
    teamEv('te2', 't1', 3, '21:00', '21:30', '데일리 스크럼'),
    teamEv('te3', 't1', 5, '10:00', '12:00', 'WBS 다시 짜기'),
    teamEv('te4', 't1', 7, '18:00', '19:00', '스프린트 2 계획 회의'),
    teamEv('te5', 't1', 9, '21:00', '21:30', '데일리 스크럼'),
    teamEv('te6', 't1', 11, '16:00', '17:00', '스프린트 2 리뷰'),
    teamEv('te7', 't1', 11, '17:00', '17:30', '회고'),
    teamEv('te8', 't2', 6, '14:00', '16:00', '정기 합주'),
  )

  // 개인 하루 종일 일정 예시: 추천 계산에서 그날 전체를 막는다
  events.push({ ...ev('u4', 11, '00:00', '00:00', '가족 여행', 'public', { all_day: true }), id: 'ad1', end: at(12, '00:00') })

  // 이미 지난 개인 일정은 일부를 완료 처리해 달성률이 보이게 한다
  events.forEach((e, i) => {
    if (e.kind === 'personal' && parseISO(e.end) < today && i % 3 !== 0) e.done = true
  })

  // 날짜와 길이는 정했지만 몇 시에 할지 아직 못 정한 팀 일정
  const req = (id, team_id, title, offset, duration) => ({
    id,
    team_id,
    title,
    date: format(addDays(mon, offset), 'yyyy-MM-dd'),
    duration,
    created_by: 'u1',
    status: 'open',
  })
  const requests = [
    req('r1', 't1', '중간 피드백 2 준비 회의', 10, 120), // 다음 주 목: 일정이 섞인 날
    req('r2', 't1', '기말 발표 리허설', 13, 120), // 다음 주 일: 모두 비어 있는 날
    req('r3', 't1', 'UI 시안 리뷰', 8, 60), // 다음 주 화: 바쁜 날이라 일부만 되는 시간이 많음
    req('r4', 't1', '코드 리뷰', 9, 90), // 다음 주 수: 팀원의 완전 비공개 일정이 있는 날
    req('r5', 't2', '합주 연습', 12, 120), // 밴드 동아리 (다른 팀)
    req('r6', 't1', '자료 조사 회의', 11, 60), // 다음 주 금: 김명진이 하루 종일 여행이라 모두 되는 시간이 없음
  ]

  // 후보 시간 투표 예시: 중간 피드백 2 준비 회의에 후보 3개와 팀원 3명의 투표 (나는 아직 안 함)
  const r1 = requests[0]
  r1.candidates = [
    { id: 'c1', start: `${r1.date}T13:00`, end: `${r1.date}T15:00`, created_by: 'u2' },
    { id: 'c2', start: `${r1.date}T14:00`, end: `${r1.date}T16:00`, created_by: 'u2' },
    { id: 'c3', start: `${r1.date}T20:00`, end: `${r1.date}T22:00`, created_by: 'u4' },
  ]
  r1.votes = {
    c1: { u2: 2, u3: 1, u4: 2 },
    c2: { u2: 1, u3: 2, u4: 0 },
    c3: { u2: 0, u4: 2 },
  }

  return { profiles: PROFILES, teams: TEAMS, events, requests }
}
