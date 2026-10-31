import { useStore } from '../store/AppStore'
import { Button } from '../components/ui'
import { DEFAULT_PREFS, PERIODS, PREF_LEVELS } from '../lib/recommend'

export default function SettingsPage() {
  const { me, setPrefs, resetDemo } = useStore()
  const prefs = { ...DEFAULT_PREFS, ...me.prefs }

  return (
    <div className="mx-auto max-w-2xl space-y-5 p-6">
      <h1 className="text-xl font-semibold">설정</h1>

      <section className="rounded-2xl border border-stone-200 bg-white p-5">
        <h2 className="font-semibold">선호 시간대</h2>
        <p className="mb-4 mt-1 text-sm text-stone-500">팀 약속 시간을 추천할 때, 참석하는 팀원들의 선호를 평균 내서 점수에 더해요.</p>
        <div className="space-y-2">
          {PERIODS.map((period) => (
            <div key={period.key} className="flex items-center gap-3">
              <div className="w-24 shrink-0">
                <div className="text-sm font-semibold">{period.label}</div>
                <div className="text-xs text-stone-400">{period.range}</div>
              </div>
              <div className="grid flex-1 grid-cols-3 gap-2">
                {PREF_LEVELS.map((level) => {
                  const on = prefs[period.key] === level.value
                  return (
                    <button
                      key={level.label}
                      onClick={() => setPrefs({ ...prefs, [period.key]: level.value })}
                      className={`rounded-lg border py-2 text-sm transition ${
                        on ? 'border-stone-900 bg-stone-900 font-semibold text-white' : 'border-stone-200 text-stone-600 hover:bg-stone-50'
                      }`}
                    >
                      {level.label}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-5">
        <h2 className="font-semibold">데모 데이터</h2>
        <p className="mb-3 mt-1 text-sm text-stone-500">지금은 Supabase 연결 전이라 이 브라우저에만 저장돼요. 처음 상태로 되돌릴 수 있어요.</p>
        <Button onClick={resetDemo}>데모 데이터 초기화</Button>
      </section>
    </div>
  )
}
