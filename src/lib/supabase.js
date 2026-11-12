import { createClient } from '@supabase/supabase-js'

// .env.local(로컬) 또는 Vercel 환경변수에 값이 있으면 Supabase 서버 모드, 없으면 브라우저 저장 데모 모드로 동작한다.
// 브라우저에 들어가도 되는 공개 키(publishable/anon)만 쓴다.
const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = url && key ? createClient(url, key) : null
