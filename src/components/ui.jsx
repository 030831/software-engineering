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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/25 p-4 backdrop-blur-[2px]" onMouseDown={onClose}>
      <div className={`w-full ${width} rounded-3xl bg-white shadow-pop`} onMouseDown={(e) => e.stopPropagation()}>
        {title && (
          <div className="flex items-center px-6 pb-1 pt-5">
            <h2 className="text-base font-bold tracking-tight">{title}</h2>
            <button onClick={onClose} className="ml-auto rounded-full p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700" aria-label="닫기">
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
    primary: 'bg-ink text-white shadow-[0_1px_2px_rgb(0_0_0/0.15),inset_0_1px_0_rgb(255_255_255/0.08)] hover:bg-stone-700',
    secondary: 'bg-white text-ink shadow-[0_0_0_1px_rgb(31_29_26/0.1),0_1px_2px_rgb(31_29_26/0.05)] hover:bg-stone-50',
    ghost: 'text-stone-600 hover:bg-stone-900/5 hover:text-ink',
    danger: 'text-red-600 hover:bg-red-50',
  }
  return (
    <button
      className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-xl px-3.5 text-sm font-medium transition disabled:pointer-events-none disabled:opacity-40 ${styles[variant]} ${className}`}
      {...props}
    />
  )
}

export const inputClass =
  'h-10 w-full rounded-xl bg-white px-3.5 text-sm shadow-[0_0_0_1px_rgb(31_29_26/0.1)] outline-none transition placeholder:text-stone-400 focus:shadow-[0_0_0_1.5px_var(--color-brand),0_0_0_5px_var(--color-brand-soft)] disabled:bg-stone-50 disabled:text-stone-500'
