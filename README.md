# 작심365일

소프트웨어공학 Term Project 6조 (김현준 · 양정훈 · 성영준 · 김명진)

달력 + 시계형 시간표 + 팀 약속 시간 추천 웹 서비스입니다.

- 월간 달력과 날짜별 24시간 시계형 시간표
- 일정별 공개 범위 3단계 (전체 공개 · 팀 공개 · 바쁨). 팀원에겐 가능한 시간과 공개 일정만 보이고, 바쁨 일정은 보이지 않지만 추천에는 반영
- 팀장이 '이 주에 해야 할 일'을 넣으면, 팀원 일정과 선호 시간대를 반영해 그 주의 좋은 시간을 순서대로 추천: Score = 80A − 10L − 10C + 20P
- 모두 되는 시간이 없으면 가장 많이 참석할 수 있는 차선책 추천

배포 주소: https://software-engineering-iota.vercel.app

## 구조

- 화면: React + Vite + Tailwind CSS
- 서버: [Supabase](https://supabase.com) (로그인, PostgreSQL DB, 실시간 반영)
  - `supabase/schema.sql`: 테이블과 보안 규칙(RLS). 팀원의 바쁨 일정은 DB에서부터 제목이 내려가지 않고, 가능한 시간 계산용 시간만 `teammate_busy()`로 제공
- 배포: [Vercel](https://vercel.com). `main`에 push하면 자동으로 다시 배포

## 로컬에서 실행

```bash
npm install
cp env.example .env.local   # 값을 채우면 Supabase 서버 모드, 비워 두면 브라우저 저장 데모 모드
npm run dev
```

`.env.local`에는 브라우저에 들어가도 되는 공개 키(publishable/anon)만 넣습니다. secret/service_role 키는 넣지 않습니다.
