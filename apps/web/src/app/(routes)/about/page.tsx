// «Про нас» — окрема сторінка (відгук користувача: довгий текст вилучено
// з футера). Тексти редагує супер-адмін в /admin/content.

import Link from 'next/link'
import { getSiteContent } from '@/services/content.server'

export const revalidate = 0

export const metadata = { title: 'Про нас — Пиячок' }

export default async function AboutPage() {
  const content = await getSiteContent().catch(() => ({
    about: null,
    contacts: null,
  }))

  return (
    <main className="mx-auto w-full max-w-2xl py-10">
      <h1 className="text-2xl font-bold text-ink">Про нас</h1>

      <div className="mt-6 space-y-4 text-base leading-relaxed text-muted">
        {content.about ? (
          content.about.split('\n').filter(Boolean).map((p, i) => <p key={i}>{p}</p>)
        ) : (
          <p>Текст ще не заповнено.</p>
        )}
      </div>

      {content.contacts && (
        <div className="mt-10 rounded-xl border border-line bg-surface p-5">
          <h2 className="text-sm font-semibold text-ink">Контакти</h2>
          <p className="mt-2 text-sm text-muted">{content.contacts}</p>
        </div>
      )}

      <p className="mt-10">
        <Link href="/" className="text-sm text-amber-500 hover:underline">
          ← До каталогу
        </Link>
      </p>
    </main>
  )
}