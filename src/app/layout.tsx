import type { Metadata } from 'next'
import { getSessionTokens } from '@/lib/auth/session'
import { serverFetch } from '@/lib/api/server-client'
import { UserProvider } from '@/components/providers/user-provider'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import { AgeGate } from '@/components/layout/age-gate'
import type { SessionUser } from '@/types/user'
import './globals.css'

export const metadata: Metadata = {
  title: { default: 'Пиячок — каталог закладів', template: '%s · Пиячок' },
  description: 'Пошук барів, ресторанів та кафе: рейтинги, відгуки, новини та зустрічі.',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Гостьовий стан при протермінованому access-токені виправить UserProvider (Task 6)
  let user: SessionUser | null = null
  const tokens = await getSessionTokens()
  if (tokens) {
    try {
      user = await serverFetch<SessionUser>('/auth/me', { tokens, revalidate: 0 })
    } catch {
      user = null
    }
  }

  return (
    <html lang="uk">
      <body>
        <UserProvider initialUser={user}>
          <AgeGate />
          <Header />
          <main className="mx-auto min-h-[70vh] max-w-6xl px-4 py-6">{children}</main>
          <Footer />
        </UserProvider>
      </body>
    </html>
  )
}
