'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useUser } from '@/components/providers/user-provider'
import { UserMenu } from '@/components/layout/user-menu'

const NAV = [
  { href: '/', label: 'Каталог' },
  { href: '/news', label: 'Новини' },
  { href: '/hangouts', label: 'Зустрічі' },
]

export function Header() {
  const { user } = useUser()
  const router = useRouter()
  const pathname = usePathname()

  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-6xl items-center gap-5 px-4 py-3">
        <Link href="/" className="font-display text-base font-bold text-amber-500">Пиячок</Link>
        <nav className="flex gap-4 text-sm">
          {NAV.map((item) => {
            const active = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`border-b-2 pb-0.5 transition-colors ${
                  active ? 'border-amber-500 text-ink' : 'border-transparent text-muted hover:text-amber-400'
                }`}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>
        <form
          className="ml-auto hidden sm:block"
          onSubmit={(e) => {
            e.preventDefault()
            const q = new FormData(e.currentTarget).get('q')
            router.push(`/?q=${encodeURIComponent(String(q ?? ''))}`)
          }}
        >
          <input
            name="q"
            placeholder="Пошук закладів…"
            aria-label="Пошук закладів"
            className="w-56 rounded-full border border-strong bg-bg px-4 py-1.5 text-sm text-ink placeholder:text-faint focus:border-amber-500 focus:outline-none"
          />
        </form>
        {user ? <UserMenu /> : (
          // Посилання, а не Link>Button: <button> всередині <a> — невалідний HTML.
          // Класи — як primary-кнопка (sm).
          <Link
            href="/auth/login"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-amber-500 px-4 py-1.5 text-[13px] font-medium text-espresso transition-colors hover:bg-amber-400"
          >
            Увійти
          </Link>
        )}
      </div>
    </header>
  )
}
