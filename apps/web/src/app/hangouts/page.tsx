// /hangouts — публічна стрічка зустрічей: фільтри статус/дата/заклад, пагінація, протерміновано 30с

import Link from 'next/link'
import { HangoutJoinButton } from '@/components/features/hangouts/hangout-join-button'
import { Pagination } from '@/components/ui/pagination'
import { getHangouts, getMyHangoutIds } from '@/services/hangouts.server'
import { getSessionTokens } from '@/lib/auth/session'
import { parseHangout, HANGOUT_STATUS_LABELS, type HangoutStatus, type RawHangout } from '@/types/hangout'
import { formatMoney } from '@/lib/utils/format'
// Лейбл payer — та сама константа, що й у формі створення/кабінеті (єдине джерело копірайту)
import { HANGOUT_PAYERS } from '@/lib/validation/hangout'

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
  const raw = await getHangouts(qs.join('&'))
  const hangouts = raw.data.map(parseHangout)
  const totalPages = Math.max(1, Math.ceil((raw.meta?.total ?? 0) / (raw.meta?.limit || LIMIT)))

  // стан «В тусовці!» живе і після релоаду: id моїх зустрічей (created+joined)
  const tokens = await getSessionTokens()
  const myIds = await getMyHangoutIds(tokens)

  // пагінація зберігає активні фільтри (status/venueId/date), скидаючи лише сторінку
  const qsBase = (p: number) => {
    const parts = [`page=${p}`, `status=${status}`]
    if (venueId) parts.push(`venueId=${encodeURIComponent(venueId)}`)
    if (date) parts.push(`date=${date}`)
    return `/hangouts?${parts.join('&')}`
  }

  return (
    <div className="mx-auto max-w-4xl py-8">
      <h1 className="font-display text-2xl font-bold text-ink">Зустрічі</h1>
      <form className="mt-4 flex flex-wrap items-end gap-2" action="/hangouts" method="get" aria-label="Фільтри зустрічей">
        <input type="hidden" name="status" value={status} />
        <label className="text-sm">Дата
          <input type="date" name="date" defaultValue={date} className="ml-1 rounded-xl border border-strong bg-bg px-2 py-1 text-ink" />
        </label>
        <button type="submit" className="rounded-full border border-strong px-3 py-1.5 text-sm hover:bg-raised">Фільтрувати</button>
      </form>
      <nav className="mt-3 flex gap-3 text-sm" aria-label="Статус зустрічей">
        {STATUSES.map((s) => (
          <Link key={s} href={`/hangouts?status=${s}`}
            className={s === status ? 'font-semibold text-amber-500' : 'text-muted hover:text-amber-500'}>
            {HANGOUT_STATUS_LABELS[s]}
          </Link>
        ))}
      </nav>
      {hangouts.length === 0 ? (
        <div className="mt-6 rounded-xl border border-line bg-surface p-8 text-center">
          <p className="text-muted">Немає відкритих зустрічей.</p>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {hangouts.map((h) => (
            <li key={h.id} className="rounded-xl border border-line bg-surface p-4">
              <div className="flex flex-wrap items-center gap-3">
                {/* Produces-контракт брифа: картка кліком веде на /hangouts/[id] —
                    клікабельний заголовок-рядок (дата/час); без вкладених лінків */}
                <Link className="font-medium hover:underline" href={`/hangouts/${h.id}`}>{h.date} · {h.time}</Link>
                <span className="rounded-full bg-raised px-2 py-0.5 text-xs text-muted">{HANGOUT_STATUS_LABELS[h.status]}</span>
                {h.venue && (
                  <Link className="text-sm text-amber-500 hover:underline" href={`/venues/${h.venue.id}`}>{h.venue.name}</Link>
                )}
                <div className="ml-auto"><HangoutJoinButton hangoutId={h.id} status={h.status} initialJoined={myIds.has(h.id)} /></div>
              </div>
              <p className="mt-2 text-muted">{h.purpose}</p>
              <p className="mt-1 text-sm text-muted">
                до {h.groupSize} осіб · {HANGOUT_PAYERS.find((p) => p.value === h.payer)?.label}
                {h.desiredBudget !== null ? ` · бюджет ${formatMoney(h.desiredBudget)}` : ''}
              </p>
              <p className="mt-2">
                <Link className="text-sm text-amber-500 hover:underline" href={`/hangouts/${h.id}`}>Деталі</Link>
              </p>
            </li>
          ))}
        </ul>
      )}
      {totalPages > 1 && <Pagination page={page} totalPages={totalPages} hrefFor={qsBase} />}
    </div>
  )
}
