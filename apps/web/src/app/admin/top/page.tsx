// Адмінка Топу (revʼю викладача): список категорій/записів + редагування
// супер-адміном. Роль-гейт бекенду (user:manage) + фронт-оверлей.

import { getTopAdmin } from '@/services/admin-top.server'
import { getVenuesCatalog } from '@/services/venues.server'
import { parseVenue } from '@/types/venue'
import { TopManager } from '@/components/features/admin/top-manager'
import { getSessionTokens } from '@/lib/auth/session'

export const revalidate = 0

export const metadata = { title: 'Топ закладів — Адмінка' }

export default async function AdminTopPage() {
  const tokens = await getSessionTokens()
  const categories = await getTopAdmin(tokens).catch(() => [])
  // Дропдаун для додавання записів: схвалені заклади (бекенд 409-ить
  // не-схвалені), за назвою у алфавітному порядку — до 100 (МАКС_ЛІМІТ бекенду).
  const rawVenues = await getVenuesCatalog('limit=100&page=1').catch(
    () => ({ data: [] }),
  )
  const venues = rawVenues.data
    .map((v) => parseVenue(v))
    .map(({ id, name }) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'uk'))

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8">
      <h1 className="text-xl font-bold">Топ закладів</h1>
      <p className="mt-1 text-sm text-muted">
        Категорії Топу («Найкращий заклад для весілля» тощо) і склади. Додаються
        лише схвалені заклади; дублікат у категорії заборонено.
      </p>
      <div className="mt-6">
        <TopManager categories={categories} venues={venues} />
      </div>
    </main>
  )
}