import Link from 'next/link'
import { serverFetchList } from '@/lib/api/server-client'
import { getSessionTokens } from '@/lib/auth/session'
import { parseVenue, type Venue, type RawVenue } from '@/types/venue'
import { formatDate } from '@/lib/utils/format'
import { Badge } from '@/components/ui/badge'
import { Pagination } from '@/components/ui/pagination'
import { VenueApproveButton } from '@/components/features/admin/venue-approve-button'
import { VenueRejectButton } from '@/components/features/admin/venue-reject-button'
import { VenueAssignOwnerButton } from '@/components/features/admin/venue-assign-owner-button'
import { placeholderFor } from '@/lib/utils/placeholder'

export const revalidate = 0

const LIMIT = 20
type Tab = 'moderation' | 'approved'

// Лейбли днів для графіка роботи (uk-UA, короткі)
const DAY_LABELS: Record<string, string> = {
  mon: 'Пн', tue: 'Вт', wed: 'Ср', thu: 'Чт', fri: 'Пт', sat: 'Сб', sun: 'Нд',
}

// Короткий опис контактів: що заповнено — те й показуємо
function contactItems(v: Venue): string[] {
  const items: string[] = []
  if (v.contacts.phone) items.push(`📞 ${v.contacts.phone}`)
  if (v.contacts.instagram) items.push(`IG: @${v.contacts.instagram.replace(/^@/, '')}`)
  if (v.contacts.facebook) items.push(`FB: ${v.contacts.facebook}`)
  if (v.contacts.website) items.push(`🌐 ${v.contacts.website}`)
  return items
}

function pendingDays(createdAt: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000))
}

