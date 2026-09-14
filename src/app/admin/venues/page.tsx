import { serverFetchList } from '@/lib/api/server-client'
import { getSessionTokens } from '@/lib/auth/session'
import { parseVenue, type RawVenue, VENUE_STATUS_LABELS } from '@/types/venue'
import { formatDate } from '@/lib/utils/format'
import { Pagination } from '@/components/ui/pagination'
import { VenueApproveButton } from '@/components/features/admin/venue-approve-button'
import { VenueRejectButton } from '@/components/features/admin/venue-reject-button'
import { VenueAssignOwnerButton } from '@/components/features/admin/venue-assign-owner-button'

export const revalidate = 0

const LIMIT = 20

interface Props {
  searchParams: Promise<{ page?: string }>
}

// «Заклади»: черга модерації pending-закладів. Публічних посилань на рядках
// немає — неопубліковані заклади адмін оглядає через схвалення/відхилення.
export default async function AdminVenuesPage({ searchParams }: Props) {
  const sp = await searchParams
  const page = Math.max(1, Number(sp?.page ?? 1) || 1)

  const tokens = await getSessionTokens()
  const list = await serverFetchList<RawVenue>(`/admin/venues/pending?page=${page}`, {
    tokens,
    revalidate: 0,
  })
  const venues = list.data.map(parseVenue)
  // meta без totalPages — рахуємо з total/limit (бекендова limit, інакше LIMIT)
  const totalPages = Math.max(1, Math.ceil((list.meta?.total ?? 0) / (list.meta?.limit || LIMIT)))

  return (
    <section aria-label="Заклади на модерації" className="space-y-4">
      {venues.length === 0 ? (
        <p className="text-stone-500">Заявок на модерації немає.</p>
      ) : (
        <ul className="divide-y divide-stone-200">
          {venues.map((v) => (
            <li key={v.id} className="flex items-center justify-between gap-4 py-3">
              <div className="min-w-0">
                <div className="font-medium text-stone-900">{v.name}</div>
                <div className="text-sm text-stone-600">
                  {v.address} · {formatDate(v.createdAt)} · {VENUE_STATUS_LABELS[v.status]}
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <VenueApproveButton venueId={v.id} />
                <VenueRejectButton venueId={v.id} />
                <VenueAssignOwnerButton venueId={v.id} />
              </div>
            </li>
          ))}
        </ul>
      )}
      {/* Pagination сам повертає null при totalPages <= 1 */}
      <Pagination page={page} totalPages={totalPages} hrefFor={(p) => `/admin/venues?page=${p}`} />
    </section>
  )
}
