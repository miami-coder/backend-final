'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

// Навігація секцій адмінки: активний маршрут позначається aria-current
export function AdminNav({ links }: { links: readonly { href: string; label: string }[] }) {
  const pathname = usePathname()
  return (
    <nav className="mt-4 flex gap-4 border-b border-stone-200 pb-2 text-sm">
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          aria-current={pathname === l.href ? 'page' : undefined}
          className={pathname === l.href ? 'font-semibold text-stone-900' : 'text-brand-600 hover:underline'}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  )
}
