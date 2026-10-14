'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

// Навігація секцій адмінки: активний маршрут позначається aria-current
export function AdminNav({ links }: { links: readonly { href: string; label: string }[] }) {
  const pathname = usePathname()
  return (
    <nav className="mt-4 flex gap-4 border-b border-line pb-2 text-sm">
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          aria-current={pathname === l.href ? 'page' : undefined}
          className={
            pathname === l.href
              ? 'border-b-2 border-amber-500 pb-0.5 font-semibold text-ink'
              : 'border-b-2 border-transparent pb-0.5 text-muted hover:text-amber-400'
          }
        >
          {l.label}
        </Link>
      ))}
    </nav>
  )
}