// Детальна карточка заявки: все, що адміну потрібно для рішення, без переходу в публічну частину
function PendingVenueCard({ v }: { v: Venue }) {
  const hours = Object.entries(v.workingHours)
    .map(([d, h]) => `${DAY_LABELS[d] ?? d} ${h}`)
    .join(' · ')
  // mainPhotoUrl у pending зазвичай null (фото не мапиться в entity) — фолбек на перше з relations
  const preview = v.mainPhotoUrl ?? v.photos[0]?.url ?? null
  return (
    <li className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4 hover:bg-raised sm:flex-row sm:items-start sm:gap-4">
      {/* Прев'ю головного фото */}
      <div className="h-20 w-28 shrink-0 overflow-hidden rounded-xl sm:h-24 sm:w-32">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt={v.name} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div style={{ background: placeholderFor(v.id) }} className="h-full w-full" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h3 className="font-semibold text-ink">{v.name}</h3>
          {v.types.map((t) => (
            <Badge key={t.id}>{t.name}</Badge>
          ))}
          <span className="text-xs text-muted">
            подано {formatDate(v.createdAt)} · чекає {pendingDays(v.createdAt)} дн.
          </span>
        </div>

        <p className="mt-1 text-sm text-muted">{v.address}</p>
        {v.description && (
          <p className="mt-1 line-clamp-2 text-sm text-muted">{v.description}</p>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {v.averageCheck !== null && <Badge tone="brand">≈ {v.averageCheck} грн</Badge>}
          {v.features.map((f) => (
            <Badge key={f.id}>{f.name}</Badge>
          ))}
          {v.tags.map((t) => (
            <Badge key={t.id} tone="neutral">#{t.slug}</Badge>
          ))}
          {v.latitude !== null && v.longitude !== null && (
            <Badge tone="neutral">📍 координати є</Badge>
          )}
        </div>

        <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          <div className="flex gap-1.5">
            <dt className="shrink-0 text-muted">Контакти:</dt>
            <dd className="min-w-0 truncate text-ink">
              {contactItems(v).length > 0 ? contactItems(v).join(' · ') : '—'}
            </dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="shrink-0 text-muted">Графік:</dt>
            <dd className="min-w-0 truncate text-ink">
              {hours || '—'}
            </dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="shrink-0 text-muted">Власник:</dt>
            <dd className="min-w-0 truncate text-ink">
              {v.owner ? `${v.owner.name ? `${v.owner.name} · ` : ''}${v.owner.email}` : '—'}
            </dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="shrink-0 text-muted">Фото:</dt>
            <dd className="text-ink">{v.photos.length > 0 ? `${v.photos.length} шт.` : 'немає'}</dd>
          </div>
        </dl>
      </div>

      {/* Призначення власника — тільки в табі схвалених (передача керування);
          у заявок творець уже власник */}
      <div className="flex shrink-0 gap-2 sm:flex-col sm:items-end">
        <VenueApproveButton venueId={v.id} />
        <VenueRejectButton venueId={v.id} />
      </div>
    </li>
  )
}

// Картка схваленого закладу: перегляд + передача керування іншому користувачу
function ApprovedVenueCard({ v }: { v: Venue }) {
  return (
    <li className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4 hover:bg-raised sm:flex-row sm:items-center sm:gap-4">
      <div className="min-w-0 flex-1">
        <Link
          href={`/venues/${v.id}`}
          className="font-semibold text-ink hover:text-amber-500"
        >
          {v.name}
        </Link>
        <p className="mt-0.5 text-sm text-muted">{v.address}</p>
        <p className="mt-0.5 text-sm text-muted">
          Власник: {v.owner ? `${v.owner.name ? `${v.owner.name} · ` : ''}${v.owner.email}` : '—'} ·{' '}
          схвалено {formatDate(v.createdAt)}
        </p>
      </div>
      <div className="shrink-0">
        <VenueAssignOwnerButton venueId={v.id} label="Передати керування" />
      </div>
    </li>
  )
}

interface Props {
  searchParams: Promise<{ page?: string; tab?: string }>
}

// «Заклади»: дві вкладки — черга модерації pending-заявок і схвалені заклади
// (там єдина дія — передача керування; assign-owner на заявках не потрібен,
// бо творець форми вже власник).
export default async function AdminVenuesPage({ searchParams }: Props) {
  const sp = await searchParams
  const page = Math.max(1, Number(sp?.page ?? 1) || 1)
  const tab: Tab = sp?.tab === 'approved' ? 'approved' : 'moderation'

  const tokens = await getSessionTokens()
  const list = await serverFetchList<RawVenue>(
    tab === 'approved' ? `/admin/venues/approved?page=${page}` : `/admin/venues/pending?page=${page}`,
    { tokens, revalidate: 0 },
  )
  const venues = list.data.map(parseVenue)
  // meta без totalPages — рахуємо з total/limit (бекендова limit, інакше LIMIT)
  const totalPages = Math.max(1, Math.ceil((list.meta?.total ?? 0) / (list.meta?.limit || LIMIT)))
  const hrefFor = (p: number) => `/admin/venues?tab=${tab}&page=${p}`

  return (
    <section aria-label="Заклади" className="space-y-4">
      <nav className="flex gap-3 text-sm" aria-label="Вкладки закладів">
        <Link
          href="/admin/venues"
          className={tab === 'moderation' ? 'font-semibold text-amber-500' : 'text-muted hover:text-amber-500'}
        >
          Модерація
        </Link>
        <Link
          href="/admin/venues?tab=approved"
          className={tab === 'approved' ? 'font-semibold text-amber-500' : 'text-muted hover:text-amber-500'}
        >
          Схвалені
        </Link>
      </nav>

      {tab === 'moderation' ? (
        venues.length === 0 ? (
          <p className="rounded-xl border border-line bg-surface p-8 text-center text-muted">Заявок на модерації немає.</p>
        ) : (
          <ul className="space-y-3">
            {venues.map((v) => (
              <PendingVenueCard key={v.id} v={v} />
            ))}
          </ul>
        )
      ) : venues.length === 0 ? (
        <p className="rounded-xl border border-line bg-surface p-8 text-center text-muted">Схвалених закладів немає.</p>
      ) : (
        <ul className="space-y-3">
          {venues.map((v) => (
            <ApprovedVenueCard key={v.id} v={v} />
          ))}
        </ul>
      )}
      {/* Pagination сам повертає null при totalPages <= 1 */}
      <Pagination page={page} totalPages={totalPages} hrefFor={hrefFor} />
    </section>
  )
}