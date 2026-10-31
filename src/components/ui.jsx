import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { AVATAR_CLASS } from '../lib/events'

// 모달이 겹쳐 열렸을 때 Esc는 맨 위 모달만 닫는다
const openModals = []

export function Modal({ open, onClose, title, width = 'max-w-lg', children }) {
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return
    const token = {}
    openModals.push(token)
    const onKey = (e) => e.key === 'Escape' && openModals.at(-1) === token && onCloseRef.current()
    window.addEventListener('keydown', onKey)
    return () => {
      openModals.splice(openModals.indexOf(token), 1)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={onClose}>
      <div className={`w-full ${width} rounded-2xl bg-white shadow-xl`} onMouseDown={(e) => e.stopPropagation()}>
        {title && (
          <div className="flex items-center border-b border-stone-200 px-5 py-3.5">
            <h2 className="text-[15px] font-semibold">{title}</h2>
            <button onClick={onClose} className="ml-auto rounded-md p-1 text-stone-400 hover:bg-stone-100" aria-label="닫기">
              <X size={18} />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}

export function Avatar({ profile, size = 'md', ring = false }) {
  const sz = size === 'xs' ? 'size-5 text-[9px]' : size === 'sm' ? 'size-7 text-[11px]' : 'size-8 text-xs'
  return (
    <div
      title={profile.name}
      className={`${sz} ${AVATAR_CLASS[profile.color] ?? AVATAR_CLASS.teal} ${ring ? 'ring-2 ring-white' : ''} flex shrink-0 items-center justify-center rounded-full font-semibold`}
    >
      {profile.name.length > 2 ? profile.name.slice(-2) : profile.name}
    </div>
  )
}

export function Button({ variant = 'secondary', className = '', ...props }) {
  const styles = {
    primary: 'bg-stone-900 text-white hover:bg-stone-700',
    secondary: 'border border-stone-300 bg-white hover:bg-stone-100',
    ghost: 'hover:bg-stone-100',
    danger: 'text-red-600 hover:bg-red-50',
  }
  return (
    <button
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition disabled:opacity-40 ${styles[variant]} ${className}`}
      {...props}
    />
  )
}

export const inputClass =
  'h-9 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm outline-none focus:border-stone-500 focus:ring-2 focus:ring-stone-200'
