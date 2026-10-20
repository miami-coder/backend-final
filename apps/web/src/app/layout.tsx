import type { Metadata } from 'next'
import { Golos_Text, Unbounded } from 'next/font/google'
import { getSessionTokens } from '@/lib/auth/session'
import { getMeSession } from '@/services/auth.server'
import { UserProvider } from '@/components/providers/user-provider'
import { ToastProvider } from '@/components/ui/toast'
import { AppShell } from '@/components/layout/app-shell'
import type { SessionUser } from '@/types/user'
import './globals.css'

export const metadata: Metadata = {
  title: { default: 'Пиячок — каталог закладів', template: '%s · Пиячок' },
  description: 'Пошук барів, ресторанів та кафе: рейтинги, відгуки, новини та зустрічі.',
}

// Обидва шрифти — з кирилицею; Unbounded лише для заголовків/логотипа (см. спек §3)
const golos = Golos_Text({ subsets: ['latin', 'cyrillic'], variable: '--font-golos', display: 'swap' })
const unbounded = Unbounded({ subsets: ['latin', 'cyrillic'], variable: '--font-unbounded', display: 'swap' })

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Гостьовий стан при протермінованому access-токені виправить UserProvider (Task 6)
  let user: SessionUser | null = null
  const tokens = await getSessionTokens()
  if (tokens) {
    try {
      user = await getMeSession(tokens)
    } catch {
      user = null
    }
  }

  return (
    <html lang="uk" className={`${golos.variable} ${unbounded.variable}`}>
      <body>
        <UserProvider initialUser={user}>
          <ToastProvider>
            <AppShell>{children}</AppShell>
          </ToastProvider>
        </UserProvider>
      </body>
    </html>
  )
}
