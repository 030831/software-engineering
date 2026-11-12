import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useStore } from '../store/AppStore'
import { Avatar, Button, inputClass } from '../components/ui'
import { Logo } from '../components/Layout'

export default function LoginPage() {
  const { mode: storeMode, ready, state, me, login, signIn, signUp } = useStore()
  const navigate = useNavigate()
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const demo = storeMode === 'demo'

  if (ready && me) return <Navigate to="/" replace />

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }))
    setError('')
  }

  // 서버 모드: Supabase Auth로 실제 로그인·가입. 데모 모드: 비밀번호는 저장하거나 검사하지 않는다.
  const onSubmit = async (e) => {
    e.preventDefault()
    setNotice('')
    if (!form.email.trim() || !form.password) return setError('이메일과 비밀번호를 입력하세요.')
    if (mode === 'signup' && !form.name.trim()) return setError('이름을 입력하세요.')
    setBusy(true)
    if (mode === 'signup') {
      const res = await signUp(form.name.trim(), form.email.trim(), form.password)
      setBusy(false)
      if (res.error) return setError(res.error)
      if (res.needsConfirm) {
        setMode('login')
        return setNotice(`${form.email.trim()}로 인증 메일을 보냈어요. 메일의 링크를 누른 뒤 로그인해 주세요.`)
      }
    } else {
      const err = await signIn(form.email.trim(), form.password)
      setBusy(false)
      if (err) return setError(err)
    }
    navigate('/')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(60rem_30rem_at_50%_-10%,var(--color-brand-soft),transparent)] p-6">
      <div className="w-full max-w-sm">
        <Logo size="lg" />
        <h1 className="mb-7 mt-5 text-[26px] font-bold leading-snug tracking-tight">
          달력과 시간표를 한 화면에,
          <br />
          팀 약속은 <span className="text-brand">자동으로.</span>
        </h1>

        <div className="card p-5">
          <div className="mb-4 grid grid-cols-2 rounded-xl bg-stone-100 p-1 text-sm">
            {[
              ['login', '로그인'],
              ['signup', '회원가입'],
            ].map(([k, label]) => (
              <button
                key={k}
                onClick={() => (setMode(k), setError(''), setNotice(''))}
                className={`rounded-lg py-1.5 transition ${mode === k ? 'bg-white font-semibold shadow-card' : 'text-stone-500'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <form onSubmit={onSubmit} className="space-y-2.5">
            {mode === 'signup' && <input value={form.name} onChange={set('name')} placeholder="이름" className={inputClass} />}
            <input value={form.email} onChange={set('email')} placeholder="name@ulsan.ac.kr" type="email" autoComplete="email" className={inputClass} />
            <input
              value={form.password}
              onChange={set('password')}
              placeholder={mode === 'signup' && !demo ? '비밀번호 (6자 이상)' : '비밀번호'}
              type="password"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              className={inputClass}
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            {notice && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</p>}
            <Button variant="primary" className="h-10 w-full" disabled={busy}>
              {busy ? '잠시만요…' : mode === 'login' ? '로그인' : '가입하기'}
            </Button>
          </form>
        </div>

        {demo && (
          <div className="mt-6">
            <p className="label mb-2">데모 계정으로 바로 시작</p>
            <div className="grid grid-cols-2 gap-2">
              {state.profiles.slice(0, 4).map((p) => (
                <button
                  key={p.id}
                  onClick={() => (login(p.id), navigate('/'))}
                  className="flex items-center gap-2.5 rounded-2xl bg-white p-2.5 text-left text-sm font-medium shadow-card transition hover:-translate-y-px hover:shadow-pop"
                >
                  <Avatar profile={p} size="sm" />
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
