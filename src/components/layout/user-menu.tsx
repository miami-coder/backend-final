'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useUser } from '@/components/providers/user-provider'

export function UserMenu() {
  const { user, logout } = useUser()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    function onDocMouseDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false)
        btnRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', onDocMouseDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!user) return null
  const isAdmin = user.roles.includes('super_admin')
  const displayName =
    [user.profile?.firstname, user.profile?.lastname]
      .filter(Boolean)
      .join(' ')
      .trim() || user.email

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={btnRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full border border-strong px-3 py-1 text-sm text-ink hover:bg-raised"
      >
        <span className="max-w-40 truncate">{displayName}</span>
        {isAdmin && <span className="rounded-full bg-amber-400/15 px-1.5 text-xs text-amber-400">admin</span>}
      </button>
      {open && (
        <div role="menu" aria-label="Меню користувача" className="absolute right-0 z-40 mt-1 w-44 rounded-xl border border-line bg-surface py-1">
          <Link role="menuitem" href="/account" className="block px-4 py-2 text-sm text-ink hover:bg-raised">Кабінет</Link>
          {isAdmin && <Link role="menuitem" href="/admin" className="block px-4 py-2 text-sm text-ink hover:bg-raised">Адмінка</Link>}
          <button role="menuitem" type="button" onClick={() => void logout()} className="block w-full px-4 py-2 text-left text-sm text-ink hover:bg-raised">Вийти</button>
        </div>
      )}
    </div>
  )
}
