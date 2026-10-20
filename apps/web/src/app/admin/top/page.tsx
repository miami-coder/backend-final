// Адмінка Топу (revʼю викладача): список категорій/записів + редагування
// супер-адміном. Роль-гейт бекенду (user:manage) + фронт-оверлей.

import { getTopAdmin } from '@/services/admin-top.server'
import { TopManager } from '@/components/features/admin/top-manager'
import { getSessionTokens } from '@/lib/auth/session'

export const revalidate = 0

export const metadata = { title: 'Топ закладів — Адмінка' }

export default async function AdminTopPage() {
  const tokens = await getSessionTokens()
  const categories = await getTopAdmin(tokens).catch(() => [])

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8">
      <h1 className="text-xl font-bold">Топ закладів</h1>
      <p className="mt-1 text-sm text-muted">
        Категорії Топу («Найкращий заклад для весілля» тощо) і склади. Додаються
        лише схвалені заклади; дублікат у категорії заборонено.
      </p>
      <div className="mt-6">
        <TopManager categories={categories} />
      </div>
    </main>
  )
}