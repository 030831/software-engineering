import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useStore } from '../store/AppStore'
import { Avatar, Button, inputClass } from '../components/ui'

export default function LoginPage() {
  const { state, me, login, signup } = useStore()
  const navigate = useNavigate()
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState('')

  if (me) return <Navigate to="/" replace />

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }))
    setError('')
  }

  // 데모 모드: 비밀번호는 저장하거나 검사하지 않는다. Supabase Auth를 붙이면 실제 인증으로 바뀐다.
  const onSubmit = (e) => {
    e.preventDefault()
    if (!form.email.trim() || !form.password) return setError('이메일과 비밀번호를 입력하세요.')
    if (mode === 'signup') {
      if (!form.name.trim()) return setError('이름을 입력하세요.')
      signup(form.name.trim(), form.email.trim())
    } else {
      const user = state.profiles.find((p) => p.email === form.email.trim())
      if (!user) return setError('가입된 이메일이 아니에요. 아래 데모 계정을 써 보세요.')
      login(user.id)
    }
    navigate('/')
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 text-2xl font-bold tracking-tight">작심365</h1>
        <p className="mb-6 text-sm text-stone-500">달력과 시간표를 한 화면에서, 팀 약속은 자동으로.</p>

        <div className="rounded-2xl border border-stone-200 bg-white p-5">
          <div className="mb-4 grid grid-cols-2 rounded-lg bg-stone-100 p-1 text-sm">
            {[
              ['login', '로그인'],
              ['signup', '회원가입'],
            ].map(([k, label]) => (
              <button
                key={k}
                onClick={() => (setMode(k), setError(''))}
                className={`rounded-md py-1.5 ${mode === k ? 'bg-white font-semibold shadow-sm' : 'text-stone-500'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <form onSubmit={onSubmit} className="space-y-2.5">
            {mode === 'signup' && <input value={form.name} onChange={set('name')} placeholder="이름" className={inputClass} />}
            <input value={form.email} onChange={set('email')} placeholder="name@ulsan.ac.kr" type="email" className={inputClass} />
            <input value={form.password} onChange={set('password')} placeholder="비밀번호" type="password" className={inputClass} />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button variant="primary" className="w-full py-2">
              {mode === 'login' ? '로그인' : '가입하기'}
            </Button>
          </form>
        </div>

        <div className="mt-6">
          <p className="mb-2 text-xs text-stone-400">데모 계정으로 바로 시작</p>
          <div className="grid grid-cols-2 gap-2">
            {state.profiles.slice(0, 4).map((p) => (
              <button
                key={p.id}
                onClick={() => (login(p.id), navigate('/'))}
                className="flex items-center gap-2 rounded-xl border border-stone-200 bg-white p-2.5 text-left text-sm hover:bg-stone-50"
              >
                <Avatar profile={p} size="sm" />
                {p.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
