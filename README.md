# 작심365일

소프트웨어공학 Term Project 6조 (김현준 · 양정훈 · 성영준 · 김명진)

달력 + 시계형 시간표 + 팀 약속 시간 추천 웹 서비스입니다.

- 월간 달력과 날짜별 24시간 시계형 시간표
- 일정별 공개 범위 4단계 (전체 공개 · 팀 공개 · 부분 공개 · 완전 비공개)
- 팀원 일정과 선호 시간대를 반영한 약속 시간 추천: Score = 80A − 10L − 10C + 20P

지금은 Supabase 연결 전이라 데이터가 브라우저(localStorage)에만 저장되는 데모 버전입니다.

## 실행

```bash
npm install
npm run dev
```

`main`에 push하면 GitHub Actions가 빌드해서 GitHub Pages에 배포합니다.
