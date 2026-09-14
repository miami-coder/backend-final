// /hangouts — публічна стрічка зустрічей: фільтри статус/дата/заклад, пагінація, протерміновано 30с

import Link from 'next/link'
import { HangoutJoinButton } from '@/components/features/hangouts/hangout-join-button'
import { Pagination } from '@/components/ui/pagination'
import { serverFetchList } from '@/lib/api/server-client'
import { parseHangout, HANGOUT_STATUS_LABELS, type HangoutStatus, type RawHangout } from '@/types/hangout'
import { formatMoney } from '@/lib/utils/format'

const LIMIT = 12
const STATUSES = ['open', 'filled', 'cancelled', 'completed'] as const
// Формат дати фільтра з URL (YYYY-MM-DD): сире значення з query не
// інтерполюємо у запит — невалідне відкидаємо (фільтр просто не застосовується)
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

interface Props {
  searchParams: Promise<{ venueId?: string; date?: string; status?: string; page?: string }>
}

export const revalidate = 30

export default async function HangoutsPage({ searchParams }: Props) {
  const sp = await searchParams
  const page = Math.max(1, Number(sp?.page ?? 1) || 1)
  // невідомий статус з query відкидаємо на дефолт open (валідація вхідних фільтрів)
  const statusParam = sp?.status
  const status: HangoutStatus = STATUSES.includes(statusParam as HangoutStatus)
    ? (statusParam as HangoutStatus)
    : 'open'
  const venueId = sp?.venueId?.trim() || undefined
  const dateParam = sp?.date?.trim()
  const date = dateParam && DATE_RE.test(dateParam) ? dateParam : undefined

  const qs = [`page=${page}`, `limit=${LIMIT}`, `status=${status}`]
  if (venueId) qs.push(`venueId=${encodeURIComponent(venueId)}`)
  if (date) qs.push(`date=${date}`)
  const raw = await serverFetchList<RawHangout>(`/hangouts?${qs.join('&')}`, { revalidate: 30 })
  const hangouts = raw.data.map(parseHangout)
  const totalPages = Math.max(1, Math.ceil((raw.meta?.total ?? 0) / (raw.meta?.limit || LIMIT)))

  // пагінація зберігає активні фільтри (status/venueId/date), скидаючи лише сторінку
  const qsBase = (p: number) => {
    const parts = [`page=${p}`, `status=${status}`]
    if (venueId) parts.push(`venueId=${encodeURIComponent(venueId)}`)
    if (date) parts.push(`date=${date}`)
    return `/hangouts?${parts.join('&')}`
  }

  return (
    <div className="mx-auto max-w-4xl py-8">
      <h1 className="text-2xl font-bold">Зустрічі</h1>
      <form className="mt-4 flex flex-wrap items-end gap-2" action="/hangouts" method="get" aria-label="Фільтри зустрічей">
        <input type="hidden" name="status" value={status} />
        <label className="text-sm">Дата
          <input type="date" name="date" defaultValue={date} className="ml-1 rounded-lg border border-stone-300 px-2 py-1" />
        </label>
        <button type="submit" className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm hover:bg-stone-50">Фільтрувати</button>
      </form>
      <nav className="mt-3 flex gap-3 text-sm" aria-label="Статус зустрічей">
        {STATUSES.map((s) => (
          <Link key={s} href={`/hangouts?status=${s}`}
            className={s === status ? 'font-semibold text-brand-600' : 'text-stone-600 hover:text-brand-600'}>
            {HANGOUT_STATUS_LABELS[s]}
          </Link>
        ))}
      </nav>
      {hangouts.length === 0 ? (
        <div className="mt-6 rounded-xl bg-stone-50 p-8 text-center">
          <p className="text-stone-500">Немає відкритих зустрічей.</p>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {hangouts.map((h) => (
            <li key={h.id} className="rounded-2xl border border-stone-200 bg-white p-4">
              <div className="flex flex-wrap items-center gap-3">
                {/* Produces-контракт брифа: картка кліком веде на /hangouts/[id] —
                    клікабельний заголовок-рядок (дата/час); без вкладених лінків */}
                <Link className="font-medium hover:underline" href={`/hangouts/${h.id}`}>{h.date} · {h.time}</Link>
                <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600">{HANGOUT_STATUS_LABELS[h.status]}</span>
                {h.venue && (
                  <Link className="text-sm text-brand-600 hover:underline" href={`/venues/${h.venue.id}`}>{h.venue.name}</Link>
                )}
                <div className="ml-auto"><HangoutJoinButton hangoutId={h.id} status={h.status} /></div>
              </div>
              <p className="mt-2 text-stone-700">{h.purpose}</p>
              <p className="mt-1 text-sm text-stone-500">
                до {h.groupSize} осіб · {h.payer === 'me' ? 'Плачу я' : h.payer === 'split' ? 'Порівну' : 'Платить компанія'}
                {h.desiredBudget !== null ? ` · бюджет ${formatMoney(h.desiredBudget)}` : ''}
              </p>
              <p className="mt-2">
                <Link className="text-sm text-brand-600 hover:underline" href={`/hangouts/${h.id}`}>Деталі</Link>
              </p>
            </li>
          ))}
        </ul>
      )}
      {totalPages > 1 && <Pagination page={page} totalPages={totalPages} hrefFor={qsBase} />}
    </div>
  )
}
