'use client'

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { authLogout, authMe } from '@/services/auth'
import type { SessionUser } from '@/types/user'

interface UserContextValue {
  user: SessionUser | null
  setUser: (u: SessionUser | null) => void
  logout: () => Promise<void>
}

const UserContext = createContext<UserContextValue | null>(null)

export function UserProvider({ initialUser, children }: { initialUser: SessionUser | null; children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(initialUser)
  const router = useRouter()

  // Підтвердження сесії: якщо SSR відрендерив гостя через протермінований
  // access-токен, проксі тут зробить refresh і поверне користувача.
  useEffect(() => {
    let cancelled = false
    authMe()
      .then((next) => {
        if (cancelled || !next) return
        setUser((prev) => (prev?.id === next.id ? prev : next))
      })
      .catch(() => null)
    return () => { cancelled = true }
  }, [])

  const logout = useCallback(async () => {
    await authLogout()
    setUser(null)
    router.push('/')
    router.refresh()
  }, [router])

  return <UserContext.Provider value={{ user, setUser, logout }}>{children}</UserContext.Provider>
}

export function useUser(): UserContextValue {
  const ctx = useContext(UserContext)
  if (!ctx) throw new Error('useUser має використовуватись всередині UserProvider')
  return ctx
}
