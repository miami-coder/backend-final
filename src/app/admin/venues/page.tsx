import Link from 'next/link'
import { getAdminVenuesPage } from '@/services/venues.server'
import { getSessionTokens } from '@/lib/auth/session'
import { parseVenue, VENUE_STATUS_LABELS, type Venue, type RawVenue } from '@/types/venue'
import { formatDate } from '@/lib/utils/format'
import { Badge } from '@/components/ui/badge'
import { Pagination } from '@/components/ui/pagination'
import { VenueApproveButton } from '@/components/features/admin/venue-approve-button'
import { VenueRejectButton } from '@/components/features/admin/venue-reject-button'
import { VenueAssignOwnerButton } from '@/components/features/admin/venue-assign-owner-button'
import { VenueDeleteButton } from '@/components/features/venues/venue-delete-button'
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
      <div className="h-20 w-28 shrink-0 overflow-hidden rounded-xl bg-raised sm:h-24 sm:w-32">
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

// Статус → колір крапки-індикатора (токени success/danger/amber-400)
const STATUS_DOT: Record<string, string> = {
  pending: 'bg-amber-400',
  approved: 'bg-success',
  rejected: 'bg-danger',
  archived: 'bg-faint',
}

// Бейдж-крапка статусу: обведений стиль + крапка-індикатор кольору статусу
function StatusDotBadge({ status }: { status: Venue['status'] }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-2 py-0.5 text-xs text-muted">
      <span aria-hidden className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT[status] ?? 'bg-faint'}`} />
      {VENUE_STATUS_LABELS[status]}
    </span>
  )
}

// Щільний рядок таблиці схвалених закладів: перегляд + передача керування
function ApprovedVenueRow({ v }: { v: Venue }) {
  return (
    <tr className="border-t border-line">
      <td className="px-4 py-2">
        <Link
          href={`/venues/${v.id}`}
          className="font-medium text-ink hover:text-amber-500"
        >
          {v.name}
        </Link>
        <p className="truncate text-sm text-muted">{v.address}</p>
      </td>
      <td className="max-w-[220px] truncate px-4 py-2 text-sm text-muted">
        {v.owner ? `${v.owner.name ? `${v.owner.name} · ` : ''}${v.owner.email}` : '—'}
      </td>
      <td className="px-4 py-2 text-sm text-muted">{formatDate(v.createdAt)}</td>
      <td className="px-4 py-2">
        <StatusDotBadge status={v.status} />
      </td>
      <td className="px-4 py-2 text-right">
        <div className="flex justify-end gap-2">
          <VenueAssignOwnerButton venueId={v.id} label="Передати керування" />
          {/* Супер-адмін видаляє будь-який заклад (ТЗ §16): м'яко, у архів */}
          <VenueDeleteButton venueId={v.id} />
        </div>
      </td>
    </tr>
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
  const list = await getAdminVenuesPage(tab, page, tokens)
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
        // Щільна таблиця схвалених: Заклад / Власник / Схвалено / Статус / дії
        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[11px] font-medium text-faint">
                <th scope="col" className="px-4 py-2">Заклад</th>
                <th scope="col" className="px-4 py-2">Власник</th>
                <th scope="col" className="px-4 py-2">Схвалено</th>
                <th scope="col" className="px-4 py-2">Статус</th>
                <th scope="col" className="px-4 py-2 text-right">Дії</th>
              </tr>
            </thead>
            <tbody>
              {venues.map((v) => (
                <ApprovedVenueRow key={v.id} v={v} />
              ))}
            </tbody>
          </table>
        </div>
      )}
      {/* Pagination сам повертає null при totalPages <= 1 */}
      <Pagination page={page} totalPages={totalPages} hrefFor={hrefFor} />
    </section>
  )
}
