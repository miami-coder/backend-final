'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useUser } from '@/components/providers/user-provider'

export function UserMenu() {
  const { user, logout } = useUser()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const pathname = usePathname()

  // Меню живе у хедері, що персистить між роутами, — закриваємо його
  // після переходу (і після «Вийти»), інакше воно лишається розкритим.
  // Коригування стану під час рендеру, а не в ефекті — так радить react-hooks
  const [prevPath, setPrevPath] = useState(pathname)
  if (prevPath !== pathname) {
    setPrevPath(pathname)
    setOpen(false)
  }

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
        className="flex items-center gap-2 rounded-xl border border-strong px-3 py-1 text-sm text-ink hover:bg-raised"
      >
        <span className="max-w-40 truncate">{displayName}</span>
        {isAdmin && <span className="rounded-full bg-amber-400/15 px-1.5 text-xs text-amber-400">admin</span>}
      </button>
      {open && (
        <div role="menu" aria-label="Меню користувача" className="absolute right-0 z-40 mt-1 w-44 rounded-xl border border-line bg-surface py-1">
          <Link role="menuitem" href="/account" onClick={() => setOpen(false)} className="block px-4 py-2 text-sm text-ink hover:bg-raised">Кабінет</Link>
          {isAdmin && <Link role="menuitem" href="/admin" onClick={() => setOpen(false)} className="block px-4 py-2 text-sm text-ink hover:bg-raised">Адмінка</Link>}
          <Link role="menuitem" href="/contact" onClick={() => setOpen(false)} className="block px-4 py-2 text-sm text-ink hover:bg-raised">Написати нам</Link>
          <button role="menuitem" type="button" onClick={() => { setOpen(false); void logout() }} className="block w-full px-4 py-2 text-left text-sm text-ink hover:bg-raised">Вийти</button>
        </div>
      )}
    </div>
  )
}
